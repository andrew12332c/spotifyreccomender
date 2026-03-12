import { create } from "zustand";
import { persist } from "zustand/middleware";

const usePlaylistStore = create(
  persist(
    (set, get) => ({
      playlist: [],

      addToPlaylist: (track) => {
        if (get().playlist.some((t) => t.id === track.id)) return;
        set({ playlist: [...get().playlist, track] });
      },

      removeFromPlaylist: (trackId) => {
        set({ playlist: get().playlist.filter((t) => t.id !== trackId) });
      },

      clearPlaylist: () => set({ playlist: [] }),

      isInPlaylist: (trackId) => get().playlist.some((t) => t.id === trackId),
    }),
    { name: "spotify-rec-playlist" }
  )
);

export default usePlaylistStore;
