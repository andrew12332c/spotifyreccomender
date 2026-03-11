const MB_BASE = "https://musicbrainz.org/ws/2";
const LB_BASE = "https://api.listenbrainz.org/1";
const UA = "SpotifyRecommendationApp/1.0 (https://github.com/user/SpotifyRecommendation)";

// MusicBrainz enforces a strict 1-request-per-second rate limit per IP.
let lastMBCall = 0;

async function throttleMB() {
  const elapsed = Date.now() - lastMBCall;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastMBCall = Date.now();
}

export async function mbFetch(endpoint, params = {}) {
  await throttleMB();
  const url = new URL(`${MB_BASE}${endpoint}`);
  url.searchParams.set("fmt", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MusicBrainz ${res.status}: ${body}`);
  }
  return res.json();
}

export async function lbFetch(endpoint) {
  const url = `${LB_BASE}${endpoint}`;
  const headers = { "User-Agent": UA, Accept: "application/json" };
  const token = process.env.LISTENBRAINZ_USER_TOKEN;
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ListenBrainz ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Resolve an artist name to a MusicBrainz ID.
 * Prefers an exact-match on name; falls back to the highest-scored result.
 */
export async function lookupArtistMBID(artistName) {
  const sanitized = artistName.replace(/"/g, '\\"');
  const data = await mbFetch("/artist/", {
    query: `artist:"${sanitized}"`,
    limit: 5,
  });
  const artists = data.artists || [];
  const exact = artists.find(
    (a) => a.name.toLowerCase() === artistName.toLowerCase()
  );
  return (exact || artists[0])?.id ?? null;
}

/**
 * Fetch the community-voted tags for an artist (genre / style descriptors).
 */
export async function getArtistTags(mbid) {
  const data = await mbFetch(`/artist/${mbid}`, { inc: "tags" });
  return (data.tags || [])
    .filter((t) => (t.count || 0) > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((t) => t.name);
}

/**
 * Collaborative-filtering via shared tags: find artists that share the
 * same community-voted tags as the seed, mimicking "what similar listeners
 * also enjoy" without needing a logged-in ListenBrainz user.
 */
export async function findSimilarArtists(mbid, seedName, limit = 15) {
  const tags = await getArtistTags(mbid);
  if (!tags.length) return [];

  const tagQuery = tags
    .slice(0, 3)
    .map((t) => `tag:"${t}"`)
    .join(" AND ");
  const data = await mbFetch("/artist/", {
    query: tagQuery,
    limit: limit + 5,
  });

  return (data.artists || [])
    .filter(
      (a) =>
        a.id !== mbid &&
        a.name.toLowerCase() !== seedName.toLowerCase() &&
        (a.score ?? 100) > 50
    )
    .slice(0, limit);
}

/**
 * Pull popular recordings for a given artist from ListenBrainz.
 * Falls back to a MusicBrainz recording search if LB is unavailable.
 */
export async function getTopRecordings(artistMBID) {
  try {
    const data = await lbFetch(
      `/popularity/top-recordings-for-artist/${artistMBID}`
    );
    return (Array.isArray(data) ? data : []).slice(0, 5);
  } catch {
    try {
      const data = await mbFetch("/recording/", {
        query: `arid:${artistMBID}`,
        limit: 5,
      });
      return (data.recordings || []).map((r) => ({
        recording_name: r.title,
        artist_name: r["artist-credit"]?.[0]?.name || "",
        recording_mbid: r.id,
      }));
    } catch {
      return [];
    }
  }
}
