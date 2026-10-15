import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { LocalPhoto } from '@/lib/types';

const MAX_PHOTO_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

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
