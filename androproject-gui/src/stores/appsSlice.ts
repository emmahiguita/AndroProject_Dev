// ── Apps Slice — app listing, filtering, selection, bulk actions ──
import type { StateCreator } from 'zustand';
import type { AppInfo } from '@/features/types';

export type AppsFilter = 'all' | 'user' | 'system' | 'hidden' | 'adware' | 'disabled' | 'google' | 'malware' | 'bloatware' | 'safe' | 'critical';
export type AppsViewMode = 'grid' | 'list';
export type AppsSubTab = 'installer' | 'manager';

export interface AppsSlice {
  appsSubTab: AppsSubTab;
  appsList: AppInfo[];
  appsLoading: boolean;
  appsFilter: AppsFilter;
  appsSearch: string;
  appsSort: string;
  appsViewMode: AppsViewMode;
  appActionLoading: string | null;
  selectedPackages: Set<string>;

  setAppsSubTab: (tab: AppsSubTab) => void;
  setAppsList: (list: AppInfo[]) => void;
  setAppsLoading: (v: boolean) => void;
  setAppsFilter: (f: AppsFilter) => void;
  setAppsSearch: (q: string) => void;
  setAppsSort: (s: string) => void;
  setAppsViewMode: (m: AppsViewMode) => void;
  setAppActionLoading: (pkg: string | null) => void;
  setSelectedPackages: (pkgs: Set<string>) => void;
  togglePackageSelection: (pkg: string) => void;
  clearSelectedPackages: () => void;
}

export const createAppsSlice: StateCreator<AppsSlice, [], [], AppsSlice> = (set) => ({
  appsSubTab: 'installer',
  appsList: [],
  appsLoading: false,
  appsFilter: 'all',
  appsSearch: '',
  appsSort: 'name_asc',
  appsViewMode: 'grid',
  appActionLoading: null,
  selectedPackages: new Set<string>(),

  setAppsSubTab: (tab) => set({ appsSubTab: tab }),
  setAppsList: (list) => set({ appsList: list }),
  setAppsLoading: (v) => set({ appsLoading: v }),
  setAppsFilter: (f) => set({ appsFilter: f }),
  setAppsSearch: (q) => set({ appsSearch: q }),
  setAppsSort: (s) => set({ appsSort: s }),
  setAppsViewMode: (m) => set({ appsViewMode: m }),
  setAppActionLoading: (pkg) => set({ appActionLoading: pkg }),
  setSelectedPackages: (pkgs) => set({ selectedPackages: new Set(pkgs) }),
  togglePackageSelection: (pkg) => set((s) => {
    const next = new Set(s.selectedPackages);
    if (next.has(pkg)) next.delete(pkg); else next.add(pkg);
    return { selectedPackages: next };
  }),
  clearSelectedPackages: () => set({ selectedPackages: new Set() }),
});
