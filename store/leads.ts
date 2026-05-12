import { create } from "zustand";
import { persist } from "zustand/middleware";

type LeadsState = {
  sendListIds: string[];
  toggleSendListId: (id: string) => void;
  addSendListIds: (ids: string[]) => void;
  clearSendList: () => void;
  removeSendListIds: (ids: string[]) => void;
};

export const useLeadsStore = create<LeadsState>()(
  persist(
    (set, get) => ({
      sendListIds: [],
      toggleSendListId: (id) =>
        set(() => {
          const cur = get().sendListIds;
          return {
            sendListIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
          };
        }),
      addSendListIds: (ids) =>
        set((s) => ({
          sendListIds: [...new Set([...s.sendListIds, ...ids])],
        })),
      clearSendList: () => set({ sendListIds: [] }),
      removeSendListIds: (ids) =>
        set((s) => ({
          sendListIds: s.sendListIds.filter((x) => !ids.includes(x)),
        })),
    }),
    {
      name: "leads-send-queue",
      partialize: (s) => ({ sendListIds: s.sendListIds }),
    },
  ),
);
