import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { PhotoTile, TILE_SIZE } from '@/components/photo-picker';
import { BRAND_COLOR, Button, ErrorBanner, Field, PriceField } from '@/components/ui';
import {
  BUY_CHECK_PHOTO_WIDTH,
  CATEGORY_OPTIONS,
  CONDITION_OPTIONS,
  MAX_BUY_CHECK_PHOTOS,
  RESULT_FIELDS,
  identifyItem,
  type BuyCheckResult,
  type ConditionValue,
  type ResultField,
} from '@/lib/buy-check';
import { errorMessage, formatHuf, parsePrice } from '@/lib/format';
import { pickPhotos } from '@/lib/photos';
import type { LocalPhoto } from '@/lib/types';

const CONFIDENCE_LABELS = { low: 'Low', medium: 'Medium', high: 'High' } as const;

/** Text fields of the result, in display order. Category and condition are chips. */
const TEXT_FIELDS: { key: ResultField; label: string }[] = [
  { key: 'suggested_name', label: 'Suggested name' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model / style' },
  { key: 'item_type', label: 'Item type' },
  { key: 'size', label: 'Size' },
  { key: 'colour', label: 'Colour' },
  { key: 'material', label: 'Material' },
  { key: 'search_phrase', label: 'Search phrase' },
  { key: 'visible_text', label: 'Text read from tags and labels' },
];

type Edits = Record<ResultField, string>;

const toEdits = (result: BuyCheckResult): Edits =>
  Object.fromEntries(RESULT_FIELDS.map((key) => [key, result.fields[key] ?? ''])) as Edits;

export default function BuyCheckScreen() {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [brand, setBrand] = useState('');
  const [colour, setColour] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState<ConditionValue | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuyCheckResult | null>(null);
  const [edits, setEdits] = useState<Edits | null>(null);

  const price = parsePrice(priceText);
  const busy = checking || picking;
  const canCheck = photos.length > 0 && price.value !== null && !price.error && !busy;

  async function addPhotos(source: 'library' | 'camera') {
    setError(null);
    setPicking(true);
    try {
      const picked = await pickPhotos(source, {
        maxWidth: BUY_CHECK_PHOTO_WIDTH,
        limit: MAX_BUY_CHECK_PHOTOS - photos.length,
      });
      setPhotos((current) => [...current, ...picked].slice(0, MAX_BUY_CHECK_PHOTOS));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPicking(false);
    }
  }

  async function check() {
    if (price.value === null) return;
    setError(null);
    setChecking(true);
    try {
      const next = await identifyItem({ photos, price: price.value, brand, colour, size, condition });
      setResult(next);
      setEdits(toEdits(next));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  function clear() {
    setPhotos([]);
    setPriceText('');
    setBrand('');
    setColour('');
    setSize('');
    setCondition(null);
    setError(null);
    setResult(null);
    setEdits(null);
  }

  const hasAnything = photos.length > 0 || priceText !== '' || brand !== '' || colour !== '' ||
    size !== '' || condition !== null || result !== null;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="items-center p-4"
      keyboardShouldPersistTaps="handled">
      <View className="w-full max-w-xl gap-4">
        {error ? <ErrorBanner message={error} /> : null}

        <View className="gap-2">
          <Text className="text-sm font-medium text-slate-700">
            Photos ({photos.length}/{MAX_BUY_CHECK_PHOTOS})
          </Text>
          {photos.length === 0 && !picking ? (
            <Text className="text-sm text-slate-500">
              Add up to {MAX_BUY_CHECK_PHOTOS} photos. Include the tag or label if you can.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {photos.map((photo) => (
                <PhotoTile
                  key={photo.key}
                  uri={photo.uri}
                  onRemove={() => setPhotos((current) => current.filter((p) => p !== photo))}
                  disabled={checking}
                />
              ))}
              {picking ? (
                <View
                  style={{ width: TILE_SIZE, height: TILE_SIZE }}
                  className="items-center justify-center rounded-lg bg-slate-100">
                  <ActivityIndicator color={BRAND_COLOR} />
                </View>
              ) : null}
            </ScrollView>
          )}
          <View className="flex-row gap-2">
            <Button
              title={Platform.OS === 'web' ? 'Choose files' : 'Gallery'}
              icon="images-outline"
              variant="secondary"
              size="sm"
              onPress={() => addPhotos('library')}
              disabled={busy || photos.length >= MAX_BUY_CHECK_PHOTOS}
            />
            {Platform.OS !== 'web' ? (
              <Button
                title="Camera"
                icon="camera-outline"
                variant="secondary"
                size="sm"
                onPress={() => addPhotos('camera')}
                disabled={busy || photos.length >= MAX_BUY_CHECK_PHOTOS}
              />
            ) : null}
          </View>
        </View>

        <PriceField
          label="Price I would pay (Ft)"
          value={priceText}
          onChangeText={setPriceText}
          error={priceText !== '' ? price.error : undefined}
          editable={!checking}
        />

        <View className="gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <Text className="text-sm font-medium text-slate-700">
            Details you already know (optional)
          </Text>
          <View className="flex-row gap-3">
            <Field label="Brand" value={brand} onChangeText={setBrand} editable={!checking} className="flex-1" />
            <Field label="Colour" value={colour} onChangeText={setColour} editable={!checking} className="flex-1" />
          </View>
          <Field
            label="Size"
            value={size}
            onChangeText={setSize}
            autoCapitalize="characters"
            editable={!checking}
          />
          <View className="gap-1">
            <Text className="text-sm font-medium text-slate-700">Condition</Text>
            <Chips
              options={CONDITION_OPTIONS}
              value={condition}
              onChange={(value) => setCondition(value as ConditionValue | null)}
              disabled={checking}
            />
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Button
            title={result ? 'Check again' : 'Check item'}
            icon="scan-outline"
            onPress={check}
            loading={checking}
            disabled={!canCheck}
          />
          {hasAnything ? (
            <Button title="Clear / new check" variant="secondary" onPress={clear} disabled={checking} />
          ) : null}
        </View>

        {checking ? (
          <Text className="text-sm text-slate-500">Looking at your photos. This takes a few seconds…</Text>
        ) : null}

        {result && edits && !checking ? (
          <ResultCard
            result={result}
            edits={edits}
            onEdit={(key, value) => setEdits({ ...edits, [key]: value })}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function ResultCard({
  result,
  edits,
  onEdit,
}: {
  result: BuyCheckResult;
  edits: Edits;
  onEdit: (key: ResultField, value: string) => void;
}) {
  const hint = (key: ResultField) => {
    if (edits[key] !== (result.fields[key] ?? '')) return 'Edited by you';
    if (result.sources[key] === 'user') return 'You entered this';
    if (result.sources[key] === 'ai') return 'Suggested by the AI';
    return 'Not visible in the photos';
  };

  return (
    <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-base font-semibold text-slate-900">Result</Text>
        <Text className="text-sm text-slate-600">
          Confidence: <Text className="font-semibold">{CONFIDENCE_LABELS[result.confidence]}</Text>
        </Text>
      </View>

      {result.confidence === 'low' ? (
        <View className="flex-row items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Ionicons name="warning-outline" size={18} color="#b45309" />
          <Text className="flex-1 text-sm text-amber-800">
            Check these details. The AI was not sure, so correct anything that is wrong.
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <Text className="text-sm text-slate-600">Your price</Text>
        <Text className="text-base font-semibold text-slate-900">{formatHuf(result.price)}</Text>
      </View>

      {TEXT_FIELDS.slice(0, 1).map(({ key, label }) => (
        <Field key={key} label={label} value={edits[key]} onChangeText={(v) => onEdit(key, v)} hint={hint(key)} />
      ))}

      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-700">Category</Text>
        <Chips
          options={CATEGORY_OPTIONS}
          value={edits.category || null}
          onChange={(value) => onEdit('category', value ?? '')}
        />
        <Text className="text-xs text-slate-500">{hint('category')}</Text>
      </View>

      {TEXT_FIELDS.slice(1).map(({ key, label }) => (
        <Field key={key} label={label} value={edits[key]} onChangeText={(v) => onEdit(key, v)} hint={hint(key)} />
      ))}

      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-700">Condition</Text>
        <Chips
          options={CONDITION_OPTIONS}
          value={edits.condition || null}
          onChange={(value) => onEdit('condition', value ?? '')}
        />
        <Text className="text-xs text-slate-500">{hint('condition')}</Text>
      </View>
    </View>
  );
}

/** A row of toggle chips: tap one to choose it, tap it again to clear. */
function Chips({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
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
