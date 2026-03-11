import { create } from "zustand";
import useDiscoveryStore from "./useDiscoveryStore";
import useLastfmStore from "./useLastfmStore";

const useSpotifyStore = create((set) => ({
  query: "",
  searchResults: [],
  isSearching: false,

  selectedTrack: null,

  similar: [],
  discovery: [],
  isLoadingRecs: false,

  error: null,

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
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      set({ searchResults: data.tracks, isSearching: false });
    } catch (err) {
      set({ error: err.message, isSearching: false });
    }
  },

  selectTrack: async (track) => {
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

    // Fire ListenBrainz + Last.fm fetches in parallel (non-blocking)
    useDiscoveryStore.getState().fetchWildcards(artistName, track.name, artistId);
    useLastfmStore.getState().fetchLastfm(track.name, artistName, artistId);

    try {
      const res = await fetch(
        `/api/spotify/recommend?trackId=${track.id}`
      );
      if (!res.ok) throw new Error("Failed to get recommendations");
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
