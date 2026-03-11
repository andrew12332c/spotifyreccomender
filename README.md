# Spotify Hybrid Recommendation Engine

A music discovery app that combines **Spotify**, **Last.fm**, and **ListenBrainz / MusicBrainz** to break the "filter bubble" and surface artists you'd never find through a single algorithm.

## How It Works

Search for any song. The engine returns five layers of recommendations from three independent data sources:

| Layer | Source | What it finds |
|---|---|---|
| **Similar Tracks** | Spotify search (artist + genre) | Tight matches — same vibe, may include the same artist |
| **Discover Something New** | Spotify search (genre-seeded) | Different artists with matching genre |
| **Scrobble Matches** | Last.fm `track.getSimilar` | Tracks that real listeners play alongside this song |
| **Similar Artist Picks** | Last.fm `artist.getSimilar` → top tracks | Top tracks from artists that Last.fm listeners also love |
| **Wildcard Discoveries** | MusicBrainz tags + ListenBrainz popularity | Artists that *similar listeners* enjoy — true collaborative filtering |

All three pipelines run in parallel. Spotify results appear first; Last.fm and ListenBrainz sections stream in as they resolve. If any source fails, the others still display.

### Data Flow

```
User picks a seed track
  │
  ├─ Spotify pipeline (fast)
  │    ├─ Track + artist + genre metadata
  │    ├─ Artist search → Similar Tracks
  │    └─ Genre search → Discovery Tracks
  │
  ├─ Last.fm pipeline (parallel, non-blocking)
  │    ├─ track.getSimilar → Scrobble Matches
  │    ├─ artist.getSimilar → related artists
  │    ├─ artist.getTopTracks for each → Similar Artist Picks
  │    └─ Spotify Search: map results to playable tracks
  │
  └─ ListenBrainz pipeline (parallel, non-blocking)
       ├─ MusicBrainz: artist name → MBID → community tags
       ├─ MusicBrainz: tag-intersection search → similar artists
       ├─ ListenBrainz: top recordings for each similar artist
       └─ Spotify Search: MBID candidates → playable tracks
           → Wildcard Discoveries
```

### Metadata Mapping

| Feature | Spotify API | Last.fm API | ListenBrainz / MusicBrainz |
|---|---|---|---|
| Artist identity | Spotify URI | Last.fm artist slug | MBID (MusicBrainz ID) |
| Similarity signal | Genre tags, search context | Scrobble co-occurrence | Community-voted tags |
| Discovery method | Content-based (genre/features) | Behavioral (what people actually play) | Collaborative filtering (tag intersection) |

## Tech Stack

- **Frontend** — React 18, Chakra UI (dark theme), Zustand state management, Vite
- **Backend** — Node.js HTTP server, Spotify Web API (Client Credentials), Last.fm API, MusicBrainz API, ListenBrainz API
- **State** — Three Zustand stores, fully decoupled:
  - `useSpotifyStore` — search + Spotify recommendations
  - `useLastfmStore` — Last.fm scrobble matches + similar artist picks
  - `useDiscoveryStore` — ListenBrainz wildcard discoveries

## Project Structure

```
├── api/
│   ├── spotify/
│   │   ├── _spotify.js          # Spotify auth (Client Credentials) & fetch
│   │   ├── search.js            # GET /api/spotify/search?q=…
│   │   └── recommend.js         # GET /api/spotify/recommend?trackId=…
│   ├── lastfm/
│   │   ├── _lastfm.js           # Last.fm API utility
│   │   └── recommend.js         # GET /api/lastfm/recommend?trackName=…&artistName=…
│   ├── listenbrainz/
│   │   ├── _listenbrainz.js     # MusicBrainz & ListenBrainz API utilities
│   │   └── recommend.js         # GET /api/listenbrainz/recommend?artistName=…
│   └── health.js
├── client/
│   └── src/
│       ├── store/
│       │   ├── useSpotifyStore.js
│       │   ├── useLastfmStore.js
│       │   └── useDiscoveryStore.js
│       ├── components/home/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx
│       │   │   └── SearchAndResults.jsx
│       │   └── ui/
│       │       ├── Searchbar.jsx
│       │       └── TrackCard.jsx
│       ├── pages/Home.jsx
│       ├── App.jsx
│       └── main.jsx
├── dev-server.js
├── .env.example
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app (Client ID & Secret)
- A [Last.fm API account](https://www.last.fm/api/account/create) (API Key)
- (Optional) A [ListenBrainz](https://listenbrainz.org/settings/) user token

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials:
#   SPOTIFY_CLIENT_ID=…
#   SPOTIFY_CLIENT_SECRET=…
#   LASTFM_API_KEY=…
#   LISTENBRAINZ_USER_TOKEN=…  (optional)

# 3. Start both servers (two terminals)
npm run dev:api      # API server → http://localhost:3001
npm run dev:client   # Vite client → http://localhost:5173
```

Open `http://localhost:5173`, search for a song, and explore.

## API Endpoints

### `GET /api/spotify/search?q=<query>`
Search Spotify tracks. Returns up to 10 results.

### `GET /api/spotify/recommend?trackId=<id>`
Fetch similar + discovery tracks from Spotify for a given seed track.

### `GET /api/lastfm/recommend?trackName=<name>&artistName=<name>&seedArtistId=<id>`
Fetch scrobble-correlated similar tracks and similar-artist top tracks from Last.fm, mapped to playable Spotify tracks. Returns `lastfmSimilar` (up to 8) and `lastfmArtists` (up to 6).

### `GET /api/listenbrainz/recommend?artistName=<name>&trackName=<name>&seedArtistId=<id>`
Fetch wildcard discoveries via MusicBrainz collaborative filtering and ListenBrainz popularity. Returns up to 5 tracks. All parameters except `artistName` are optional.

### `GET /api/health`
Health check.

## Design Decisions

- **Three independent engines.** Spotify, Last.fm, and ListenBrainz each use fundamentally different similarity signals (genre metadata, scrobble behavior, community tags). Combining them produces more diverse results than any single source.
- **Parallel fetching, progressive display.** All three pipelines fire simultaneously. Spotify results appear first; Last.fm and ListenBrainz stream in independently. Failure of one source never blocks the others.
- **Separate Zustand stores.** Each data source has its own store (`useSpotifyStore`, `useLastfmStore`, `useDiscoveryStore`), keeping auth flows and error handling fully decoupled.
- **Basic-tier Spotify compatibility.** The Spotify pipeline works entirely with `/search` and `/artists` endpoints, avoiding restricted endpoints (`/recommendations`, `/audio-features`, `/related-artists`) that require extended access.
- **Silent fallback everywhere.** If a Last.fm or ListenBrainz candidate can't be resolved to a Spotify track, it's silently skipped. If an entire pipeline fails, its section simply shows empty.
- **Cross-source deduplication.** The UI deduplicates tracks across all three sources so you never see the same song twice.

## License

MIT
