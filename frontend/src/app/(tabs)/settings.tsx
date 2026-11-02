import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { BRAND_COLOR } from '@/components/ui';
import { useTheme, type ThemePreference } from '@/lib/theme';

const THEMES: { value: ThemePreference; label: string; icon: 'sunny-outline' | 'moon-outline' }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="w-full max-w-5xl flex-1 self-center px-4 py-6">
        <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance</Text>
          <Text className="text-sm text-slate-600 dark:text-slate-400">
            Choose a light or dark theme. It is saved on this device.
          </Text>
          <View className="flex-row gap-3">
            {THEMES.map((option) => {
              const selected = theme === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setTheme(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
                    selected
                      ? 'border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-950'
                      : 'border-slate-300 bg-slate-50 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:active:bg-slate-700'
                  }`}>
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={selected ? (theme === 'dark' ? '#5eead4' : BRAND_COLOR) : theme === 'dark' ? '#cbd5e1' : '#475569'}
                  />
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? 'text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200'
                    }`}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
