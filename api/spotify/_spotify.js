let tokenCache = { token: null, expiresAt: 0 };

export async function getSpotifyToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET env vars");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return tokenCache.token;
}

const MAX_RETRIES = 3;

export async function spotifyFetch(endpoint, params = {}) {
  const url = new URL(`https://api.spotify.com/v1${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getSpotifyToken();
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "1", 10);
      const waitMs = Math.max(retryAfter, 1) * 1000;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }

    if (res.status === 401 && attempt < MAX_RETRIES) {
      tokenCache = { token: null, expiresAt: 0 };
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify API ${res.status}: ${body}`);
    }

    return res.json();
  }
}
