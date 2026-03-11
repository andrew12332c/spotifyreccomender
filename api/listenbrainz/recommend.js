import {
  lookupArtistMBID,
  findSimilarArtists,
  getTopRecordings,
} from "./_listenbrainz.js";
import { spotifyFetch } from "../spotify/_spotify.js";

/**
 * GET /api/listenbrainz/recommend?artistName=…&trackName=…&seedArtistId=…
 *
 * Returns up to 5 "wildcard" tracks sourced via MusicBrainz collaborative-
 * filtering (tag similarity) and ListenBrainz popularity data, then mapped
 * back to playable Spotify tracks.
 *
 * If any individual candidate cannot be resolved on Spotify it is silently
 * skipped (fallback logic).
 */
export default async function handler(req, res) {
  const { artistName, trackName, seedArtistId } = req.query;

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

    // 4. Map each candidate to a Spotify track via search (parallel, cap 20)
    const spotifyResults = await Promise.allSettled(
      candidates.slice(0, 20).map(async (c) => {
        const q = `track:${c.recordingName} artist:${c.artistName}`;
        const data = await spotifyFetch("/search", {
          q,
          type: "track",
          limit: 1,
        });
        const hit = data.tracks?.items?.[0];
        if (!hit) return null;
        return {
          ...formatTrack(hit),
          source: "listenbrainz",
          mbid: c.recordingMBID,
        };
      })
    );

    // 5. Collect, deduplicate by artist, exclude seed
    const seen = new Set();
    const wildcards = [];

    for (const result of spotifyResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const track = result.value;
      const primaryArtistId = track.artists[0]?.id;

      if (primaryArtistId === seedArtistId) continue;
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
