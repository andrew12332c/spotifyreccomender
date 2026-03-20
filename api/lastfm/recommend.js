import {
  getSimilarTracks,
  getSimilarArtists,
  getArtistTopTracks,
} from "./_lastfm.js";

/**
 * GET /api/lastfm/recommend?trackName=…&artistName=…&seedArtistId=…
 *
 * Uses Last.fm's scrobble-based similarity data (track.getSimilar and
 * artist.getSimilar) to find recommendations. Returns two arrays:
 *   - lastfmSimilar: tracks similar to the seed (same-vibe, scrobble-correlated)
 *   - lastfmArtists: top tracks from similar artists (broader discovery)
 */
export default async function handler(req, res) {
  const { trackName, artistName } = req.query;

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
    const simMapped = mapCandidates(similarTracks, "lastfm-similar");

    // --- Similar-artist top tracks ---
    const artistCandidates = [];
    const batchResults = await Promise.allSettled(
      similarArtists.map((a) => getArtistTopTracks(a.name, 3))
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") artistCandidates.push(...r.value);
    }
    const artMapped = mapCandidates(artistCandidates, "lastfm-artist");

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

function mapCandidates(candidates, idPrefix) {
  const seen = new Set();
  const mapped = [];
  for (const c of candidates) {
    const track = formatCandidate(c, idPrefix);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    mapped.push(track);
  }
  return mapped;
}

function formatCandidate(c, idPrefix) {
  const artistName = c.artist || "Unknown Artist";
  const trackName = c.name || "Unknown Track";
  const id = `${idPrefix}:${slug(trackName)}:${slug(artistName)}`;
  return {
    id,
    name: trackName,
    artists: [{ id: `lfm-artist:${slug(artistName)}`, name: artistName }],
    album: {
      name: "Last.fm",
      image: c.image || "",
      imageSmall: c.image || "",
    },
    previewUrl: null,
    externalUrl: c.lastfmUrl || null,
    popularity: c.playcount || null,
    durationMs: null,
    source: "lastfm",
    lastfmMatch: c.match,
  };
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
