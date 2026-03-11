import { create } from "zustand";

const useLastfmStore = create((set) => ({
  lastfmSimilar: [],
  lastfmArtists: [],
  isLoadingLastfm: false,
  lastfmError: null,

  fetchLastfm: async (trackName, artistName, seedArtistId) => {
    set({
      isLoadingLastfm: true,
      lastfmSimilar: [],
      lastfmArtists: [],
      lastfmError: null,
    });

    try {
      const params = new URLSearchParams({ trackName, artistName });
      if (seedArtistId) params.set("seedArtistId", seedArtistId);

      const res = await fetch(`/api/lastfm/recommend?${params}`);
      if (!res.ok) throw new Error("Last.fm recommendations unavailable");

      const data = await res.json();
      set({
        lastfmSimilar: data.lastfmSimilar || [],
        lastfmArtists: data.lastfmArtists || [],
        isLoadingLastfm: false,
      });
    } catch (err) {
      set({
        lastfmSimilar: [],
        lastfmArtists: [],
        isLoadingLastfm: false,
        lastfmError: err.message,
      });
    }
  },

  clearLastfm: () =>
    set({
      lastfmSimilar: [],
      lastfmArtists: [],
      isLoadingLastfm: false,
      lastfmError: null,
    }),
}));

export default useLastfmStore;
