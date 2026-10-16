import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { BRAND_COLOR } from '@/components/ui';
import { setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const { isAdmin } = useAuth();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND_COLOR,
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
      className="mr-2 rounded-lg px-3 py-1.5 active:bg-slate-100">
      <Text className="text-sm font-medium text-slate-600">Sign out</Text>
    </Pressable>
  );
}
