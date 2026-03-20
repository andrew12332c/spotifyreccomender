import {
  lookupArtistMBID,
  findSimilarArtists,
  getTopRecordings,
} from "./_listenbrainz.js";

/**
 * GET /api/listenbrainz/recommend?artistName=…&trackName=…&seedArtistId=…
 *
 * Returns up to 5 "wildcard" tracks sourced via MusicBrainz collaborative-
 * filtering (tag similarity) and ListenBrainz popularity data.
 */
export default async function handler(req, res) {
  const { artistName } = req.query;

  if (!artistName) {
    return res.status(400).json({ error: "Missing artistName parameter" });
  }

  try {
    // 1. Resolve the seed artist to a MusicBrainz ID
    const artistMBID = await lookupArtistMBID(artistName);
    if (!artistMBID) {
      return res.json({ wildcards: [] });
    }

    // 2. Tag-based collaborative filtering for similar artists
    const similar = await findSimilarArtists(artistMBID, artistName, 12);
    if (!similar.length) {
      return res.json({ wildcards: [] });
    }

    // 3. Pull popular recordings from ListenBrainz (parallelized — no rate limit)
    const batches = await Promise.allSettled(
      similar.slice(0, 8).map((artist) =>
        getTopRecordings(artist.id).then((recs) =>
          recs.map((r) => ({
            recordingName: r.recording_name || r.title || "",
            artistName: r.artist_name || artist.name,
            recordingMBID: r.recording_mbid || r.id || "",
            releaseMBID:
              r.release_mbid ||
              r.release?.id ||
              r.release_id ||
              "",
          }))
        )
      )
    );

    const candidates = batches
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .filter((c) => c.recordingName);

    if (!candidates.length) {
      return res.json({ wildcards: [] });
    }

    // 4. Convert to local track objects, deduplicate by artist
    const seen = new Set();
    const wildcards = [];

    for (const candidate of candidates.slice(0, 24)) {
      const track = formatCandidate(candidate);
      const primaryArtistId = track.artists[0]?.id;
      if (seen.has(primaryArtistId)) continue;
      seen.add(primaryArtistId);

      wildcards.push(track);
      if (wildcards.length >= 5) break;
    }

    res.json({ wildcards });
  } catch (err) {
    console.error("ListenBrainz recommend error:", err.message);
    res.json({ wildcards: [] });
  }
}

function formatCandidate(c) {
  const artistName = c.artistName || "Unknown Artist";
  const trackName = c.recordingName || "Unknown Track";
  const coverUrl = c.releaseMBID
    ? `https://coverartarchive.org/release/${c.releaseMBID}/front-250`
    : "";
  return {
    id: c.recordingMBID || `lb:${slug(trackName)}:${slug(artistName)}`,
    name: trackName,
    artists: [{ id: `lb-artist:${slug(artistName)}`, name: artistName }],
    album: {
      name: "ListenBrainz",
      image: coverUrl,
      imageSmall: coverUrl,
    },
    previewUrl: null,
    externalUrl: null,
    popularity: null,
    durationMs: null,
    source: "listenbrainz",
    mbid: c.recordingMBID || null,
  };
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
