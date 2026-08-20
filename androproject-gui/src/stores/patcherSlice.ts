// ── Patcher Slice — app patching, cloning, antivirus ──────────────
import type { StateCreator } from 'zustand';

export type CurarSubTab = 'antivirus' | 'screenshot';

export interface PatcherSlice {
  patchPackage: string;
  isPatching: boolean;
  patchLogs: string;
  isCloneMode: boolean;
  curarSubTab: CurarSubTab;

  setPatchPackage: (pkg: string) => void;
  setIsPatching: (v: boolean) => void;
  setPatchLogs: (logs: string) => void;
  setIsCloneMode: (v: boolean) => void;
  setCurarSubTab: (tab: CurarSubTab) => void;
}

export const createPatcherSlice: StateCreator<PatcherSlice, [], [], PatcherSlice> = (set) => ({
  patchPackage: '',
  isPatching: false,
  patchLogs: '',
  isCloneMode: false,
  curarSubTab: 'antivirus',

  setPatchPackage: (pkg) => set({ patchPackage: pkg }),
  setIsPatching: (v) => set({ isPatching: v }),
  setPatchLogs: (logs) => set({ patchLogs: logs }),
  setIsCloneMode: (v) => set({ isCloneMode: v }),
  setCurarSubTab: (tab) => set({ curarSubTab: tab }),
});
