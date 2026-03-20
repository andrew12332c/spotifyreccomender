const BASE = "https://ws.audioscrobbler.com/2.0/";

function getApiKey() {
  const key = process.env.LASTFM_API_KEY;
  if (!key) throw new Error("Missing LASTFM_API_KEY env var");
  return key;
}

export async function lastfmFetch(method, params = {}) {
  const url = new URL(BASE);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Last.fm ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  return data;
}

/**
 * Get tracks similar to a given track.
 * Returns up to `limit` results with name, artist, playcount, and Last.fm URL.
 */
export async function getSimilarTracks(trackName, artistName, limit = 10) {
  const data = await lastfmFetch("track.getSimilar", {
    track: trackName,
    artist: artistName,
    limit,
    autocorrect: 1,
  });
  return (data.similartracks?.track || []).map((t) => ({
    name: t.name,
    artist: t.artist?.name || "",
    playcount: Number(t.playcount) || 0,
    lastfmUrl: t.url,
    match: Number(t.match) || 0,
    image: extractImage(t.image),
  }));
}

/**
 * Get artists similar to a given artist.
 */
export async function getSimilarArtists(artistName, limit = 10) {
  const data = await lastfmFetch("artist.getSimilar", {
    artist: artistName,
    limit,
    autocorrect: 1,
  });
  return (data.similarartists?.artist || []).map((a) => ({
    name: a.name,
    match: Number(a.match) || 0,
    lastfmUrl: a.url,
  }));
}

/**
 * Get top tracks for an artist.
 */
export async function getArtistTopTracks(artistName, limit = 5) {
  const data = await lastfmFetch("artist.getTopTracks", {
    artist: artistName,
    limit,
    autocorrect: 1,
  });
  return (data.toptracks?.track || []).map((t) => ({
    name: t.name,
    artist: artistName,
    playcount: Number(t.playcount) || 0,
    lastfmUrl: t.url,
    image: extractImage(t.image),
  }));
}

function extractImage(images) {
  if (!Array.isArray(images)) return "";
  return (
    images.find((img) => img.size === "medium")?.["#text"] ||
    images.find((img) => img.size === "small")?.["#text"] ||
    images.find((img) => img.size === "large")?.["#text"] ||
    ""
  );
}
