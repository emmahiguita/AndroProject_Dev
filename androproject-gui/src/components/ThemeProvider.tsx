'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
});

export function useAppTheme() {
  return useContext(ThemeContext);
}

const themeEvent = 'androproject-theme-change';
const getTheme = (): Theme => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const getServerTheme = (): Theme => 'dark';

function subscribeToTheme(listener: () => void) {
  window.addEventListener(themeEvent, listener);
  return () => window.removeEventListener(themeEvent, listener);
}

function toggleTheme() {
  const theme = getTheme() === 'dark' ? 'light' : 'dark';
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem('androproject-theme', theme);
  } catch {
    // The current session can still change theme when storage is unavailable.
  }
  window.dispatchEvent(new Event(themeEvent));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}
