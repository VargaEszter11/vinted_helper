import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BRAND_COLOR } from '@/components/ui';
import { useLanguage, type Language } from '@/lib/i18n';
import { useTheme, type ThemePreference } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon: IconName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View className="flex-row gap-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
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
  );
}

function SettingsCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
      <Text className="text-sm text-slate-600 dark:text-slate-400">{hint}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const themes: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny-outline' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon-outline' },
  ];

  const languages: { value: Language; label: string; icon: IconName }[] = [
    { value: 'en', label: 'English', icon: 'language-outline' },
    { value: 'hu', label: 'Magyar', icon: 'language-outline' },
  ];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="w-full max-w-5xl flex-1 self-center gap-4 px-4 py-6">
        <SettingsCard title={t('settings.appearance')} hint={t('settings.appearanceHint')}>
          <ChoiceRow options={themes} value={theme} onChange={setTheme} />
        </SettingsCard>
        <SettingsCard title={t('settings.language')} hint={t('settings.languageHint')}>
          <ChoiceRow options={languages} value={language} onChange={setLanguage} />
        </SettingsCard>
      </View>
    </View>
  );
}
