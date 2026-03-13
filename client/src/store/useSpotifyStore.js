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

    const historyIds = useHistoryStore.getState().history.map((t) => t.id);
    const playlistIds = usePlaylistStore.getState().playlist.map((t) => t.id);

    if (historyIds.length === 0 && playlistIds.length === 0) return;

    set({ isLoadingForYou: true });

    try {
      const params = new URLSearchParams();
      if (historyIds.length) params.set("historyIds", historyIds.slice(0, 10).join(","));
      if (playlistIds.length) params.set("playlistIds", playlistIds.slice(0, 10).join(","));

      const res = await fetch(`/api/spotify/personalized?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Personalized failed (${res.status})`);
      }
      const data = await res.json();
      set({ forYou: data.forYou || [], isLoadingForYou: false, forYouLoaded: true });
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
