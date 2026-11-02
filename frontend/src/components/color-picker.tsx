import { useEffect, useState } from 'react';
import { Text, TextInput, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { hexToRgb, hsvToHex, rgbToHex, rgbToHsv } from '@/lib/accents';
import { useT } from '@/lib/i18n';

const HUE_COLORS = '#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000';

type Hsv = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function eventPoint(event: GestureResponderEvent, width: number, height: number) {
  const x = clamp(event.nativeEvent.locationX, 0, width);
  const y = clamp(event.nativeEvent.locationY, 0, height);
  return { x, y };
}

function ChannelField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="min-w-[4.5rem] flex-1 gap-1">
      <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel={label}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        style={{ outlineStyle: 'none' } as never}
      />
    </View>
  );
}

/**
 * Paint / Word-style color editor: a saturation-brightness field, a hue bar,
 * and Red / Green / Blue plus hex fields.
 */
export function RgbColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useT();
  const rgb = hexToRgb(value);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const [draft, setDraft] = useState({
    r: String(rgb.r),
    g: String(rgb.g),
    b: String(rgb.b),
    hex: value.replace('#', '').toUpperCase(),
  });

  useEffect(() => {
    const next = hexToRgb(value);
    setDraft({
      r: String(next.r),
      g: String(next.g),
      b: String(next.b),
      hex: value.replace('#', '').toUpperCase(),
    });
  }, [value]);

  function commitHsv(next: Hsv) {
    onChange(hsvToHex(next.h, next.s, next.v));
  }

  function commitChannel(channel: 'r' | 'g' | 'b', text: string) {
    const cleaned = text.replace(/[^\d]/g, '').slice(0, 3);
    setDraft((current) => ({ ...current, [channel]: cleaned }));
    if (cleaned === '') return;
    const parsed = Number.parseInt(cleaned, 10);
    if (!Number.isFinite(parsed)) return;
    const next = { r: rgb.r, g: rgb.g, b: rgb.b, [channel]: clamp(parsed, 0, 255) };
    onChange(rgbToHex(next.r, next.g, next.b));
  }

  function commitHex(text: string) {
    const cleaned = text.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setDraft((current) => ({ ...current, hex: cleaned.toUpperCase() }));
    if (cleaned.length === 6) onChange(`#${cleaned}`);
  }

  return (
    <View className="gap-3">
      <SvField hsv={hsv} onChange={commitHsv} />
      <HueSlider hsv={hsv} onChange={commitHsv} />
      <View className="flex-row items-end gap-2">
        <View
          className="h-10 w-10 rounded-lg border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: value }}
          accessibilityLabel={t('settings.accentPreview')}
        />
        <ChannelField label={t('settings.accentRed')} value={draft.r} onChange={(text) => commitChannel('r', text)} />
        <ChannelField label={t('settings.accentGreen')} value={draft.g} onChange={(text) => commitChannel('g', text)} />
        <ChannelField label={t('settings.accentBlue')} value={draft.b} onChange={(text) => commitChannel('b', text)} />
        <View className="min-w-[5.5rem] flex-1 gap-1">
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.accentHex')}</Text>
          <TextInput
            value={draft.hex}
            onChangeText={commitHex}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            accessibilityLabel={t('settings.accentHex')}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            style={{ outlineStyle: 'none' } as never}
          />
        </View>
      </View>
    </View>
  );
}

function SvField({ hsv, onChange }: { hsv: Hsv; onChange: (hsv: Hsv) => void }) {
  const [size, setSize] = useState({ width: 1, height: 1 });

  function pick(event: GestureResponderEvent) {
    const { x, y } = eventPoint(event, size.width, size.height);
    onChange({
      h: hsv.h,
      s: x / size.width,
      v: 1 - y / size.height,
    });
  }

  return (
    <View
      className="h-40 overflow-hidden rounded-xl"
      onLayout={(event: LayoutChangeEvent) => {
        setSize(event.nativeEvent.layout);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      accessibilityRole="adjustable"
      accessibilityLabel="Saturation and brightness">
      <View className="absolute inset-0" style={{ backgroundColor: hsvToHex(hsv.h, 1, 1) }} />
      <View
        className="absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(to right, #ffffff, transparent)' } as never}
      />
      <View
        className="absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(to top, #000000, transparent)' } as never}
      />
      <View
        pointerEvents="none"
        className="absolute h-4 w-4 rounded-full border-2 border-white"
        style={{
          left: hsv.s * size.width - 8,
          top: (1 - hsv.v) * size.height - 8,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
        }}
      />
    </View>
  );
}

function HueSlider({ hsv, onChange }: { hsv: Hsv; onChange: (hsv: Hsv) => void }) {
  const [size, setSize] = useState({ width: 1, height: 1 });

  function pick(event: GestureResponderEvent) {
    const { x } = eventPoint(event, size.width, size.height);
    onChange({ h: (x / size.width) * 360, s: hsv.s || 1, v: hsv.v || 1 });
  }

  return (
    <View
      className="h-5 justify-center overflow-visible rounded-full"
      onLayout={(event: LayoutChangeEvent) => {
        setSize(event.nativeEvent.layout);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      accessibilityRole="adjustable"
      accessibilityLabel="Hue">
      <View
        className="h-3 rounded-full"
        style={{ backgroundImage: `linear-gradient(to right, ${HUE_COLORS})` } as never}
      />
      <View
        pointerEvents="none"
        className="absolute h-5 w-5 rounded-full border-2 border-white bg-white"
        style={{
          left: (hsv.h / 360) * size.width - 10,
          backgroundColor: hsvToHex(hsv.h, 1, 1),
          boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
        }}
      />
    </View>
  );
}
