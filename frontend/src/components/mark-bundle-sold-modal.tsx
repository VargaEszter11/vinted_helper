import { useState } from 'react';
import { Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { Button, ErrorBanner, Field, PriceField } from '@/components/ui';
import {
  errorMessage,
  formatHuf,
  formatItemCount,
  isValidIsoDate,
  parsePrice,
  priceToInput,
  splitEvenly,
  todayIso,
} from '@/lib/format';
import { markBundleSold } from '@/lib/items';
import type { Item } from '@/lib/types';

/** Sells all items of a bundle; the sold price is split evenly between them. */
export function MarkBundleSoldModal({
  bundleId,
  items,
  onClose,
  onSaved,
}: {
  bundleId: string;
  items: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [soldFor, setSoldFor] = useState(priceToInput(items[0]?.bundle_listed_for));
  const [soldDate, setSoldDate] = useState(todayIso());
  const [errors, setErrors] = useState<{ soldFor?: string; soldDate?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const price = parsePrice(soldFor);
  const shares = price.value !== null ? splitEvenly(price.value, items.length) : null;
  const sharesText =
    shares && shares[0] !== shares[shares.length - 1]
      ? `${formatHuf(shares[shares.length - 1])}–${formatHuf(shares[0])}`
      : shares
        ? formatHuf(shares[0])
        : null;

  /** Updates a field and clears its error as soon as the user edits it. */
  const edit = (setter: (value: string) => void, field: keyof typeof errors) => (value: string) => {
    setter(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function handleSave() {
    const next: typeof errors = {};
    if (price.error) next.soldFor = price.error;
    else if (price.value === null) next.soldFor = 'Sold for is required';
    if (!isValidIsoDate(soldDate.trim())) next.soldDate = 'Use the format YYYY-MM-DD';
    setErrors(next);
    if (Object.keys(next).length > 0 || price.value === null) return;

    setSaving(true);
    setFormError(null);
    try {
      await markBundleSold(bundleId, price.value, soldDate.trim());
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      title="Mark bundle as sold"
      onClose={onClose}
      footer={
        <>
          <View className="flex-1" />
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
          <Button title="Mark as sold" onPress={handleSave} loading={saving} />
        </>
      }>
      {formError ? <ErrorBanner message={formError} /> : null}
      <View className="gap-0.5">
        <Text className="text-base font-semibold text-slate-900">
          Bundle of {formatItemCount(items.length)}
        </Text>
        <Text className="text-sm text-slate-500" numberOfLines={2}>
          {items.map((item) => item.name).join(', ')}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <PriceField
          label="Sold for (Ft)"
          value={soldFor}
          onChangeText={edit(setSoldFor, 'soldFor')}
          hint={sharesText ? `Each item: ${sharesText}` : undefined}
          error={errors.soldFor}
          editable={!saving}
          autoFocus
          className="flex-1"
        />
        <Field
          label="Sold date"
          value={soldDate}
          onChangeText={edit(setSoldDate, 'soldDate')}
          placeholder="YYYY-MM-DD"
          error={errors.soldDate}
          editable={!saving}
          className="flex-1"
        />
      </View>
    </ModalSheet>
  );
}
