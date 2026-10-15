const NBSP = ' ';
const MAX_PRICE = 9_999_999_999;

/** Formats a forint amount like "4 500 Ft". */
export function formatHuf(value: number): string {
  const rounded = Math.round(value);
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rounded < 0 ? '-' : ''}${digits}${NBSP}Ft`;
}

/** Formats an ISO timestamp in the device's time zone, like "2026-10-15 13:17". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatItemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export function priceToInput(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/**
 * Parses a price typed by the user. Accepts "4500", "4 500", "4500,5" and "4500 Ft".
 * An empty input gives `value: null`.
 */
export function parsePrice(input: string): { value: number | null; error?: string } {
  const cleaned = input
    .replace(/ft$/i, '')
    .replace(/[\s ]/g, '')
    .replace(',', '.');
  if (cleaned === '') return { value: null };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { value: null, error: 'Enter a price of 0 or more, e.g. 4500' };
  }
  const value = Number(cleaned);
  if (value > MAX_PRICE) return { value: null, error: 'That price is too large' };
  return { value };
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Checks for a real calendar date in YYYY-MM-DD format. */
export function isValidIsoDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [year, month, day] = input.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && error.message) {
    return String(error.message);
  }
  return 'Something went wrong. Please try again.';
}
