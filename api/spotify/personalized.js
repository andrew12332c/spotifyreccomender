import { spotifyFetch } from "./_spotify.js";
import { getSimilarTracks, getSimilarArtists, getArtistTopTracks } from "../lastfm/_lastfm.js";
import { lookupArtistMBID, findSimilarArtists, getTopRecordings } from "../listenbrainz/_listenbrainz.js";

/**
 * GET /api/spotify/personalized?seeds=JSON
 *
 * `seeds` is a JSON-encoded array of { id, name, artist } objects drawn from
 * listening history and playlist.  The endpoint fans out to three independent
 * pipelines — Spotify, Last.fm, and ListenBrainz — then merges and deduplicates.
 */
export default async function handler(req, res) {
  let seeds;
  try {
    seeds = JSON.parse(req.query.seeds || "[]");
  } catch {
    return res.status(400).json({ error: "Invalid seeds JSON" });
  }

  if (!seeds.length) {
    return res.status(400).json({ error: "No seed tracks provided" });
  }

  const excludeIds = new Set(seeds.map((s) => s.id));

  try {
    // Run all three pipelines in parallel — each one is fault-tolerant
    const [spotifyResults, lastfmResults, listenbrainzResults] = await Promise.all([
      spotifyPipeline(seeds, excludeIds),
      lastfmPipeline(seeds, excludeIds),
      listenbrainzPipeline(seeds, excludeIds),
    ]);

    // Interleave results: Spotify, Last.fm, LB, Spotify, Last.fm, LB...
    const seen = new Set();
    const merged = [];
    const pools = [spotifyResults, lastfmResults, listenbrainzResults];
    const indices = [0, 0, 0];

    for (let round = 0; merged.length < 15 && round < 30; round++) {
      const pool = pools[round % 3];
      const idx = indices[round % 3];
      if (idx < pool.length) {
        const t = pool[idx];
        indices[round % 3]++;
        if (!seen.has(t.id) && !excludeIds.has(t.id)) {
          seen.add(t.id);
          merged.push(t);
        }
      }
    }

    res.json({
      forYou: merged,
      sources: {
        spotify: spotifyResults.length,
        lastfm: lastfmResults.length,
        listenbrainz: listenbrainzResults.length,
      },
    });
  } catch (err) {
    console.error("Personalized error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// ------------------------------------------------------------------
// Spotify pipeline: genres + search/recommendations
// ------------------------------------------------------------------
async function spotifyPipeline(seeds, excludeIds) {
  try {
    const seedIds = seeds.slice(0, 5).map((s) => s.id);
    const artistNames = [...new Set(seeds.map((s) => s.artist))];

    const genrePool = [];
    for (const name of artistNames.slice(0, 3)) {
      try {
        const data = await spotifyFetch("/search", { q: `artist:"${name}"`, type: "artist", limit: 1 });
        const artist = data.artists?.items?.[0];
        if (artist?.genres) genrePool.push(...artist.genres);
      } catch { /* skip */ }
    }
    const genres = [...new Set(genrePool)];

    // Try /recommendations first
    let tracks = [];
    try {
      const params = { limit: 20 };
      if (seedIds.length <= 3 && genres.length > 0) {
        params.seed_tracks = seedIds.slice(0, 3).join(",");
        params.seed_genres = genres.slice(0, 2).join(",");
      } else {
        params.seed_tracks = seedIds.slice(0, 5).join(",");
      }
      const data = await spotifyFetch("/recommendations", params);
      tracks = (data.tracks || []).map((t) => ({ ...formatTrack(t), source: "spotify" }));
    } catch { /* fall through to search */ }

    // Fill remaining via genre search
    if (tracks.length < 8) {
      const queries = [];
      if (genres.length >= 2) queries.push(`genre:"${genres[0]}" genre:"${genres[1]}"`);
      if (genres.length >= 1) queries.push(`genre:"${genres[0]}"`);
      for (const name of artistNames.slice(0, 2)) queries.push(name);

      for (const q of queries) {
        if (tracks.length >= 10) break;
        try {
          const data = await spotifyFetch("/search", { q, type: "track", limit: 8 });
          for (const t of data.tracks?.items || []) {
            if (!excludeIds.has(t.id)) {
              tracks.push({ ...formatTrack(t), source: "spotify" });
            }
          }
        } catch { /* skip */ }
      }
    }

    // Deduplicate by artist
    const seen = new Set();
    return tracks.filter((t) => {
      const aid = t.artists[0]?.id;
      if (seen.has(aid)) return false;
      seen.add(aid);
      return true;
    });
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------
// Last.fm pipeline: scrobble-based similar tracks + similar artists
// ------------------------------------------------------------------
async function lastfmPipeline(seeds, excludeIds) {
  try {
    // Pick 3 representative seed tracks for Last.fm queries
    const picks = seeds.slice(0, 3);

    // Get similar tracks for each seed (parallel)
    const similarBatches = await Promise.allSettled(
      picks.map((s) => getSimilarTracks(s.name, s.artist, 8))
    );
    const similarCandidates = similarBatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // Get similar artists from top 2 seeds, then their top tracks
    const artistBatches = await Promise.allSettled(
      picks.slice(0, 2).map((s) => getSimilarArtists(s.artist, 4))
    );
    const relatedArtists = artistBatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const topTrackBatches = await Promise.allSettled(
      relatedArtists.slice(0, 5).map((a) => getArtistTopTracks(a.name, 2))
    );
    const artistCandidates = topTrackBatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const allCandidates = [...similarCandidates, ...artistCandidates];

    // Map to Spotify tracks (parallel, capped)
    const mapped = await mapToSpotify(allCandidates.slice(0, 20), excludeIds, "lastfm");

    // Deduplicate by artist
    const seen = new Set();
    return mapped.filter((t) => {
      const aid = t.artists[0]?.id;
      if (seen.has(aid)) return false;
      seen.add(aid);
      return true;
    });
  } catch (err) {
    console.log("Last.fm personalized pipeline failed:", err.message);
    return [];
  }
}

// ------------------------------------------------------------------
// ListenBrainz pipeline: tag-based collaborative filtering
// ------------------------------------------------------------------
async function listenbrainzPipeline(seeds, excludeIds) {
  try {
    // Pick 2 distinct artists from seeds (MusicBrainz is rate-limited to 1 req/sec)
    const uniqueArtists = [...new Set(seeds.map((s) => s.artist))].slice(0, 2);

    const allCandidates = [];

    for (const artistName of uniqueArtists) {
      try {
        const mbid = await lookupArtistMBID(artistName);
        if (!mbid) continue;

        const similar = await findSimilarArtists(mbid, artistName, 6);
        if (!similar.length) continue;

        const recBatches = await Promise.allSettled(
          similar.slice(0, 4).map((a) =>
            getTopRecordings(a.id).then((recs) =>
              recs.slice(0, 2).map((r) => ({
                name: r.recording_name || r.title || "",
                artist: r.artist_name || a.name,
              }))
            )
          )
        );

        for (const r of recBatches) {
          if (r.status === "fulfilled") allCandidates.push(...r.value);
        }
      } catch { /* skip artist */ }
    }

    if (!allCandidates.length) return [];

    const mapped = await mapToSpotify(allCandidates.slice(0, 15), excludeIds, "listenbrainz");

    const seen = new Set();
    return mapped.filter((t) => {
      const aid = t.artists[0]?.id;
      if (seen.has(aid)) return false;
      seen.add(aid);
      return true;
    });
  } catch (err) {
    console.log("ListenBrainz personalized pipeline failed:", err.message);
    return [];
  }
}

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------
async function mapToSpotify(candidates, excludeIds, source) {
  const results = await Promise.allSettled(
    candidates.map(async (c) => {
      const q = `track:${c.name} artist:${c.artist}`;
      const data = await spotifyFetch("/search", { q, type: "track", limit: 1 });
      const hit = data.tracks?.items?.[0];
      if (!hit) return null;
      return { ...formatTrack(hit), source };
    })
  );

  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value)
    .filter((t) => !excludeIds.has(t.id));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTrack(t) {
  return {
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
    album: {
      name: t.album.name,
      image: t.album.images?.[0]?.url,
      imageSmall: t.album.images?.[1]?.url || t.album.images?.[0]?.url,
    },
    previewUrl: t.preview_url,
    externalUrl: t.external_urls?.spotify,
    popularity: t.popularity,
    durationMs: t.duration_ms,
  };
}
