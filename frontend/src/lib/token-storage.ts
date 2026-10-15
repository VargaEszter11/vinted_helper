import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'vinted-helper-token';

// The web has no secure store, so the token lives in localStorage there. Storage can be
// unavailable (private mode, blocked site data); the user then just signs in again.

export async function readToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } else if (token) {
      await SecureStore.setItemAsync(KEY, token);
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // See above.
  }
}
