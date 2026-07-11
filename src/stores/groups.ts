import { create } from "zustand";
import type { GroupRow } from "../types/api";
import { api } from "../api/client";

interface GroupsState {
  groups: GroupRow[];
  loaded: boolean;
  renameTarget: GroupRow | null;
  renameValue: string;

  load: () => Promise<void>;
  create: (name: string) => Promise<GroupRow | null>;
  setRenameValue: (v: string) => void;
  renameStart: (g: GroupRow) => void;
  renameCommit: () => Promise<void>;
  renameCancel: () => void;
  remove: (id: number) => Promise<void>;
  assign: (groupName: string, skillPath: string) => Promise<void>;
  unassign: (groupName: string, skillPath: string) => Promise<void>;
}

export const useGroups = create<GroupsState>((set, get) => ({
  groups: [],
  loaded: false,
  renameTarget: null,
  renameValue: "",

  load: async () => {
    try {
      const groups = await api.groups();
      set({ groups, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  create: async (name) => {
    try {
      const g = await api.createGroup(name);
      await get().load();
      return g;
    } catch {
      return null;
    }
  },

  renameStart: (g) => set({ renameTarget: g, renameValue: g.name }),
  setRenameValue: (v) => set({ renameValue: v }),
  renameCommit: async () => {
    const { renameTarget, renameValue } = get();
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await api.renameGroup(renameTarget.id, renameValue.trim());
    } finally {
      set({ renameTarget: null, renameValue: "" });
      await get().load();
    }
  },
  renameCancel: () => set({ renameTarget: null, renameValue: "" }),

  remove: async (id) => {
    try {
      await api.deleteGroup(id);
      await get().load();
    } catch {
      /* ignore */
    }
  },

  assign: async (groupName, skillPath) => {
    try {
      await api.assignGroup(groupName, skillPath);
      await get().load();
    } catch {
      /* ignore */
    }
  },

  unassign: async (groupName, skillPath) => {
    try {
      await api.unassignGroup(groupName, skillPath);
      await get().load();
    } catch {
      /* ignore */
    }
  },
}));
