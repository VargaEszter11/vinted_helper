import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';

import { formatHuf } from '@/lib/format';
import type { ItemStatus } from '@/lib/types';

export const BRAND_COLOR = '#0f766e';

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
  ...inputProps
}: TextInputProps & { label: string; error?: string; hint?: string; className?: string }) {
  return (
    <View className={`gap-1 ${className}`}>
      <Text className="text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        className={`rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
        {...inputProps}
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
