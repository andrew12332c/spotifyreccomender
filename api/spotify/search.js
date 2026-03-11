import { spotifyFetch } from "./_spotify.js";

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  try {
    const data = await spotifyFetch("/search", {
      q,
      type: "track",
      limit: 10,
    });

    const tracks = data.tracks.items.map(formatTrack);
    res.json({ tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
