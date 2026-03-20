export default async function handler(req, res) {
  const { trackId } = req.query;
  if (!trackId) return res.status(400).json({ error: "Missing trackId" });
  // Spotify-free mode: main recommendation sections are sourced from
  // /api/lastfm/recommend and /api/listenbrainz/recommend.
  res.json({
    seed: null,
    similar: [],
    discovery: [],
  });
}
