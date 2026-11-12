/** Accent palettes used by the theme. Teal is the default when the user has not picked a color. */

export const ACCENT_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

export type AccentStep = (typeof ACCENT_STEPS)[number];
export type AccentPalette = Record<AccentStep, string>;

export const ACCENTS = {
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    950: '#042f2e',
  },
  sky: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  indigo: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  violet: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
    950: '#4c0519',
  },
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#431407',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
} as const satisfies Record<string, AccentPalette>;

export type AccentName = keyof typeof ACCENTS;

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];
export const DEFAULT_ACCENT: AccentName = 'teal';

export function isAccent(value: string | null): value is AccentName {
  return value != null && value in ACCENTS;
}

export function accentPalette(name: AccentName = DEFAULT_ACCENT): AccentPalette {
  return ACCENTS[name];
}

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toLowerCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex) ?? '#000000';
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [chroma, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, chroma, 0];
  else if (h < 180) [rp, gp, bp] = [0, chroma, x];
  else if (h < 240) [rp, gp, bp] = [0, x, chroma];
  else if (h < 300) [rp, gp, bp] = [x, 0, chroma];
  else [rp, gp, bp] = [chroma, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

export function hexAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixRgb(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  amount: number,
) {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

/** Build a light-to-dark scale from one chosen color (that color is the brand / 700). */
export function paletteFromHex(hex: string): AccentPalette {
  const rgb = hexToRgb(hex);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const toHex = (color: { r: number; g: number; b: number }) => rgbToHex(color.r, color.g, color.b);
  return {
    50: toHex(mixRgb(rgb, white, 0.92)),
    100: toHex(mixRgb(rgb, white, 0.8)),
    200: toHex(mixRgb(rgb, white, 0.65)),
    300: toHex(mixRgb(rgb, white, 0.45)),
    400: toHex(mixRgb(rgb, white, 0.25)),
    500: toHex(mixRgb(rgb, white, 0.1)),
    600: toHex(mixRgb(rgb, white, 0.04)),
    700: normalizeHex(hex) ?? ACCENTS.teal[700],
    800: toHex(mixRgb(rgb, black, 0.18)),
    900: toHex(mixRgb(rgb, black, 0.32)),
    950: toHex(mixRgb(rgb, black, 0.5)),
  };
}

export function accentNameForHex(hex: string): AccentName | null {
  const value = normalizeHex(hex);
  if (!value) return null;
  return ACCENT_NAMES.find((name) => ACCENTS[name][700] === value) ?? null;
}

export function parseStoredAccent(stored: string | null): { hex: string; name: AccentName | null } {
  if (isAccent(stored)) return { hex: ACCENTS[stored][700], name: stored };
  const hex = stored ? normalizeHex(stored) : null;
  if (hex) return { hex, name: accentNameForHex(hex) };
  return { hex: ACCENTS[DEFAULT_ACCENT][700], name: DEFAULT_ACCENT };
}

/** The 300 step for an accent color. Pure, so React can tell when it changes. */
export function brandTintForHex(hex: string): string {
  const name = accentNameForHex(hex);
  return (name ? ACCENTS[name] : paletteFromHex(hex))[300];
}

let currentPalette: AccentPalette = ACCENTS[DEFAULT_ACCENT];

export function getBrandColor(): string {
  return currentPalette[700];
}

export function getBrandTint(): string {
  return currentPalette[300];
}

export function applyAccentColor(hex: string) {
  const name = accentNameForHex(hex);
  currentPalette = name ? ACCENTS[name] : paletteFromHex(hex);
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const step of ACCENT_STEPS) {
    root.style.setProperty(`--accent-${step}`, currentPalette[step]);
  }
}
