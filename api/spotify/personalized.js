import { spotifyFetch } from "./_spotify.js";

/**
 * GET /api/spotify/personalized?historyIds=id1,id2,...&playlistIds=id1,id2,...
 *
 * Builds recommendations seeded from listening history and playlist tracks.
 * Picks a handful of seeds, gathers their genres, then queries for fresh tracks
 * the user hasn't already seen.
 */
export default async function handler(req, res) {
  const historyIds = (req.query.historyIds || "").split(",").filter(Boolean);
  const playlistIds = (req.query.playlistIds || "").split(",").filter(Boolean);

  if (historyIds.length === 0 && playlistIds.length === 0) {
    return res.status(400).json({ error: "No seed tracks provided" });
  }

  try {
    // Pick seeds: 3 from history (most recent), 2 from playlist (random)
    const historySample = historyIds.slice(0, 3);
    const playlistSample = shuffle(playlistIds).slice(0, 2);
    const seedIds = [...new Set([...historySample, ...playlistSample])].slice(0, 5);
    const excludeIds = new Set([...historyIds, ...playlistIds]);

    // Fetch artist info for seeds to collect genres
    const artists = await Promise.all(
      seedIds.map(async (id) => {
        try {
          const track = await spotifyFetch(`/tracks/${id}`);
          return track.artists[0];
        } catch {
          return null;
        }
      })
    );
    const validArtists = artists.filter(Boolean);
    const seedArtistIds = new Set(validArtists.map((a) => a.id));

    const genrePool = [];
    for (const a of validArtists.slice(0, 3)) {
      try {
        const full = await spotifyFetch(`/artists/${a.id}`);
        genrePool.push(...(full.genres || []));
      } catch {
        /* skip */
      }
    }
    const genres = [...new Set(genrePool)];

    // Strategy 1: Spotify /recommendations (may be restricted)
    const recsFromApi = await tryRecommendations(seedIds, genres, excludeIds, seedArtistIds);

    // Strategy 2: genre-based search for diversity
    const recsFromSearch = await searchByGenres(genres, validArtists, excludeIds, seedArtistIds);

    // Merge and deduplicate: recs from API first, then search fills gaps
    const seen = new Set();
    const merged = [];
    for (const t of [...recsFromApi, ...recsFromSearch]) {
      if (!seen.has(t.id) && !excludeIds.has(t.id)) {
        seen.add(t.id);
        merged.push(t);
      }
      if (merged.length >= 12) break;
    }

    res.json({
      forYou: merged,
      seedCount: seedIds.length,
      genreCount: genres.length,
    });
  } catch (err) {
    console.error("Personalized error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

async function tryRecommendations(seedIds, genres, excludeIds, seedArtistIds) {
  try {
    const params = { limit: 30 };

    // Spotify allows 5 seeds total across tracks + artists + genres
    if (seedIds.length <= 3 && genres.length > 0) {
      params.seed_tracks = seedIds.join(",");
      params.seed_genres = genres.slice(0, 5 - seedIds.length).join(",");
    } else {
      params.seed_tracks = seedIds.slice(0, 5).join(",");
    }

    const data = await spotifyFetch("/recommendations", params);

    // Filter for diversity: skip seeds and limit one track per artist
    const seen = new Set();
    return (data.tracks || [])
      .filter((t) => !excludeIds.has(t.id))
      .map(formatTrack)
      .filter((t) => {
        const aid = t.artists[0]?.id;
        if (seen.has(aid)) return false;
        seen.add(aid);
        return true;
      });
  } catch {
    return [];
  }
}

async function searchByGenres(genres, artists, excludeIds, seedArtistIds) {
  const results = [];
  const seenArtists = new Set(seedArtistIds);

  const queries = [];
  if (genres.length >= 2) {
    queries.push(`genre:"${genres[0]}" genre:"${genres[1]}"`);
  }
  if (genres.length >= 1) {
    queries.push(`genre:"${genres[0]}"`);
  }
  // Use artist names as contextual search cues
  for (const a of artists.slice(0, 2)) {
    queries.push(a.name);
  }
  if (genres.length >= 3) {
    queries.push(`genre:"${genres[2]}"`);
  }

  for (const q of queries) {
    if (results.length >= 12) break;
    try {
      const data = await spotifyFetch("/search", { q, type: "track", limit: 10 });
      for (const t of data.tracks?.items || []) {
        const aid = t.artists[0]?.id;
        if (excludeIds.has(t.id) || seenArtists.has(aid)) continue;
        seenArtists.add(aid);
        results.push(formatTrack(t));
        if (results.length >= 12) break;
      }
    } catch {
      /* skip */
    }
  }

  return results;
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
