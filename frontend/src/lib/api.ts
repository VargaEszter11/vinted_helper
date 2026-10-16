import { readToken, writeToken } from '@/lib/token-storage';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const isApiConfigured = Boolean(API_URL);

let token: string | null = null;
const listeners = new Set<(token: string | null) => void>();

/** Reads the saved token from the device. Call once at startup. */
export async function loadToken(): Promise<string | null> {
  token = await readToken();
  return token;
}

export function setToken(next: string | null) {
  token = next;
  void writeToken(next);
  listeners.forEach((listener) => listener(next));
}

export function onTokenChange(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    /** A body sent as is (for example a file), instead of JSON. */
    raw?: { body: BodyInit; contentType: string };
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.raw
          ? { 'Content-Type': options.raw.contentType }
          : options.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.raw
        ? options.raw.body
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401 && token) setToken(null);
    throw new ApiError(data?.message ?? `Request failed (${response.status}).`, response.status);
  }
  return (await response.json()) as T;
}

export async function signIn(
  mode: 'login' | 'register',
  username: string,
  password: string,
): Promise<void> {
  const { token: next } = await api<{ token: string }>(`/auth/${mode}`, {
    method: 'POST',
    body: { username, password },
  });
  setToken(next);
}
