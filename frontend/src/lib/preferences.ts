import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const prefix = 'vinted-helper-';

function webKey(key: string) {
  return `${prefix}${key}`;
}

/** Small string preferences (theme, etc.). Web uses localStorage; native uses SecureStore. */
export async function readPreference(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(webKey(key));
    return await SecureStore.getItemAsync(webKey(key));
  } catch {
    return null;
  }
}

export async function writePreference(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (value) localStorage.setItem(webKey(key), value);
      else localStorage.removeItem(webKey(key));
    } else if (value) {
      await SecureStore.setItemAsync(webKey(key), value);
    } else {
      await SecureStore.deleteItemAsync(webKey(key));
    }
  } catch {
    // Storage can be unavailable (private mode); the preference then lasts this session only.
  }
}
