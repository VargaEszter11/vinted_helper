import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { ConfirmHost } from '@/components/confirm-host';
import { CenteredSpinner } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isApiConfigured } from '@/lib/api';
import { ThemeProvider, useTheme } from '@/lib/theme';

export default function RootLayout() {
  if (!isApiConfigured) return <MissingConfig />;
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <RootNavigator />
        <ConfirmHost />
      </AuthProvider>
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />;
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
    <View className="flex-1 items-center justify-center gap-2 bg-slate-50 p-6 dark:bg-slate-950">
      <Text className="text-lg font-semibold text-slate-900 dark:text-slate-100">The server is not configured</Text>
      <Text className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
        Copy frontend/.env.example to frontend/.env, set EXPO_PUBLIC_API_URL to your backend&apos;s
        address, then restart the dev server.
      </Text>
    </View>
  );
}
