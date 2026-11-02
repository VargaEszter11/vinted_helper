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
import { useT } from '@/lib/i18n';
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
  const t = useT();
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
    else if (price.value === null) next.soldFor = t('itemForm.soldForRequired');
    if (!isValidIsoDate(soldDate.trim())) next.soldDate = t('itemForm.dateFormat');
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
      title={t('soldModal.bundleTitle', { count: formatItemCount(items.length) })}
      onClose={onClose}
      footer={
        <>
          <View className="flex-1" />
          <Button title={t('common.cancel')} variant="secondary" onPress={onClose} disabled={saving} />
          <Button title={t('soldModal.confirm')} onPress={handleSave} loading={saving} />
        </>
      }>
      {formError ? <ErrorBanner message={formError} /> : null}
      <View className="gap-0.5">
        <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {t('soldModal.bundleTitle', { count: formatItemCount(items.length) })}
        </Text>
        <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={2}>
          {items.map((item) => item.name).join(', ')}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <PriceField
          label={t('itemForm.soldFor')}
          value={soldFor}
          onChangeText={edit(setSoldFor, 'soldFor')}
          hint={sharesText ? t('soldModal.eachItem', { price: sharesText }) : undefined}
          error={errors.soldFor}
          editable={!saving}
          autoFocus
          className="flex-1"
        />
        <Field
          label={t('itemForm.soldDate')}
          value={soldDate}
          onChangeText={edit(setSoldDate, 'soldDate')}
          placeholder={t('itemForm.datePlaceholder')}
          error={errors.soldDate}
          editable={!saving}
          className="flex-1"
        />
      </View>
    </ModalSheet>
  );
}
