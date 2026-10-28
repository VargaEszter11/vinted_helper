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

import { formatHuf } from '@/lib/format';
import type { ItemCondition, ItemStatus } from '@/lib/types';

export const BRAND_COLOR = '#0f766e';

/** Keeps the browser from drawing its own focus ring around a text input. */
const NO_BROWSER_OUTLINE = { outlineStyle: 'none' } as unknown as ComponentProps<
  typeof TextInput
>['style'];

/** Teal border and glow while focused, matching the search field. Red wins when the value is invalid. */
function focusFrame(focused: boolean, error = false) {
  return {
    borderColor: error ? '#ef4444' : focused ? BRAND_COLOR : '#cbd5e1',
    boxShadow: focused && !error ? '0 0 0 3px rgba(15, 118, 110, 0.25)' : undefined,
  };
}

/** Tables switch from a compact phone layout to separate columns at this width. */
export function useWideLayout(): boolean {
  return useWindowDimensions().width >= 640;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, { box: string; text: string; tint: string }> = {
  primary: { box: 'bg-teal-700 active:bg-teal-800', text: 'text-white', tint: '#ffffff' },
  secondary: {
    box: 'border border-slate-300 bg-white active:bg-slate-100',
    text: 'text-slate-800',
    tint: BRAND_COLOR,
  },
  ghost: { box: 'active:bg-slate-100', text: 'text-teal-700', tint: BRAND_COLOR },
  danger: { box: 'bg-red-600 active:bg-red-700', text: 'text-white', tint: '#ffffff' },
  'danger-ghost': { box: 'active:bg-red-50', text: 'text-red-600', tint: '#dc2626' },
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
        <ActivityIndicator size="small" color={styles.tint} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={styles.tint} />
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
  return (
    <View className={`gap-1 ${className}`}>
      <Text className="text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        selectionColor={BRAND_COLOR}
        className="rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900"
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
        style={[NO_BROWSER_OUTLINE, style, focusFrame(focused, Boolean(error))]}
      />
      {error ? (
        <Text className="text-xs text-red-600">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-slate-500">{hint}</Text>
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
  placeholder = 'Search by name, brand, or size',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className="w-full flex-row items-center gap-2 rounded-lg border bg-white px-3"
      // Border color stays in `style`: swapping it through classes remounts the field on native.
      style={focusFrame(focused)}>
      <Ionicons name="search-outline" size={18} color={focused ? BRAND_COLOR : '#94a3b8'} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        selectionColor={BRAND_COLOR}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Search items"
        // Inline, so it beats the browser's default blue focus ring.
        style={NO_BROWSER_OUTLINE}
        className="flex-1 py-2.5 text-base text-slate-900"
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
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
  return (
    <View className="flex-row rounded-lg bg-slate-200 p-1">
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
            style={selected ? SEGMENT_SELECTED_STYLE : undefined}
            className="flex-1 items-center rounded-md px-1 py-1.5">
            <Text
              numberOfLines={1}
              className={`text-sm ${selected ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  in_stock: 'In stock',
  listed: 'Listed',
  sold: 'Sold',
};

const STATUS_STYLES: Record<ItemStatus, { box: string; text: string }> = {
  in_stock: { box: 'bg-slate-100', text: 'text-slate-700' },
  listed: { box: 'bg-sky-100', text: 'text-sky-800' },
  sold: { box: 'bg-emerald-100', text: 'text-emerald-800' },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const styles = STATUS_STYLES[status];
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${styles.box}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

export const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new_with_tags', label: 'New with tags' },
  { value: 'very_good', label: 'Very good' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export const CONDITION_LABELS: Record<ItemCondition, string> = Object.fromEntries(
  CONDITION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ItemCondition, string>;

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
              selected ? 'border-teal-700 bg-teal-700' : 'border-slate-300 bg-white active:bg-slate-100'
            } ${disabled ? 'opacity-50' : ''}`}>
            <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-700'}`}>
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
        accessibilityLabel={keepButtonLabel ? `Sort by ${label}` : `Filter by ${label}`}
        className={`flex-row items-center gap-1 rounded-lg border px-3 py-2 ${
          active ? 'border-teal-700 bg-teal-50' : 'border-slate-300 bg-white active:bg-slate-100'
        }`}>
        <Text
          numberOfLines={1}
          className={`max-w-[120px] text-sm ${active ? 'font-semibold text-teal-800' : 'text-slate-700'}`}>
          {keepButtonLabel ? label : (selectedLabel ?? label)}
        </Text>
        <Ionicons name="chevron-down" size={14} color={active ? BRAND_COLOR : '#64748b'} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 p-6"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close">
          {/* Stops the tap from reaching the backdrop above and closing the popup. */}
          <Pressable className="max-h-[70%] w-full max-w-xs rounded-xl bg-white">
            <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3">
              <Text className="text-base font-semibold text-slate-900">{label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="rounded-full p-1 active:bg-slate-100">
                <Ionicons name="close" size={20} color="#475569" />
              </Pressable>
            </View>
            <ScrollView contentContainerClassName="p-2">
              {clearable ? (
                <FilterOption
                  label={`All (${label.toLowerCase()})`}
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
        selected ? 'bg-teal-50' : 'active:bg-slate-100'
      }`}>
      <Text
        numberOfLines={1}
        className={`flex-1 text-sm ${selected ? 'font-semibold text-teal-800' : 'text-slate-700'}`}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={18} color={BRAND_COLOR} /> : null}
    </Pressable>
  );
}

export function Money({
  value,
  className = '',
  textClassName = 'text-slate-700',
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
      className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </Text>
  );
}

export function profitColor(profit: number): string {
  if (profit > 0) return 'text-emerald-700';
  if (profit < 0) return 'text-red-600';
  return 'text-slate-700';
}

export function CenteredSpinner() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" color={BRAND_COLOR} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <Ionicons name="cloud-offline-outline" size={36} color="#64748b" />
      <Text className="text-center text-base font-semibold text-slate-800">
        Could not load your items
      </Text>
      <Text className="text-center text-sm text-slate-500">{message}</Text>
      <Button title="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
      <Text className="flex-1 text-sm text-red-700">{message}</Text>
    </View>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="items-center gap-2 px-6 py-16">
      <Ionicons name="file-tray-outline" size={36} color="#94a3b8" />
      <Text className="text-center text-base font-semibold text-slate-700">{title}</Text>
      {children ? <Text className="text-center text-sm text-slate-500">{children}</Text> : null}
    </View>
  );
}
