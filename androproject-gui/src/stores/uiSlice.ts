// ── UI Slice — theming, navigation, logs, config ──────────────────
import type { StateCreator } from 'zustand';

export interface UISlice {
  dark: boolean;
  activeNav: string;
  logs: string[];
  configData: Record<string, string>;
  uploadProgress: Record<string, number>;

  setDark: (v: boolean) => void;
  setActiveNav: (nav: string) => void;
  addLog: (msg: string, ts?: Date) => void;
  setLogs: (l: string[]) => void;
  setConfigData: (d: Record<string, string>) => void;
  setUploadProgress: (p: Record<string, number>) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  dark: typeof window === 'undefined'
    ? false
    : window.localStorage.getItem('androproject-theme') !== 'light',
  activeNav: 'dashboard',
  logs: [],
  configData: {},
  uploadProgress: {},

  setDark: (v) => {
    window.localStorage.setItem('androproject-theme', v ? 'dark' : 'light');
    set({ dark: v });
  },
  setActiveNav: (nav) => set({ activeNav: nav }),
  addLog: (msg, ts = new Date()) => {
    const t = `[${ts.toLocaleTimeString()}]`;
    set((s) => ({ logs: [`${t} ${msg}`, ...s.logs].slice(0, 50) }));
  },
  setLogs: (l) => set({ logs: l }),
  setConfigData: (d) => set({ configData: d }),
  setUploadProgress: (p) => set({ uploadProgress: p }),
});
