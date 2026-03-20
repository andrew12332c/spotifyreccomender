import { create } from "zustand";
import useDiscoveryStore from "./useDiscoveryStore";
import useLastfmStore from "./useLastfmStore";
import useHistoryStore from "./useHistoryStore";
import useHistoryPoolStore from "./useHistoryPoolStore";

const useSpotifyStore = create((set, get) => ({
  query: "",
  searchResults: [],
  isSearching: false,

  selectedTrack: null,

  similar: [],
  discovery: [],
  isLoadingRecs: false,

  error: null,

  hasAutoLoaded: false,

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
    // --- Cache-based "From Your History" logic (no API calls) ---
    // 1. Collect all recommendation tracks currently loaded from every store
    const { similar: prevSimilar, discovery: prevDiscovery } = get();
    const prevLastfmSimilar = useLastfmStore.getState().lastfmSimilar;
    const prevLastfmArtists = useLastfmStore.getState().lastfmArtists;
    const prevWildcards = useDiscoveryStore.getState().wildcards;

    const allPrevRecs = [
      ...prevSimilar,
      ...prevDiscovery,
      ...prevLastfmSimilar,
      ...prevLastfmArtists,
      ...prevWildcards,
    ].filter(Boolean);

    // 2. Push those recs into the persistent pool
    useHistoryPoolStore.getState().saveToPool(allPrevRecs);

    // 3. Pick 4 from the pool (excluding the track the user just clicked)
    useHistoryPoolStore.getState().pickFromHistory(new Set([track.id]));

    // --- Standard recommendation flow ---
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
    useHistoryPoolStore.getState().clearFromHistory();
    set({
      selectedTrack: null,
      similar: [],
      discovery: [],
      error: null,
    });
  },
}));

export default useSpotifyStore;
