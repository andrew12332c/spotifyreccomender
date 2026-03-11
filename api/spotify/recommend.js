import { spotifyFetch } from "./_spotify.js";

export default async function handler(req, res) {
  const { trackId } = req.query;
  if (!trackId) return res.status(400).json({ error: "Missing trackId" });

  try {
    const track = await spotifyFetch(`/tracks/${trackId}`);
    const artistId = track.artists[0].id;
    const artistName = track.artists[0].name;

    const artist = await spotifyFetch(`/artists/${artistId}`);
    const genres = artist.genres || [];

    const [similar, discovery] = await Promise.all([
      getSimilarTracks(trackId, artistId, artistName, genres),
      getDiscoveryTracks(artistId, artistName, genres),
    ]);

    res.json({
      seed: formatTrack(track),
      similar,
      discovery,
    });
  } catch (err) {
    console.error("Recommend error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// ------------------------------------------------------------------
// Similar tracks: try /recommendations first, then fall back to a
// search-based approach that works on every Spotify API tier.
// ------------------------------------------------------------------
async function getSimilarTracks(trackId, artistId, artistName, genres) {
  // Attempt 1: /recommendations (restricted on basic-tier apps since late 2024)
  try {
    const data = await spotifyFetch("/recommendations", {
      seed_tracks: trackId,
      seed_artists: artistId,
      limit: 15,
    });
    if (data.tracks?.length) {
      return data.tracks.map(formatTrack).slice(0, 10);
    }
  } catch (err) {
    console.log("recommendations endpoint unavailable:", err.message);
  }

  // Attempt 2: artist top tracks
  try {
    const data = await spotifyFetch(`/artists/${artistId}/top-tracks`, {
      market: "US",
    });
    if (data.tracks?.length) {
      return data.tracks
        .filter((t) => t.id !== trackId)
        .slice(0, 10)
        .map(formatTrack);
    }
  } catch (err) {
    console.log("top-tracks endpoint unavailable:", err.message);
  }

  // Attempt 3: search for same artist — always works
  try {
    const q = `artist:"${artistName}"`;
    const data = await spotifyFetch("/search", { q, type: "track", limit: 10 });
    return (data.tracks?.items || [])
      .filter((t) => t.id !== trackId)
      .slice(0, 10)
      .map(formatTrack);
  } catch (err) {
    console.error("similar search fallback failed:", err.message);
    return [];
  }
}

// ------------------------------------------------------------------
// Discovery tracks: try /recommendations + /related-artists first,
// then fall back to genre/tag-based search that works on any tier.
// ------------------------------------------------------------------
async function getDiscoveryTracks(artistId, artistName, genres) {
  // Attempt 1: related artists → top tracks
  try {
    const related = await spotifyFetch(
      `/artists/${artistId}/related-artists`
    );
    if (related.artists?.length) {
      const picks = related.artists.slice(0, 5);
      const all = [];
      for (const a of picks) {
        try {
          const data = await spotifyFetch(`/artists/${a.id}/top-tracks`, {
            market: "US",
          });
          all.push(
            ...data.tracks.slice(0, 3).map((t) => ({
              ...formatTrack(t),
              _artistId: a.id,
            }))
          );
        } catch {
          /* skip */
        }
      }
      if (all.length) {
        const seen = new Set();
        return all
          .filter((t) => {
            const key = t.artists[0]?.id;
            if (key === artistId || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 10);
      }
    }
  } catch (err) {
    console.log("related-artists endpoint unavailable:", err.message);
  }

  // Attempt 2: genre-based search — works on every Spotify tier
  const results = [];
  const seen = new Set();
  seen.add(artistId);

  const queries = buildDiscoveryQueries(artistName, genres);

  for (const q of queries) {
    if (results.length >= 10) break;
    try {
      const data = await spotifyFetch("/search", { q, type: "track", limit: 10 });
      for (const t of data.tracks?.items || []) {
        const aid = t.artists[0]?.id;
        if (aid === artistId || seen.has(aid)) continue;
        seen.add(aid);
        results.push(formatTrack(t));
        if (results.length >= 10) break;
      }
    } catch {
      /* skip query */
    }
  }

  return results;
}

/**
 * Build a series of search queries that progressively widen the net,
 * using genre tags when available and falling back to the artist name
 * as a contextual cue.
 */
function buildDiscoveryQueries(artistName, genres) {
  const queries = [];

  if (genres.length >= 2) {
    queries.push(`genre:"${genres[0]}" genre:"${genres[1]}"`);
  }
  if (genres.length >= 1) {
    queries.push(`genre:"${genres[0]}"`);
  }
  // Spotify search treats unquoted terms as contextual suggestions
  queries.push(`${artistName}`);
  if (genres.length >= 3) {
    queries.push(`genre:"${genres[2]}"`);
  }
  queries.push(`genre:"${genres[0] || "pop"}"`);

  return queries;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
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
