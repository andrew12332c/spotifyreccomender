import { create } from "zustand";
import useDiscoveryStore from "./useDiscoveryStore";
import useLastfmStore from "./useLastfmStore";
import useHistoryStore from "./useHistoryStore";
import usePlaylistStore from "./usePlaylistStore";

const useSpotifyStore = create((set) => ({
  query: "",
  searchResults: [],
  isSearching: false,

  selectedTrack: null,

  similar: [],
  discovery: [],
  isLoadingRecs: false,

  error: null,

  hasAutoLoaded: false,

  // Personalized "For You" section
  forYou: [],
  forYouSources: {},
  isLoadingForYou: false,
  forYouLoaded: false,

  setQuery: (query) => set({ query }),

  search: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true, error: null });

    try {
      const res = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Search failed (${res.status})`);
      }
      const data = await res.json();
      set({ searchResults: data.tracks, isSearching: false });
    } catch (err) {
      set({ error: err.message, isSearching: false });
    }
  },

  selectTrack: async (track) => {
    useHistoryStore.getState().addToHistory(track);

    set({
      selectedTrack: track,
      searchResults: [],
      query: "",
      isLoadingRecs: true,
      similar: [],
      discovery: [],
      error: null,
    });

    const artistName = track.artists[0]?.name;
    const artistId = track.artists[0]?.id;

    useDiscoveryStore.getState().fetchWildcards(artistName, track.name, artistId);
    useLastfmStore.getState().fetchLastfm(track.name, artistName, artistId);

    try {
      const res = await fetch(
        `/api/spotify/recommend?trackId=${track.id}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Recommendations failed (${res.status})`);
      }
      const data = await res.json();
      set({
        similar: data.similar,
        discovery: data.discovery,
        isLoadingRecs: false,
      });
    } catch (err) {
      set({ error: err.message, isLoadingRecs: false });
    }
  },

  fetchPersonalized: async () => {
    const state = useSpotifyStore.getState();
    if (state.forYouLoaded || state.isLoadingForYou) return;

    const historyTracks = useHistoryStore.getState().history;
    const playlistTracks = usePlaylistStore.getState().playlist;

    if (historyTracks.length === 0 && playlistTracks.length === 0) return;

    set({ isLoadingForYou: true });

    try {
      const toSeed = (t) => ({
        id: t.id,
        name: t.name,
        artist: t.artists[0]?.name || "",
      });

      const historySeeds = historyTracks.slice(0, 5).map(toSeed);
      const playlistSeeds = playlistTracks.slice(0, 3).map(toSeed);
      const seeds = [...historySeeds, ...playlistSeeds];

      const unique = [];
      const seenIds = new Set();
      for (const s of seeds) {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          unique.push(s);
        }
      }

      const params = new URLSearchParams();
      params.set("seeds", JSON.stringify(unique.slice(0, 8)));

      const res = await fetch(`/api/spotify/personalized?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Personalized failed (${res.status})`);
      }
      const data = await res.json();
      set({
        forYou: data.forYou || [],
        forYouSources: data.sources || {},
        isLoadingForYou: false,
        forYouLoaded: true,
      });
    } catch {
      set({ isLoadingForYou: false, forYouLoaded: true });
    }
  },

  autoLoadFromHistory: () => {
    const state = useSpotifyStore.getState();
    if (state.hasAutoLoaded || state.selectedTrack) return;
    set({ hasAutoLoaded: true });

    const history = useHistoryStore.getState().history;
    if (history.length > 0) {
      state.selectTrack(history[0]);
    }
  },

  clearSelection: () => {
    useDiscoveryStore.getState().clearWildcards();
    useLastfmStore.getState().clearLastfm();
    set({
      selectedTrack: null,
      similar: [],
      discovery: [],
      error: null,
    });
  },
}));

export default useSpotifyStore;
