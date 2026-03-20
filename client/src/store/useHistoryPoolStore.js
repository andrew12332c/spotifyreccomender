import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_POOL = 200;

/**
 * Caching layer: accumulates all recommendation results from previous searches.
 * When a new search fires, 4 tracks are surfaced from this pool as
 * "From Your History" — zero API calls required.
 */
const useHistoryPoolStore = create(
  persist(
    (set, get) => ({
      historyPool: [],
      fromHistory: [],

      /**
       * Merge a batch of track objects into the pool (deduped by id).
       * Only tracks with valid id, name, artists, and album data are kept.
       */
      saveToPool: (tracks) => {
        if (!tracks || !tracks.length) return;
        const current = get().historyPool;
        const existingIds = new Set(current.map((t) => t.id));

        const normalized = tracks
          .filter(
            (t) =>
              t &&
              t.id &&
              t.name &&
              Array.isArray(t.artists) &&
              t.artists.length > 0 &&
              t.album
          )
          .filter((t) => !existingIds.has(t.id))
          .map((t) => ({
            id: t.id,
            name: t.name,
            artists: t.artists,
            album: {
              name: t.album.name || "",
              image: t.album.image || "",
              imageSmall: t.album.imageSmall || t.album.image || "",
            },
            durationMs: t.durationMs || null,
            externalUrl: t.externalUrl || null,
            source: t.source || null,
          }));

        const updated = [...normalized, ...current].slice(0, MAX_POOL);
        set({ historyPool: updated });
      },

      /**
       * Randomly pick up to 4 tracks from the pool that are not in excludeIds.
       * Saves them into fromHistory for the UI to display.
       */
      pickFromHistory: (excludeIds = new Set()) => {
        const pool = get().historyPool;
        const candidates = pool.filter((t) => !excludeIds.has(t.id));
        if (!candidates.length) {
          set({ fromHistory: [] });
          return;
        }
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        set({ fromHistory: shuffled.slice(0, 4) });
      },

      clearFromHistory: () => set({ fromHistory: [] }),
    }),
    { name: "spotify-rec-history-pool" }
  )
);

export default useHistoryPoolStore;
