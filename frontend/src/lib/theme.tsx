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

/** What the user picked. 'system' follows the device or browser setting (the default). */
export type ThemePreference = 'light' | 'dark' | 'system';
/** The theme actually shown. */
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'theme';
const ACCENT_KEY = 'accent';
const DEFAULT_HEX = ACCENTS[DEFAULT_ACCENT][700];

type ThemeState = {
  theme: ResolvedTheme;
  preference: ThemePreference;
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
  preference: 'system',
  accent: DEFAULT_ACCENT,
  accentHex: DEFAULT_HEX,
  brandColor: DEFAULT_HEX,
  brandTint: ACCENTS[DEFAULT_ACCENT][300],
  setTheme: () => {},
  setAccent: () => {},
  setAccentHex: () => {},
  ready: false,
});

function applyDomTheme(theme: ResolvedTheme) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#020617' : '#ffffff');
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function browserTheme(): ResolvedTheme {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function parseStoredTheme(stored: string | null): ThemePreference {
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function persistAccent(name: AccentName | null, hex: string) {
  if (name === DEFAULT_ACCENT) void writePreference(ACCENT_KEY, null);
  else void writePreference(ACCENT_KEY, name ?? hex);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // On iOS/Android NativeWind's colorScheme follows the phone while the preference is 'system'.
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [browserDark, setBrowserDark] = useState(() => browserTheme() === 'dark');
  const [accent, setAccentState] = useState<AccentName | null>(DEFAULT_ACCENT);
  const [accentHex, setAccentHexState] = useState<string>(DEFAULT_HEX);
  const [ready, setReady] = useState(false);

  const systemTheme: ResolvedTheme =
    Platform.OS === 'web' ? (browserDark ? 'dark' : 'light') : colorScheme === 'dark' ? 'dark' : 'light';
  const theme: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  function applyAccent(hex: string, name: AccentName | null) {
    setAccentState(name);
    setAccentHexState(hex);
    applyAccentColor(hex);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([readPreference(THEME_KEY), readPreference(ACCENT_KEY)]).then(([storedTheme, storedAccent]) => {
      if (cancelled) return;
      const parsed = parseStoredAccent(storedAccent);
      setPreference(parseStoredTheme(storedTheme));
      applyAccent(parsed.hex, parsed.name);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Web: follow the browser's dark mode as it changes.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setBrowserDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Native: hand 'system' to the OS (an explicit scheme would override the phone's setting).
  // Web: NativeWind's dark: classes need an explicit scheme and the html.dark class.
  useEffect(() => {
    setColorScheme(Platform.OS === 'web' ? theme : preference);
    applyDomTheme(theme);
  }, [theme, preference, setColorScheme]);

  function setTheme(next: ThemePreference) {
    setPreference(next);
    void writePreference(THEME_KEY, next === 'system' ? null : next);
  }

  function setAccent(next: AccentName) {
    const hex = ACCENTS[next][700];
    applyAccent(hex, next);
    persistAccent(next, hex);
  }

  function setAccentHex(next: string) {
    const hex = normalizeHex(next);
    if (!hex) return;
    const name = parseStoredAccent(hex).name;
    applyAccent(hex, name);
    persistAccent(name, hex);
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        preference,
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
