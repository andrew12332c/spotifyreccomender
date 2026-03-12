import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_HISTORY = 50;

const useHistoryStore = create(
  persist(
    (set, get) => ({
      history: [],

      addToHistory: (track) => {
        const filtered = get().history.filter((t) => t.id !== track.id);
        set({ history: [track, ...filtered].slice(0, MAX_HISTORY) });
      },

      removeFromHistory: (trackId) => {
        set({ history: get().history.filter((t) => t.id !== trackId) });
      },

      clearHistory: () => set({ history: [] }),
    }),
    { name: "spotify-rec-history" }
  )
);

export default useHistoryStore;
