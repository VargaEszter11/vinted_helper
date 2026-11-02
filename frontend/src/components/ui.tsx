import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';

import { getBrandColor, hexAlpha } from '@/lib/accents';
import { formatHuf } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import type { ItemCondition, ItemStatus } from '@/lib/types';

export { getBrandColor };

/** Keeps the browser from drawing its own focus ring around a text input. */
const NO_BROWSER_OUTLINE = { outlineStyle: 'none' } as unknown as ComponentProps<
  typeof TextInput
>['style'];

/** Teal border and glow while focused, matching the search field. Red wins when the value is invalid. */
function focusFrame(focused: boolean, error = false, dark = false) {
  return {
    borderColor: error ? '#ef4444' : focused ? getBrandColor() : dark ? '#475569' : '#cbd5e1',
    boxShadow: focused && !error ? `0 0 0 3px ${hexAlpha(getBrandColor(), 0.25)}` : undefined,
  };
}

/** Tables switch from a compact phone layout to separate columns at this width. */
export function useWideLayout(): boolean {
  return useWindowDimensions().width >= 640;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, { box: string; text: string; tint: string | 'brand' }> = {
  primary: { box: 'bg-teal-700 active:bg-teal-800', text: 'text-white', tint: '#ffffff' },
  secondary: {
    box: 'border border-slate-300 bg-white active:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:active:bg-slate-800',
    text: 'text-slate-800 dark:text-slate-100',
    tint: 'brand',
  },
  ghost: { box: 'active:bg-slate-100 dark:active:bg-slate-800', text: 'text-teal-700 dark:text-teal-300', tint: 'brand' },
  danger: { box: 'bg-red-600 active:bg-red-700', text: 'text-white', tint: '#ffffff' },
  'danger-ghost': { box: 'active:bg-red-50 dark:active:bg-red-950', text: 'text-red-600 dark:text-red-400', tint: '#dc2626' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  className = '',
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const styles = BUTTON_VARIANTS[variant];
  const tint = styles.tint === 'brand' ? getBrandColor() : styles.tint;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      className={`flex-row items-center justify-center gap-1.5 rounded-lg ${
        size === 'sm' ? 'px-2.5 py-1.5' : 'px-4 py-2.5'
      } ${styles.box} ${inactive ? 'opacity-50' : ''} ${className}`}>
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={tint} />
      ) : null}
      <Text
        numberOfLines={1}
        className={`font-semibold ${size === 'sm' ? 'text-sm' : 'text-base'} ${styles.text}`}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  className = '',
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextInputProps & { label: string; error?: string; hint?: string; className?: string }) {
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <View className={`gap-1 ${className}`}>
      <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={dark ? '#64748b' : '#94a3b8'}
        selectionColor={getBrandColor()}
        className="rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 dark:bg-slate-900 dark:text-slate-100"
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        // Border color stays in `style`: swapping it through classes remounts the field on native.
        style={[NO_BROWSER_OUTLINE, style, focusFrame(focused, Boolean(error), dark)]}
      />
      {error ? (
        <Text className="text-xs text-red-600 dark:text-red-400">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-slate-500 dark:text-slate-400">{hint}</Text>
      ) : null}
    </View>
  );
}

export function PriceField(props: Omit<ComponentProps<typeof Field>, 'keyboardType' | 'inputMode'>) {
  return <Field keyboardType="decimal-pad" inputMode="decimal" placeholder="0" {...props} />;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const hint = placeholder ?? t('search.placeholder');
  return (
    <View
      className="w-full flex-row items-center gap-2 rounded-lg border bg-white px-3 dark:bg-slate-900"
      // Border color stays in `style`: swapping it through classes remounts the field on native.
      style={focusFrame(focused, false, dark)}>
      <Ionicons name="search-outline" size={18} color={focused ? getBrandColor() : '#94a3b8'} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={hint}
        placeholderTextColor={dark ? '#64748b' : '#94a3b8'}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        selectionColor={getBrandColor()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={t('search.items')}
        // Inline, so it beats the browser's default blue focus ring.
        style={NO_BROWSER_OUTLINE}
        className="flex-1 py-2.5 text-base text-slate-900 dark:text-slate-100"
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('search.clear')}
          hitSlop={8}>
          <Ionicons name="close-circle" size={18} color="#94a3b8" />
        </Pressable>
      ) : null}
    </View>
  );
}

const SEGMENT_SELECTED_STYLE = {
  backgroundColor: '#ffffff',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
} as const;

const SEGMENT_SELECTED_STYLE_DARK = {
  backgroundColor: '#475569',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.45)',
} as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View className="flex-row rounded-lg bg-slate-200 p-1 dark:bg-slate-950">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            // The selected look goes in `style`: adding bg/shadow classes after the first render
            // makes NativeWind remount the component on iOS/Android, which crashes in dev.
            style={
              selected ? (theme === 'dark' ? SEGMENT_SELECTED_STYLE_DARK : SEGMENT_SELECTED_STYLE) : undefined
            }
            className="flex-1 items-center rounded-md px-1 py-1.5">
            <Text
              numberOfLines={1}
              className={`text-sm ${
                selected
                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const STATUS_VALUES: ItemStatus[] = ['in_stock', 'listed', 'sold'];

const STATUS_STYLES: Record<ItemStatus, { box: string; text: string }> = {
  in_stock: { box: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-200' },
  listed: { box: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-800 dark:text-sky-200' },
  sold: { box: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-800 dark:text-emerald-200' },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const t = useT();
  const styles = STATUS_STYLES[status];
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${styles.box}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{t(`status.${status}`)}</Text>
    </View>
  );
}

const CONDITION_VALUES: ItemCondition[] = ['new_with_tags', 'very_good', 'good', 'fair'];

export function useConditionOptions(): { value: ItemCondition; label: string }[] {
  const t = useT();
  return CONDITION_VALUES.map((value) => ({ value, label: t(`condition.${value}`) }));
}

/** A row of toggle chips: tap one to choose it, tap it again to clear (back to `null`). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(selected ? null : option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`rounded-full border px-3 py-1.5 ${
              selected
                ? 'border-teal-700 bg-teal-700'
                : 'border-slate-300 bg-white active:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:active:bg-slate-800'
            } ${disabled ? 'opacity-50' : ''}`}>
            <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A compact "Brand ▾" style button that opens a popup list of values to filter by. */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  clearable = true,
  keepButtonLabel = false,
  defaultValue,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
  /** When false, every option must stay selected (e.g. sort). */
  clearable?: boolean;
  /** Always show `label` on the chip (sort menus). */
  keepButtonLabel?: boolean;
  /** With `keepButtonLabel`, highlight when value differs from this (e.g. non-default sort). */
  defaultValue?: T;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const active = clearable
    ? selectedLabel != null
    : defaultValue !== undefined && value !== null && value !== defaultValue;

  function choose(next: T | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={keepButtonLabel ? t('filter.sortBy', { label }) : t('filter.by', { label })}
        className={`flex-row items-center gap-1 rounded-lg border px-3 py-2 ${
          active
            ? 'border-teal-700 bg-teal-50 dark:bg-teal-950'
            : 'border-slate-300 bg-white active:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:active:bg-slate-800'
        }`}>
        <Text
          numberOfLines={1}
          className={`max-w-[120px] text-sm ${
            active ? 'font-semibold text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200'
          }`}>
          {keepButtonLabel ? label : (selectedLabel ?? label)}
        </Text>
        <Ionicons name="chevron-down" size={14} color={active ? getBrandColor() : '#64748b'} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 p-6"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
          {/* Stops the tap from reaching the backdrop above and closing the popup. */}
          <Pressable className="max-h-[70%] w-full max-w-xs rounded-xl bg-white dark:bg-slate-900">
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
              {clearable ? (
                <FilterOption
                  label={t('filter.allOf', { label: label.toLowerCase() })}
                  selected={value === null}
                  onPress={() => choose(null)}
                />
              ) : null}
              {options.map((option) => (
                <FilterOption
                  key={option.value}
                  label={option.label}
                  selected={option.value === value}
                  onPress={() => choose(option.value)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center justify-between rounded-lg px-3 py-2.5 ${
        selected ? 'bg-teal-50 dark:bg-teal-950' : 'active:bg-slate-100 dark:active:bg-slate-800'
      }`}>
      <Text
        numberOfLines={1}
        className={`flex-1 text-sm ${
          selected ? 'font-semibold text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200'
        }`}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={18} color={getBrandColor()} /> : null}
    </Pressable>
  );
}

export function Money({
  value,
  className = '',
  textClassName = 'text-slate-700 dark:text-slate-300',
}: {
  value: number | null;
  className?: string;
  textClassName?: string;
}) {
  return (
    <Text numberOfLines={1} className={`text-right ${textClassName} ${className}`}>
      {value == null ? '—' : formatHuf(value)}
    </Text>
  );
}

export function HeaderText({ children, className }: { children: string; className: string }) {
  return (
    <Text
      numberOfLines={1}
      className={`text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}>
      {children}
    </Text>
  );
}

export function profitColor(profit: number): string {
  if (profit > 0) return 'text-emerald-700 dark:text-emerald-400';
  if (profit < 0) return 'text-red-600 dark:text-red-400';
  return 'text-slate-700 dark:text-slate-300';
}

export function CenteredSpinner() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
      <ActivityIndicator size="large" color={getBrandColor()} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Ionicons name="cloud-offline-outline" size={36} color="#64748b" />
      <Text className="text-center text-base font-semibold text-slate-800 dark:text-slate-100">
        {t('error.loadItems')}
      </Text>
      <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{message}</Text>
      <Button title={t('common.retry')} variant="secondary" onPress={onRetry} />
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
      <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
      <Text className="flex-1 text-sm text-red-700 dark:text-red-300">{message}</Text>
    </View>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="items-center gap-2 px-6 py-16">
      <Ionicons name="file-tray-outline" size={36} color="#94a3b8" />
      <Text className="text-center text-base font-semibold text-slate-700 dark:text-slate-200">{title}</Text>
      {children ? <Text className="text-center text-sm text-slate-500 dark:text-slate-400">{children}</Text> : null}
    </View>
  );
}
