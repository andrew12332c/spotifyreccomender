import { lastfmFetch } from "../lastfm/_lastfm.js";

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  try {
    const data = await lastfmFetch("track.search", {
      track: q,
      limit: 10,
    });
    const tracks = (data.results?.trackmatches?.track || []).map(formatTrack);
    res.json({ tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function formatTrack(t) {
  const artistName = t.artist || "Unknown Artist";
  const image = getLastfmImage(t);
  const id = makeTrackId(t.name || "unknown", artistName);
  return {
    id,
    name: t.name,
    artists: [{ id: makeArtistId(artistName), name: artistName }],
    album: {
      name: "Last.fm Result",
      image,
      imageSmall: image,
    },
    previewUrl: null,
    externalUrl: t.url || null,
    popularity: null,
    durationMs: null,
  };
}

function getLastfmImage(t) {
  if (Array.isArray(t.image)) {
    return (
      t.image.find((img) => img.size === "medium")?.["#text"] ||
      t.image.find((img) => img.size === "small")?.["#text"] ||
      t.image.find((img) => img.size === "large")?.["#text"] ||
      ""
    );
  }
  return "";
}

function makeTrackId(name, artist) {
  return `lfm:${slug(name)}:${slug(artist)}`;
}

function makeArtistId(artist) {
  return `lfm-artist:${slug(artist)}`;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
