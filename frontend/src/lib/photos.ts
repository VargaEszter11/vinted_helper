import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { PHOTO_BUCKET, supabase } from '@/lib/supabase';
import type { LocalPhoto } from '@/lib/types';

const MAX_PHOTO_WIDTH = 1600;
const JPEG_QUALITY = 0.8;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Lets the user pick photos (gallery / web file picker) or take one, then resizes them. */
export async function pickPhotos(source: 'library' | 'camera'): Promise<LocalPhoto[]> {
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera access is needed to take photos. You can allow it in Settings.');
    }
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
  }
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => resizePhoto(asset.uri)));
}

/** Scales the photo down to at most MAX_PHOTO_WIDTH wide and re-encodes it as JPEG. */
async function resizePhoto(uri: string): Promise<LocalPhoto> {
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (image.width > MAX_PHOTO_WIDTH) {
    image = await ImageManipulator.manipulate(image).resize({ width: MAX_PHOTO_WIDTH }).renderAsync();
  }
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  if (!saved.base64) throw new Error('Could not read the photo.');
  return { key: saved.uri, uri: saved.uri, base64: saved.base64 };
}

export async function uploadPhoto(path: string, base64: string): Promise<void> {
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error) throw error;
}

export async function removePhotoFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** Returns temporary URLs for photos in the private bucket, keyed by storage path. */
export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const urls: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of new Set(paths)) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
      urls[path] = cached.url;
    } else {
      missing.push(path);
    }
  }

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    for (const entry of data) {
      if (entry.path && entry.signedUrl) {
        signedUrlCache.set(entry.path, {
          url: entry.signedUrl,
          expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
        });
        urls[entry.path] = entry.signedUrl;
      }
    }
  }

  return urls;
}
