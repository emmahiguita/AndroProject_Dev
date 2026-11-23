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
const themeKey = 'androproject-theme';
const getTheme = (): Theme => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const getServerTheme = (): Theme => 'dark';

// Mantiene los atributos y clases del documento en el mismo tema visual.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
}

function subscribeToTheme(listener: () => void) {
  // Storage avisa a las demás ventanas cuando una de ellas cambia el tema.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== themeKey || (event.newValue !== 'light' && event.newValue !== 'dark')) return;
    applyTheme(event.newValue);
    listener();
  };
  window.addEventListener(themeEvent, listener);
  window.addEventListener('storage', handleStorage);
  return () => { window.removeEventListener(themeEvent, listener); window.removeEventListener('storage', handleStorage); };
}

function toggleTheme() {
  const theme = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try {
    localStorage.setItem(themeKey, theme);
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
