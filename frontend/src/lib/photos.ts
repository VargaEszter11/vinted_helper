import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { LocalPhoto } from '@/lib/types';

const MAX_PHOTO_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Lets the user pick photos (gallery / web file picker) or take one, then resizes them.
 * Item photos use the defaults; other callers can ask for a smaller size or fewer photos.
 */
export async function pickPhotos(
  source: 'library' | 'camera',
  { maxWidth = MAX_PHOTO_WIDTH, limit = 10 }: { maxWidth?: number; limit?: number } = {},
): Promise<LocalPhoto[]> {
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
      selectionLimit: limit,
    });
  }
  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, limit).map((asset) => resizePhoto(asset.uri, maxWidth)));
}

/** Scales the photo down to at most `maxWidth` wide and re-encodes it as JPEG. */
async function resizePhoto(uri: string, maxWidth: number): Promise<LocalPhoto> {
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (image.width > maxWidth) {
    image = await ImageManipulator.manipulate(image).resize({ width: maxWidth }).renderAsync();
  }
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  if (!saved.base64) throw new Error('Could not read the photo.');
  return { key: saved.uri, uri: saved.uri, base64: saved.base64 };
}
