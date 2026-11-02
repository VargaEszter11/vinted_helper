import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useColorScheme } from 'nativewind';

import { readPreference, writePreference } from '@/lib/preferences';

export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'theme';

type ThemeState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeState>({
  theme: 'light',
  setTheme: () => {},
  ready: false,
});

function applyDomTheme(theme: ThemePreference) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#020617' : '#ffffff');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>('light');
  const [ready, setReady] = useState(false);

  function apply(next: ThemePreference) {
    setThemeState(next);
    setColorScheme(next);
    applyDomTheme(next);
  }

  useEffect(() => {
    let cancelled = false;
    readPreference(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      apply(stored === 'dark' ? 'dark' : 'light');
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setTheme(next: ThemePreference) {
    apply(next);
    void writePreference(STORAGE_KEY, next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme, ready }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
