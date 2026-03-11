import { create } from "zustand";

/**
 * Manages ListenBrainz-sourced "wildcard" recommendations separately from the
 * Spotify auth flow.  Fetched in parallel with the main Spotify recs so the UI
 * can show partial results progressively.
 */
const useDiscoveryStore = create((set) => ({
  wildcards: [],
  isLoadingWildcards: false,
  wildcardError: null,

  fetchWildcards: async (artistName, trackName, seedArtistId) => {
    set({ isLoadingWildcards: true, wildcards: [], wildcardError: null });

    try {
      const params = new URLSearchParams({ artistName });
      if (trackName) params.set("trackName", trackName);
      if (seedArtistId) params.set("seedArtistId", seedArtistId);

      const res = await fetch(`/api/listenbrainz/recommend?${params}`);
      if (!res.ok) throw new Error("ListenBrainz recommendations unavailable");

      const data = await res.json();
      set({ wildcards: data.wildcards || [], isLoadingWildcards: false });
    } catch (err) {
      set({
        wildcards: [],
        isLoadingWildcards: false,
        wildcardError: err.message,
      });
    }
  },

  clearWildcards: () =>
    set({ wildcards: [], isLoadingWildcards: false, wildcardError: null }),
}));

export default useDiscoveryStore;
