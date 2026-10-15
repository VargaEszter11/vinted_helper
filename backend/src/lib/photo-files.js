import { mkdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config.js';

const fileFor = (storagePath) => path.join(config.photoDir, ...storagePath.split('/'));

export async function ensurePhotoDir() {
  await mkdir(config.photoDir, { recursive: true });
}

export async function savePhotoFile(storagePath, buffer) {
  const file = fileFor(storagePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
}

export const deletePhotoFile = (storagePath) => unlink(fileFor(storagePath)).catch(() => {});

export const deleteItemPhotoFiles = (itemId) =>
  rm(path.join(config.photoDir, itemId), { recursive: true, force: true });

/** Returns the file's path and size, or null when it is missing. */
export async function photoFileInfo(storagePath) {
  const file = fileFor(storagePath);
  const info = await stat(file).catch(() => null);
  return info ? { file, size: info.size } : null;
}
