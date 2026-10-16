import { Linking, Platform } from 'react-native';

import { api, API_URL } from '@/lib/api';

export type DatabaseStats = { users: number; items: number; bundles: number; photos: number };

export type ImportResult = { users: number; bundles: number; items: number; photos: number };

export const fetchStats = () => api<DatabaseStats>('/admin/stats');

/** Starts downloading the export: the server hands out a short-lived one-time link. */
export async function downloadExport(): Promise<void> {
  const { url } = await api<{ url: string }>('/admin/export-link', { method: 'POST' });
  const target = `${API_URL}${url}`;
  if (Platform.OS === 'web') window.location.assign(target);
  else await Linking.openURL(target);
}

/** Opens the browser's file picker. Web only; resolves to null when nothing was chosen. */
export function pickExportFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ndjson,.jsonl,application/x-ndjson';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Replaces the whole server (database and photos) with the contents of an export file. */
export const importExport = (file: File) =>
  api<ImportResult>('/admin/import', {
    method: 'POST',
    raw: { body: file, contentType: 'application/x-ndjson' },
  });
