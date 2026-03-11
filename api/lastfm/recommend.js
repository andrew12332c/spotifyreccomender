import {
  getSimilarTracks,
  getSimilarArtists,
  getArtistTopTracks,
} from "./_lastfm.js";
import { spotifyFetch } from "../spotify/_spotify.js";

/**
 * GET /api/lastfm/recommend?trackName=…&artistName=…&seedArtistId=…
 *
 * Uses Last.fm's scrobble-based similarity data (track.getSimilar and
 * artist.getSimilar) to find recommendations, then maps them to playable
 * Spotify tracks.  Returns two arrays:
 *   - lastfmSimilar: tracks similar to the seed (same-vibe, scrobble-correlated)
 *   - lastfmArtists: top tracks from similar artists (broader discovery)
 */
export default async function handler(req, res) {
  const { trackName, artistName, seedArtistId } = req.query;

  if (!trackName || !artistName) {
    return res
      .status(400)
      .json({ error: "Missing trackName or artistName parameter" });
  }

  try {
    const [similarTracks, similarArtists] = await Promise.all([
      getSimilarTracks(trackName, artistName, 15).catch(() => []),
      getSimilarArtists(artistName, 8).catch(() => []),
    ]);

    // --- Similar tracks (scrobble-correlated) ---
    const simMapped = await mapToSpotify(similarTracks, seedArtistId);

    // --- Similar-artist top tracks ---
    const artistCandidates = [];
    const batchResults = await Promise.allSettled(
      similarArtists.map((a) => getArtistTopTracks(a.name, 3))
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") artistCandidates.push(...r.value);
    }
    const artMapped = await mapToSpotify(artistCandidates, seedArtistId);

    // Deduplicate artist-based tracks against the similar set
    const simIds = new Set(simMapped.map((t) => t.id));
    const uniqueArt = artMapped.filter((t) => !simIds.has(t.id));

    res.json({
      lastfmSimilar: simMapped.slice(0, 8),
      lastfmArtists: uniqueArt.slice(0, 6),
    });
  } catch (err) {
    console.error("Last.fm recommend error:", err.message);
    res.json({ lastfmSimilar: [], lastfmArtists: [] });
  }
}

/**
 * Map an array of { name, artist } candidates to Spotify tracks.
 * Silently skips any candidate that can't be resolved.
 */
async function mapToSpotify(candidates, seedArtistId) {
  const results = await Promise.allSettled(
    candidates.map(async (c) => {
      const q = `track:${c.name} artist:${c.artist}`;
      const data = await spotifyFetch("/search", {
        q,
        type: "track",
        limit: 1,
      });
      const hit = data.tracks?.items?.[0];
      if (!hit) return null;
      return {
        ...formatTrack(hit),
        source: "lastfm",
        lastfmMatch: c.match,
      };
    })
  );

  const seen = new Set();
  const mapped = [];

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const track = r.value;
    const aid = track.artists[0]?.id;
    if (aid === seedArtistId) continue;
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    mapped.push(track);
  }

  return mapped;
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
