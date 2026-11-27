// Conserva la pestaña de seguridad seleccionada.
import type { StateCreator } from 'zustand';

export type CurarSubTab = 'antivirus' | 'screenshot';

export interface PatcherSlice {
  curarSubTab: CurarSubTab;

  setCurarSubTab: (tab: CurarSubTab) => void;
}

export const createPatcherSlice: StateCreator<PatcherSlice, [], [], PatcherSlice> = (set) => ({
  curarSubTab: 'antivirus',

  setCurarSubTab: (tab) => set({ curarSubTab: tab }),
});
