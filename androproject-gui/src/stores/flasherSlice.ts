// ── Flasher Slice — ROM flashing, partitions, fastboot ────────────
import type { StateCreator } from 'zustand';

export interface FlasherSlice {
  flashState: string;
  flashInfo: Record<string, string>;
  selectedPartition: string;
  flashFile: File | null;
  flashing: boolean;
  flashProgress: string;

  setFlashState: (s: string) => void;
  setFlashInfo: (info: Record<string, string>) => void;
  setSelectedPartition: (p: string) => void;
  setFlashFile: (f: File | null) => void;
  setFlashing: (v: boolean) => void;
  setFlashProgress: (p: string) => void;
}

export const createFlasherSlice: StateCreator<FlasherSlice, [], [], FlasherSlice> = (set) => ({
  flashState: 'unknown',
  flashInfo: {},
  selectedPartition: 'boot',
  flashFile: null,
  flashing: false,
  flashProgress: '',

  setFlashState: (s) => set({ flashState: s }),
  setFlashInfo: (info) => set({ flashInfo: info }),
  setSelectedPartition: (p) => set({ selectedPartition: p }),
  setFlashFile: (f) => set({ flashFile: f }),
  setFlashing: (v) => set({ flashing: v }),
  setFlashProgress: (p) => set({ flashProgress: p }),
});
