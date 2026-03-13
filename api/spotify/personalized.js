import { spotifyFetch } from "./_spotify.js";
import { getSimilarTracks, getSimilarArtists, getArtistTopTracks } from "../lastfm/_lastfm.js";
import { lookupArtistMBID, findSimilarArtists, getTopRecordings } from "../listenbrainz/_listenbrainz.js";

/**
 * GET /api/spotify/personalized?seeds=JSON
 *
 * `seeds` is a JSON-encoded array of { id, name, artist } objects drawn from
 * listening history and playlist.  Discovery is powered entirely by Last.fm
 * and ListenBrainz — Spotify is only used to resolve results to playable tracks.
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
    const [lastfmResults, listenbrainzResults] = await Promise.all([
      lastfmPipeline(seeds, excludeIds),
      listenbrainzPipeline(seeds, excludeIds),
    ]);

    // Interleave: alternate Last.fm and ListenBrainz for a balanced mix
    const seen = new Set();
    const merged = [];
    const pools = [lastfmResults, listenbrainzResults];
    const indices = [0, 0];

    for (let round = 0; merged.length < 15 && round < 40; round++) {
      const pool = pools[round % 2];
      const idx = indices[round % 2];
      if (idx < pool.length) {
        const t = pool[idx];
        indices[round % 2]++;
        if (!seen.has(t.id) && !excludeIds.has(t.id)) {
          seen.add(t.id);
          merged.push(t);
        }
      }
    }

    res.json({
      forYou: merged,
      sources: {
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
// Last.fm pipeline: scrobble-based similar tracks + similar artists
// ------------------------------------------------------------------
async function lastfmPipeline(seeds, excludeIds) {
  try {
    const picks = seeds.slice(0, 4);

    // Similar tracks for each seed (scrobble co-occurrence)
    const similarBatches = await Promise.allSettled(
      picks.map((s) => getSimilarTracks(s.name, s.artist, 10))
    );
    const similarCandidates = similarBatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // Similar artists from top 3 seeds → their top tracks
    const artistBatches = await Promise.allSettled(
      picks.slice(0, 3).map((s) => getSimilarArtists(s.artist, 5))
    );
    const relatedArtists = artistBatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const topTrackBatches = await Promise.allSettled(
      relatedArtists.slice(0, 8).map((a) => getArtistTopTracks(a.name, 2))
    );
    const artistCandidates = topTrackBatches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const allCandidates = [...similarCandidates, ...artistCandidates];

    const mapped = await mapToSpotify(allCandidates.slice(0, 25), excludeIds, "lastfm");

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
    const uniqueArtists = [...new Set(seeds.map((s) => s.artist))].slice(0, 3);

    const allCandidates = [];

    for (const artistName of uniqueArtists) {
      try {
        const mbid = await lookupArtistMBID(artistName);
        if (!mbid) continue;

        const similar = await findSimilarArtists(mbid, artistName, 8);
        if (!similar.length) continue;

        const recBatches = await Promise.allSettled(
          similar.slice(0, 5).map((a) =>
            getTopRecordings(a.id).then((recs) =>
              recs.slice(0, 3).map((r) => ({
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

    const mapped = await mapToSpotify(allCandidates.slice(0, 20), excludeIds, "listenbrainz");

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
// Shared: resolve Last.fm/LB candidates to playable Spotify tracks
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
