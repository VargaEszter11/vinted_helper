import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { PhotoPicker } from '@/components/photo-picker';
import {
  Button,
  Chips,
  ErrorBanner,
  Field,
  PriceField,
  Segmented,
  STATUS_VALUES,
  StatusBadge,
  getBrandColor,
  useConditionOptions,
} from '@/components/ui';
import { confirmAsync } from '@/lib/confirm';
import {
  errorMessage,
  formatDateTime,
  currencySymbol,
  formatHuf,
  isValidIsoDate,
  parsePrice,
  priceToInput,
  todayIso,
} from '@/lib/format';
import { CategoryPicker } from '@/components/category-picker';
import { useT } from '@/lib/i18n';
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
  const t = useT();
  const conditionOptions = useConditionOptions();
  const statusOptions = STATUS_VALUES.map((value) => ({ value, label: t(`status.${value}`) }));
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

  /** The reverse: putting an item back in stock clears its listed price. */
  function changeStatus(next: ItemStatus) {
    if (next === 'sold' && soldFor === '') setSoldFor(listedFor);
    if (next === 'in_stock') edit(setListedFor, 'listedFor')('');
    setStatus(next);
  }

  function validate(): ItemValues | null {
    const next: FieldErrors = {};
    const bought = parsePrice(boughtFor);
    const listed = parsePrice(listedFor);
    const sold = parsePrice(soldFor);

    if (name.trim() === '') next.name = t('itemForm.nameRequired');
    if (bought.error) next.boughtFor = bought.error;
    else if (bought.value === null) next.boughtFor = t('itemForm.boughtRequired');
    if (listed.error) next.listedFor = listed.error;
    if (status === 'sold') {
      if (sold.error) next.soldFor = sold.error;
      else if (sold.value === null) next.soldFor = t('itemForm.soldForRequired');
      if (!isValidIsoDate(soldDate.trim())) next.soldDate = t('itemForm.dateFormat');
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
      t('itemForm.deleteTitle'),
      t('itemForm.deleteBody', { name: item.name }),
      t('common.delete'),
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
      title={item ? t('itemForm.edit') : t('itemForm.add')}
      onClose={onClose}
      footer={
        <>
          {item ? (
            <Button
              title={t('common.delete')}
              icon="trash-outline"
              variant="danger-ghost"
              onPress={handleDelete}
              loading={busy === 'deleting'}
              disabled={disabled}
            />
          ) : null}
          <View className="flex-1" />
          <Button title={t('common.cancel')} variant="secondary" onPress={onClose} disabled={disabled} />
          <Button title={t('common.save')} onPress={handleSave} loading={busy === 'saving'} disabled={disabled} />
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
        label={t('itemForm.name')}
        value={name}
        onChangeText={edit(setName, 'name')}
        placeholder={t('itemForm.namePlaceholder')}
        error={errors.name}
        editable={!disabled}
      />
      <View className="flex-row gap-3">
        <Field
          label={t('itemForm.brand')}
          value={brand}
          onChangeText={setBrand}
          placeholder={t('common.optional')}
          editable={!disabled}
          className="flex-1"
        />
        <Field
          label={t('itemForm.size')}
          value={size}
          onChangeText={setSize}
          placeholder={t('common.optional')}
          autoCapitalize="characters"
          editable={!disabled}
          className="flex-1"
        />
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('itemForm.condition')}</Text>
        <Chips options={conditionOptions} value={condition} onChange={setCondition} disabled={disabled} />
      </View>
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('itemForm.category')}</Text>
          {suggestingCategory ? <ActivityIndicator size="small" color={getBrandColor()} /> : null}
        </View>
        <CategoryPicker value={category} onChange={changeCategory} disabled={disabled} />
        {categorySuggestError ? (
          <Text className="text-xs text-red-600">{categorySuggestError}</Text>
        ) : categoryLocked ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400">{t('itemForm.categoryLocked')}</Text>
        ) : categoryFromAi ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {t('itemForm.categoryAi', {
              photos: newPhotos.length > 0 || keptPhotos.length > 0 ? t('itemForm.categoryAiPhotos') : '',
            })}
          </Text>
        ) : suggestingCategory ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400">{t('itemForm.categoryFinding')}</Text>
        ) : name.trim() === '' ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400">{t('itemForm.categoryNeedName')}</Text>
        ) : (
          <Text className="text-xs text-slate-500 dark:text-slate-400">{t('itemForm.categoryUpdates')}</Text>
        )}
      </View>
      <View className="flex-row gap-3">
        <PriceField
          label={t('itemForm.boughtFor', { currency: currencySymbol() })}
          value={boughtFor}
          onChangeText={edit(setBoughtFor, 'boughtFor')}
          hint={t('itemForm.boughtHint')}
          error={errors.boughtFor}
          editable={!disabled}
          className="flex-1"
        />
        <PriceField
          label={t('itemForm.listedFor', { currency: currencySymbol() })}
          value={listedFor}
          onChangeText={changeListedFor}
          hint={t('common.optional')}
          error={errors.listedFor}
          editable={!disabled}
          className="flex-1"
        />
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('itemForm.status')}</Text>
        <Segmented options={statusOptions} value={status} onChange={changeStatus} disabled={disabled} />
        {item?.bundle_id && item.status === 'listed' && item.bundle_listed_for !== null ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {t('itemForm.inBundle', { price: formatHuf(item.bundle_listed_for) })}
          </Text>
        ) : null}
      </View>
      {status === 'sold' ? (
        <View className="flex-row gap-3">
          <PriceField
            label={t('itemForm.soldFor', { currency: currencySymbol() })}
            value={soldFor}
            onChangeText={edit(setSoldFor, 'soldFor')}
            error={errors.soldFor}
            editable={!disabled}
            className="flex-1"
          />
          <Field
            label={t('itemForm.soldDate')}
            value={soldDate}
            onChangeText={edit(setSoldDate, 'soldDate')}
            placeholder={t('itemForm.datePlaceholder')}
            error={errors.soldDate}
            editable={!disabled}
            className="flex-1"
          />
        </View>
      ) : null}
      <Field
        label={t('itemForm.measurements')}
        value={measurements}
        onChangeText={setMeasurements}
        placeholder={t('itemForm.measurementsPlaceholder')}
        multiline
        style={MULTILINE_STYLE}
        editable={!disabled}
      />
      <Field
        label={t('itemForm.flaws')}
        value={flaws}
        onChangeText={setFlaws}
        placeholder={t('itemForm.flawsPlaceholder')}
        multiline
        style={MULTILINE_STYLE}
        editable={!disabled}
      />
      {item ? (
        <View className="gap-2">
          <Button
            title={showMore ? t('itemForm.less') : t('itemForm.more')}
            variant="ghost"
            size="sm"
            onPress={toggleMore}
            className="self-start"
          />
          {showMore ? (
            <View className="gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('itemForm.history')}</Text>
              {historyError ? (
                <Text className="text-sm text-red-600">{historyError}</Text>
              ) : history === null ? (
                <Text className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</Text>
              ) : (
                history.map((change, index) => (
                  <View key={`${change.changed_at}-${index}`} className="flex-row items-center gap-3">
                    <StatusBadge status={change.status} />
                    <Text className="text-sm text-slate-600 dark:text-slate-300">{formatDateTime(change.changed_at)}</Text>
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
