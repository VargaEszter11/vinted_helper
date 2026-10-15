import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { CenteredSpinner } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function RootLayout() {
  if (!isSupabaseConfigured) return <MissingConfig />;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  if (loading) return <CenteredSpinner />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

function MissingConfig() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-slate-50 p-6">
      <Text className="text-lg font-semibold text-slate-900">Supabase is not configured</Text>
      <Text className="max-w-md text-center text-sm text-slate-600">
        Copy frontend/.env.example to frontend/.env, fill in your Supabase URL and anon key, then
        restart the dev server.
      </Text>
    </View>
  );
}
