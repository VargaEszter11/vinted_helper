import { useState } from 'react';
import { Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { PhotoPicker } from '@/components/photo-picker';
import { Button, ErrorBanner, Field, PriceField, Segmented, STATUS_LABELS } from '@/components/ui';
import { confirmAsync } from '@/lib/confirm';
import { errorMessage, isValidIsoDate, parsePrice, priceToInput, todayIso } from '@/lib/format';
import { deleteItem, newItemId, saveItem } from '@/lib/items';
import type { Item, ItemPhoto, ItemStatus, ItemValues, LocalPhoto } from '@/lib/types';

const STATUS_OPTIONS = (['in_stock', 'listed', 'sold'] as const).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const MULTILINE_STYLE = { minHeight: 72, textAlignVertical: 'top' } as const;

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
  const [keptPhotos, setKeptPhotos] = useState<ItemPhoto[]>(item?.item_photos ?? []);
  const [newPhotos, setNewPhotos] = useState<LocalPhoto[]>([]);
  const photoUrls = Object.fromEntries(
    (item?.item_photos ?? []).map((photo) => [photo.storage_path, photo.url]),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);

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
    };
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
    </ModalSheet>
  );
}
