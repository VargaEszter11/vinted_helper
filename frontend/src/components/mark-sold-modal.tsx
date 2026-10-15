import { useState } from 'react';
import { Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { Button, ErrorBanner, Field, PriceField } from '@/components/ui';
import { errorMessage, formatHuf, isValidIsoDate, parsePrice, priceToInput, todayIso } from '@/lib/format';
import { markItemSold } from '@/lib/items';
import type { Item } from '@/lib/types';

export function MarkSoldModal({
  item,
  onClose,
  onSaved,
}: {
  item: Item;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [soldFor, setSoldFor] = useState(priceToInput(item.listed_for));
  const [soldDate, setSoldDate] = useState(todayIso());
  const [errors, setErrors] = useState<{ soldFor?: string; soldDate?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Updates a field and clears its error as soon as the user edits it. */
  const edit = (setter: (value: string) => void, field: keyof typeof errors) => (value: string) => {
    setter(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function handleSave() {
    const sold = parsePrice(soldFor);
    const next: typeof errors = {};
    if (sold.error) next.soldFor = sold.error;
    else if (sold.value === null) next.soldFor = 'Sold for is required';
    if (!isValidIsoDate(soldDate.trim())) next.soldDate = 'Use the format YYYY-MM-DD';
    setErrors(next);
    if (Object.keys(next).length > 0 || sold.value === null) return;

    setSaving(true);
    setFormError(null);
    try {
      await markItemSold(item.id, sold.value, soldDate.trim());
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      title="Mark as sold"
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
        <Text className="text-base font-semibold text-slate-900">{item.name}</Text>
        <Text className="text-sm text-slate-500">Bought for {formatHuf(item.bought_for)}</Text>
      </View>
      <View className="flex-row gap-3">
        <PriceField
          label="Sold for (Ft)"
          value={soldFor}
          onChangeText={edit(setSoldFor, 'soldFor')}
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
