import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useColorScheme } from 'nativewind';

import {
  ACCENTS,
  DEFAULT_ACCENT,
  applyAccentColor,
  getBrandColor,
  getBrandTint,
  normalizeHex,
  parseStoredAccent,
  type AccentName,
} from '@/lib/accents';
import { readPreference, writePreference } from '@/lib/preferences';

export type ThemePreference = 'light' | 'dark';

const THEME_KEY = 'theme';
const ACCENT_KEY = 'accent';
const DEFAULT_HEX = ACCENTS[DEFAULT_ACCENT][700];

type ThemeState = {
  theme: ThemePreference;
  accent: AccentName | null;
  accentHex: string;
  brandColor: string;
  brandTint: string;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: AccentName) => void;
  setAccentHex: (hex: string) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeState>({
  theme: 'light',
  accent: DEFAULT_ACCENT,
  accentHex: DEFAULT_HEX,
  brandColor: DEFAULT_HEX,
  brandTint: ACCENTS[DEFAULT_ACCENT][300],
  setTheme: () => {},
  setAccent: () => {},
  setAccentHex: () => {},
  ready: false,
});

function applyDomTheme(theme: ThemePreference) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#020617' : '#ffffff');
}

function persistAccent(name: AccentName | null, hex: string) {
  if (name === DEFAULT_ACCENT) void writePreference(ACCENT_KEY, null);
  else void writePreference(ACCENT_KEY, name ?? hex);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>('light');
  const [accent, setAccentState] = useState<AccentName | null>(DEFAULT_ACCENT);
  const [accentHex, setAccentHexState] = useState(DEFAULT_HEX);
  const [ready, setReady] = useState(false);

  function apply(nextTheme: ThemePreference, hex: string, name: AccentName | null) {
    setThemeState(nextTheme);
    setAccentState(name);
    setAccentHexState(hex);
    setColorScheme(nextTheme);
    applyDomTheme(nextTheme);
    applyAccentColor(hex);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([readPreference(THEME_KEY), readPreference(ACCENT_KEY)]).then(([storedTheme, storedAccent]) => {
      if (cancelled) return;
      const parsed = parseStoredAccent(storedAccent);
      apply(storedTheme === 'dark' ? 'dark' : 'light', parsed.hex, parsed.name);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setTheme(next: ThemePreference) {
    apply(next, accentHex, accent);
    void writePreference(THEME_KEY, next);
  }

  function setAccent(next: AccentName) {
    const hex = ACCENTS[next][700];
    apply(theme, hex, next);
    persistAccent(next, hex);
  }

  function setAccentHex(next: string) {
    const hex = normalizeHex(next);
    if (!hex) return;
    const name = parseStoredAccent(hex).name;
    apply(theme, hex, name);
    persistAccent(name, hex);
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accent,
        accentHex,
        brandColor: getBrandColor(),
        brandTint: getBrandTint(),
        setTheme,
        setAccent,
        setAccentHex,
        ready,
      }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
