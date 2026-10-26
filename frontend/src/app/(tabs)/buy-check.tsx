import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';

import { NO_PRICES, PricesSection, type PricesState } from '@/components/buy-check-prices';
import { PhotoTile, TILE_SIZE } from '@/components/photo-picker';
import { BRAND_COLOR, Button, Chips, ErrorBanner, Field, PriceField } from '@/components/ui';
import {
  BUY_CHECK_PHOTO_WIDTH,
  CATEGORY_OPTIONS,
  CONDITION_OPTIONS,
  MAX_BUY_CHECK_PHOTOS,
  RESULT_FIELDS,
  findPrices,
  identifyItem,
  type BuyCheckResult,
  type ConditionValue,
  type PricesInput,
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

type PricesItem = Omit<PricesInput, 'price'>;

/** The details the price lookup needs, taken from the (possibly corrected) result. */
const pricesItem = (edits: Edits): PricesItem => ({
  search_phrase: edits.search_phrase,
  brand: edits.brand,
  item_type: edits.item_type,
  category: edits.category,
  size: edits.size,
  colour: edits.colour,
  condition: edits.condition,
});

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
  // Changes with every identification, so an old price lookup never stays under a new result.
  const [checkId, setCheckId] = useState(0);
  const [prices, setPrices] = useState<PricesState>(NO_PRICES);
  const priceRun = useRef(0);

  const price = parsePrice(priceText);
  // A new check waits for a running price lookup: the server runs one lookup at a time per user.
  const busy = checking || picking || prices.loading;
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

  /** Looks up prices for the given details. Only the newest lookup's answer is kept. */
  async function lookupPrices(item: PricesItem, forPrice: number) {
    const run = ++priceRun.current;
    setPrices({ loading: true, error: null, data: null });
    try {
      // The first two photos are sent too, so the listings can be compared with the item itself.
      const images = photos.slice(0, 2).map((photo) => photo.base64);
      const data = await findPrices({ ...item, price: forPrice, images });
      if (run === priceRun.current) setPrices({ loading: false, error: null, data });
    } catch (e) {
      if (run === priceRun.current) setPrices({ loading: false, error: errorMessage(e), data: null });
    }
  }

  async function check() {
    if (price.value === null) return;
    setError(null);
    setChecking(true);
    try {
      const next = await identifyItem({ photos, price: price.value, brand, colour, size, condition });
      const nextEdits = toEdits(next);
      setResult(next);
      setEdits(nextEdits);
      setCheckId((current) => current + 1);
      // Prices are looked up right away, without another tap. Not awaited: the item card shows now.
      void lookupPrices(pricesItem(nextEdits), next.price);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  function clear() {
    priceRun.current += 1;
    setPrices(NO_PRICES);
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

        {result && edits && !checking ? (
          <PricesSection
            key={checkId}
            item={pricesItem(edits)}
            state={prices}
            onFind={() => lookupPrices(pricesItem(edits), result.price)}
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
