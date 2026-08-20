// ── Combined Zustand Store ─────────────────────────────────────────
// Architecture: Slices pattern. Each slice owns its domain state + setters.
// Views use individual selectors — no prop drilling, no mega-context.

import { create } from 'zustand';
import { createDeviceSlice, type DeviceSlice } from './deviceSlice';
import { createUISlice, type UISlice } from './uiSlice';
import { createFlasherSlice, type FlasherSlice } from './flasherSlice';
import { createPatcherSlice, type PatcherSlice } from './patcherSlice';
import { createAppsSlice, type AppsSlice } from './appsSlice';
import { createOptimizerSlice, type OptimizerSlice } from './optimizerSlice';

export type AppStore = DeviceSlice & UISlice & FlasherSlice & PatcherSlice & AppsSlice & OptimizerSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createDeviceSlice(...args),
  ...createUISlice(...args),
  ...createFlasherSlice(...args),
  ...createPatcherSlice(...args),
  ...createAppsSlice(...args),
  ...createOptimizerSlice(...args),
}));

// ── Re-export types for consumers ───────────────────────────────────
export type { DeviceSlice } from './deviceSlice';
export type { UISlice } from './uiSlice';
export type { FlasherSlice } from './flasherSlice';
export type { PatcherSlice, CurarSubTab } from './patcherSlice';
export type { AppsSlice, AppsFilter, AppsViewMode, AppsSubTab } from './appsSlice';
export type {
  OptimizerSlice, OptimizerTab, AdguardProfile,
} from './optimizerSlice';
