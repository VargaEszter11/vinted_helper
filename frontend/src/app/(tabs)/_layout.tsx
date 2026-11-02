import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { BRAND_COLOR } from '@/components/ui';
import { setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function TabLayout() {
  const { isAdmin } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: dark ? '#5eead4' : BRAND_COLOR,
        tabBarInactiveTintColor: dark ? '#94a3b8' : '#64748b',
        tabBarStyle: {
          backgroundColor: dark ? '#0f172a' : '#ffffff',
          borderTopColor: dark ? '#1e293b' : '#e2e8f0',
        },
        headerStyle: { backgroundColor: dark ? '#0f172a' : '#ffffff' },
        headerTitleStyle: { color: dark ? '#f1f5f9' : '#0f172a' },
        headerTintColor: dark ? '#f1f5f9' : '#0f172a',
        headerShadowVisible: !dark,
        headerRight: () => <SignOutButton />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Items',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetags-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="sold"
        options={{
          title: 'Sold',
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="buy-check"
        options={{
          title: 'Buy check',
          tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          // No tab for anyone but the admin account.
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

function SignOutButton() {
  return (
    <Pressable
      onPress={() => setToken(null)}
      accessibilityRole="button"
      className="mr-2 rounded-lg px-3 py-1.5 active:bg-slate-100 dark:active:bg-slate-800">
      <Text className="text-sm font-medium text-slate-600 dark:text-slate-300">Sign out</Text>
    </Pressable>
  );
}
