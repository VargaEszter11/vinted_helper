import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { RgbColorPicker } from '@/components/color-picker';
import { ACCENT_NAMES, ACCENTS } from '@/lib/accents';
import { useLanguage, type LanguagePreference, type MessageKey } from '@/lib/i18n';
import {
  COUNTRY_CODES,
  CURRENCY_CODES,
  useRegion,
  type CountryCode,
  type CurrencyCode,
} from '@/lib/region';
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
  const { theme, brandColor, brandTint } = useTheme();
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
              color={selected ? (theme === 'dark' ? brandTint : brandColor) : theme === 'dark' ? '#cbd5e1' : '#475569'}
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

function SettingSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { t } = useLanguage();
  const { brandColor } = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="flex-row items-center justify-between rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800">
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedLabel}</Text>
        <Ionicons name="chevron-down" size={16} color="#64748b" />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 p-6"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}>
          <Pressable className="max-h-[70%] w-full max-w-sm rounded-xl bg-white dark:bg-slate-900">
            <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                className="rounded-full p-1 active:bg-slate-100 dark:active:bg-slate-800">
                <Ionicons name="close" size={20} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView contentContainerClassName="p-2">
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`flex-row items-center justify-between rounded-lg px-3 py-2.5 ${
                      selected ? 'bg-teal-50 dark:bg-teal-950' : 'active:bg-slate-100 dark:active:bg-slate-800'
                    }`}>
                    <Text
                      className={`flex-1 text-sm ${
                        selected ? 'font-semibold text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200'
                      }`}>
                      {option.label}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={brandColor} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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

function AccentSwatches() {
  const { accent, accentHex, setAccent, setAccentHex } = useTheme();
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const custom = accent === null;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('settings.accent')}</Text>
      <View className="flex-row flex-wrap items-center gap-2.5">
        {ACCENT_NAMES.map((name) => {
          const selected = name === accent;
          const color = ACCENTS[name][500];
          return (
            <Pressable
              key={name}
              onPress={() => setAccent(name)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`accent.${name}` as MessageKey)}
              className="h-9 w-9 items-center justify-center rounded-full border-2"
              style={{ borderColor: selected ? ACCENTS[name][700] : 'transparent' }}>
              <View
                className="h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}>
                {selected ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
              </View>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: custom }}
          accessibilityLabel={t('settings.accentCustom')}
          className="h-9 w-9 items-center justify-center rounded-full border-2 border-dashed"
          style={{
            borderColor: custom ? accentHex : '#94a3b8',
            borderStyle: custom ? 'solid' : 'dashed',
          }}>
          <View
            className="h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: custom ? accentHex : 'transparent' }}>
            {custom ? (
              <Ionicons name="checkmark" size={14} color="#ffffff" />
            ) : (
              <Ionicons name="add" size={18} color="#64748b" />
            )}
          </View>
        </Pressable>
      </View>
      <Modal transparent animationType="fade" visible={pickerOpen} onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 p-6"
          onPress={() => setPickerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}>
          <Pressable className="w-full max-w-md gap-3 rounded-xl bg-white p-4 dark:bg-slate-900">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('settings.accentCustom')}
              </Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                className="rounded-full p-1 active:bg-slate-100 dark:active:bg-slate-800">
                <Ionicons name="close" size={20} color="#94a3b8" />
              </Pressable>
            </View>
            <RgbColorPicker value={accentHex} onChange={setAccentHex} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function SettingsScreen() {
  const { preference, setTheme } = useTheme();
  const { preference: languagePreference, setLanguage, t } = useLanguage();
  const { country, currency, setCountry, setCurrency } = useRegion();

  const themes: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'system', label: t('settings.themeSystem'), icon: 'contrast-outline' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny-outline' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon-outline' },
  ];

  const languages: { value: LanguagePreference; label: string; icon: IconName }[] = [
    { value: 'system', label: t('settings.languageSystem'), icon: 'phone-portrait-outline' },
    { value: 'en', label: 'English', icon: 'language-outline' },
    { value: 'hu', label: 'Magyar', icon: 'language-outline' },
  ];

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-slate-950" contentContainerClassName="items-center px-4 py-6">
      <View className="w-full max-w-5xl gap-4">
        <SettingsCard title={t('settings.appearance')} hint={t('settings.appearanceHint')}>
          <ChoiceRow options={themes} value={preference} onChange={setTheme} />
          <AccentSwatches />
        </SettingsCard>
        <SettingsCard title={t('settings.language')} hint={t('settings.languageHint')}>
          <ChoiceRow options={languages} value={languagePreference} onChange={setLanguage} />
        </SettingsCard>
        <SettingsCard title={t('settings.region')} hint={t('settings.regionHint')}>
          <SettingSelect
            label={t('settings.country')}
            value={country}
            options={COUNTRY_CODES.map((code) => ({
              value: code,
              label: t(`country.${code}` as MessageKey),
            }))}
            onChange={(next) => setCountry(next as CountryCode)}
          />
          <SettingSelect
            label={t('settings.currency')}
            value={currency}
            options={CURRENCY_CODES.map((code) => ({
              value: code,
              label: t(`currency.${code}` as MessageKey),
            }))}
            onChange={(next) => setCurrency(next as CurrencyCode)}
          />
        </SettingsCard>
      </View>
    </ScrollView>
  );
}
