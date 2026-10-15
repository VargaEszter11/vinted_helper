import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Placeholders keep the import from crashing; the root layout shows a setup
// message instead of the app when the .env values are missing.
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost',
  supabaseAnonKey ?? 'missing-anon-key',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const PHOTO_BUCKET = 'item-photos';

/** Users sign in with a username; Supabase Auth needs an email, so one is derived from it. */
export function usernameToEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : `${trimmed}@vinted-helper.local`;
}

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
