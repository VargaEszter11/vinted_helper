import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { PhotoPicker } from '@/components/photo-picker';
import {
  BRAND_COLOR,
  Button,
  CONDITION_OPTIONS,
  Chips,
  ErrorBanner,
  Field,
  PriceField,
  Segmented,
  STATUS_LABELS,
  StatusBadge,
} from '@/components/ui';
import { confirmAsync } from '@/lib/confirm';
import {
  errorMessage,
  formatDateTime,
  formatHuf,
  isValidIsoDate,
  parsePrice,
  priceToInput,
  todayIso,
} from '@/lib/format';
import { CategoryPicker } from '@/components/category-picker';
import { deleteItem, fetchStatusHistory, newItemId, saveItem, suggestItemCategory } from '@/lib/items';
import type {
  Item,
  ItemVintedCategory,
  ItemCondition,
  ItemPhoto,
  ItemStatus,
  ItemValues,
  LocalPhoto,
  StatusChange,
} from '@/lib/types';

const STATUS_OPTIONS = (['in_stock', 'listed', 'sold'] as const).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const MULTILINE_STYLE = { minHeight: 72, textAlignVertical: 'top' } as const;
const AUTO_SUGGEST_MS = 900;

/** Empty optional text is stored as null. */
const optionalText = (value: string) => value.trim() || null;

type FieldErrors =Partial<Record<'name' | 'boughtFor' | 'listedFor' | 'soldFor' | 'soldDate', string>>;

/** Add/edit popup. Pass `item: null` to add a new item. */
export function ItemFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itemId] = useState(() => item?.id ?? newItemId());
  const [name, setName] = useState(item?.name ?? '');
  const [boughtFor, setBoughtFor] = useState(priceToInput(item?.bought_for));
  const [listedFor, setListedFor] = useState(priceToInput(item?.listed_for));
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? 'in_stock');
  const [soldFor, setSoldFor] = useState(priceToInput(item?.sold_for));
  const [soldDate, setSoldDate] = useState(item?.sold_date ?? todayIso());
  const [brand, setBrand] = useState(item?.brand ?? '');
  const [size, setSize] = useState(item?.size ?? '');
  const [measurements, setMeasurements] = useState(item?.measurements ?? '');
  const [flaws, setFlaws] = useState(item?.flaws ?? '');
  const [condition, setCondition] = useState<ItemCondition | null>(item?.condition ?? null);
  const [category, setCategory] = useState<ItemVintedCategory | null>(item?.category ?? null);
  const [categoryFromAi, setCategoryFromAi] = useState(false);
  /** Stops auto-suggest after the user picks a category (including one loaded from the server). */
  const [categoryLocked, setCategoryLocked] = useState(() => Boolean(item?.category));
  const [suggestingCategory, setSuggestingCategory] = useState(false);
  const [categorySuggestError, setCategorySuggestError] = useState<string | null>(null);
  const suggestRun = useRef(0);
  const [keptPhotos, setKeptPhotos] = useState<ItemPhoto[]>(item?.item_photos ?? []);
  const [newPhotos, setNewPhotos] = useState<LocalPhoto[]>([]);
  const photoUrls = Object.fromEntries(
    (item?.item_photos ?? []).map((photo) => [photo.storage_path, photo.url]),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [history, setHistory] = useState<StatusChange[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  /** Updates a field and clears its error as soon as the user edits it. */
  const edit = (setter: (value: string) => void, field: keyof FieldErrors) => (value: string) => {
    setter(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /** Entering a listed price moves an in-stock item to listed. */
  function changeListedFor(value: string) {
    edit(setListedFor, 'listedFor')(value);
    if (value.trim() !== '' && status === 'in_stock') setStatus('listed');
  }

  function changeStatus(next: ItemStatus) {
    if (next === 'sold' && soldFor === '') setSoldFor(listedFor);
    setStatus(next);
  }

  function validate(): ItemValues | null {
    const next: FieldErrors = {};
    const bought = parsePrice(boughtFor);
    const listed = parsePrice(listedFor);
    const sold = parsePrice(soldFor);

    if (name.trim() === '') next.name = 'Name is required';
    if (bought.error) next.boughtFor = bought.error;
    else if (bought.value === null) next.boughtFor = 'Bought for is required';
    if (listed.error) next.listedFor = listed.error;
    if (status === 'sold') {
      if (sold.error) next.soldFor = sold.error;
      else if (sold.value === null) next.soldFor = 'Sold for is required';
      if (!isValidIsoDate(soldDate.trim())) next.soldDate = 'Use the format YYYY-MM-DD';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      name: name.trim(),
      bought_for: bought.value ?? 0,
      listed_for: listed.value,
      status,
      sold_for: status === 'sold' ? sold.value : null,
      sold_date: status === 'sold' ? soldDate.trim() : null,
      brand: optionalText(brand),
      size: optionalText(size),
      measurements: optionalText(measurements),
      flaws: optionalText(flaws),
      condition,
      category,
    };
  }

  const suggestKey = useMemo(
    () =>
      [
        name,
        brand,
        size,
        measurements,
        flaws,
        newPhotos.map((photo) => photo.key).join(','),
        keptPhotos.map((photo) => photo.id).join(','),
      ].join('\n'),
    [name, brand, size, measurements, flaws, newPhotos, keptPhotos],
  );

  useEffect(() => {
    if (categoryLocked || name.trim() === '' || busy !== null) return;

    const timer = setTimeout(() => {
      const run = ++suggestRun.current;
      setSuggestingCategory(true);
      setCategorySuggestError(null);
      void suggestItemCategory({
        name,
        brand: optionalText(brand),
        size: optionalText(size),
        measurements: optionalText(measurements),
        flaws: optionalText(flaws),
        item_id: itemId,
        images: newPhotos.map((photo) => photo.base64).slice(0, 3),
      })
        .then((result) => {
          if (run !== suggestRun.current) return;
          setCategory(result.category);
          setCategoryFromAi(true);
        })
        .catch((e) => {
          if (run !== suggestRun.current) return;
          setCategorySuggestError(errorMessage(e));
        })
        .finally(() => {
          if (run === suggestRun.current) setSuggestingCategory(false);
        });
    }, AUTO_SUGGEST_MS);

    return () => clearTimeout(timer);
  }, [suggestKey, categoryLocked, busy, name, brand, size, measurements, flaws, itemId, newPhotos]);

  async function toggleMore() {
    const next = !showMore;
    setShowMore(next);
    if (!next || !item || history) return;
    setHistoryError(null);
    try {
      setHistory(await fetchStatusHistory(item.id));
    } catch (e) {
      setHistoryError(errorMessage(e));
    }
  }

  async function handleSave() {
    const values = validate();
    if (!values) return;
    setBusy('saving');
    setFormError(null);
    try {
      const originalPhotos = item?.item_photos ?? [];
      await saveItem({
        id: itemId,
        values,
        newPhotos,
        removedPhotos: originalPhotos.filter((photo) => !keptPhotos.includes(photo)),
      });
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!item) return;
    const confirmed = await confirmAsync(
      'Delete item?',
      `“${item.name}” and its photos will be deleted permanently.`,
      'Delete',
    );
    if (!confirmed) return;
    setBusy('deleting');
    setFormError(null);
    try {
      await deleteItem(item);
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  function changeCategory(next: ItemVintedCategory | null) {
    setCategory(next);
    setCategoryFromAi(false);
    setCategoryLocked(next != null);
    setCategorySuggestError(null);
  }

  return (
    <ModalSheet
      title={item ? 'Edit item' : 'Add item'}
      onClose={onClose}
      footer={
        <>
          {item ? (
            <Button
              title="Delete"
              icon="trash-outline"
              variant="danger-ghost"
              onPress={handleDelete}
              loading={busy === 'deleting'}
              disabled={disabled}
            />
          ) : null}
          <View className="flex-1" />
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={disabled} />
          <Button title="Save" onPress={handleSave} loading={busy === 'saving'} disabled={disabled} />
        </>
      }>
      {formError ? <ErrorBanner message={formError} /> : null}
      <PhotoPicker
        existing={keptPhotos}
        existingUrls={photoUrls}
        added={newPhotos}
        onAdd={(photos) => setNewPhotos((current) => [...current, ...photos])}
        onRemoveExisting={(photo) => setKeptPhotos((current) => current.filter((p) => p !== photo))}
        onRemoveAdded={(photo) => setNewPhotos((current) => current.filter((p) => p !== photo))}
        disabled={disabled}
      />
      <Field
        label="Name"
        value={name}
        onChangeText={edit(setName, 'name')}
        placeholder="e.g. Levi's 501 jeans"
        error={errors.name}
        editable={!disabled}
      />
      <View className="flex-row gap-3">
        <Field
          label="Brand"
          value={brand}
          onChangeText={setBrand}
          placeholder="Optional"
          editable={!disabled}
          className="flex-1"
        />
        <Field
          label="Size"
          value={size}
          onChangeText={setSize}
          placeholder="Optional"
          autoCapitalize="characters"
          editable={!disabled}
          className="flex-1"
        />
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-700">Condition</Text>
        <Chips options={CONDITION_OPTIONS} value={condition} onChange={setCondition} disabled={disabled} />
      </View>
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-slate-700">Category</Text>
          {suggestingCategory ? <ActivityIndicator size="small" color={BRAND_COLOR} /> : null}
        </View>
        <CategoryPicker value={category} onChange={changeCategory} disabled={disabled} />
        {categorySuggestError ? (
          <Text className="text-xs text-red-600">{categorySuggestError}</Text>
        ) : categoryLocked ? (
          <Text className="text-xs text-slate-500">You chose this category — clear it to get a new suggestion.</Text>
        ) : categoryFromAi ? (
          <Text className="text-xs text-slate-500">
            Picked automatically from your details{newPhotos.length > 0 || keptPhotos.length > 0 ? ' and photos' : ''}.
            Open the list to override.
          </Text>
        ) : suggestingCategory ? (
          <Text className="text-xs text-slate-500">Finding a category…</Text>
        ) : name.trim() === '' ? (
          <Text className="text-xs text-slate-500">Add a name to get a category suggestion.</Text>
        ) : (
          <Text className="text-xs text-slate-500">Updates when you change the description or photos.</Text>
        )}
      </View>
      <View className="flex-row gap-3">
        <PriceField
          label="Bought for (Ft)"
          value={boughtFor}
          onChangeText={edit(setBoughtFor, 'boughtFor')}
          hint="Including fees and shipping"
          error={errors.boughtFor}
          editable={!disabled}
          className="flex-1"
        />
        <PriceField
          label="Listed for (Ft)"
          value={listedFor}
          onChangeText={changeListedFor}
          hint="Optional"
          error={errors.listedFor}
          editable={!disabled}
          className="flex-1"
        />
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-700">Status</Text>
        <Segmented options={STATUS_OPTIONS} value={status} onChange={changeStatus} disabled={disabled} />
        {item?.bundle_id && item.status === 'listed' && item.bundle_listed_for !== null ? (
          <Text className="text-xs text-slate-500">
            Part of a bundle listed for {formatHuf(item.bundle_listed_for)}. Setting it to In
            stock or Sold takes it out of the bundle.
          </Text>
        ) : null}
      </View>
      {status === 'sold' ? (
        <View className="flex-row gap-3">
          <PriceField
            label="Sold for (Ft)"
            value={soldFor}
            onChangeText={edit(setSoldFor, 'soldFor')}
            error={errors.soldFor}
            editable={!disabled}
            className="flex-1"
          />
          <Field
            label="Sold date"
            value={soldDate}
            onChangeText={edit(setSoldDate, 'soldDate')}
            placeholder="YYYY-MM-DD"
            error={errors.soldDate}
            editable={!disabled}
            className="flex-1"
          />
        </View>
      ) : null}
      <Field
        label="Measurements"
        value={measurements}
        onChangeText={setMeasurements}
        placeholder="Optional, e.g. pit to pit 52 cm, length 70 cm"
        multiline
        style={MULTILINE_STYLE}
        editable={!disabled}
      />
      <Field
        label="Flaws"
        value={flaws}
        onChangeText={setFlaws}
        placeholder="Optional, e.g. small stain on the left sleeve"
        multiline
        style={MULTILINE_STYLE}
        editable={!disabled}
      />
      {item ? (
        <View className="gap-2">
          <Button
            title={showMore ? 'Less' : 'More'}
            variant="ghost"
            size="sm"
            onPress={toggleMore}
            className="self-start"
          />
          {showMore ? (
            <View className="gap-2 rounded-lg border border-slate-200 p-3">
              <Text className="text-sm font-medium text-slate-700">Status history</Text>
              {historyError ? (
                <Text className="text-sm text-red-600">{historyError}</Text>
              ) : history === null ? (
                <Text className="text-sm text-slate-500">Loading…</Text>
              ) : (
                history.map((change, index) => (
                  <View key={`${change.changed_at}-${index}`} className="flex-row items-center gap-3">
                    <StatusBadge status={change.status} />
                    <Text className="text-sm text-slate-600">{formatDateTime(change.changed_at)}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </ModalSheet>
  );
}
