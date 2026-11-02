import { useState } from 'react';
import { Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { Button, ErrorBanner, PriceField } from '@/components/ui';
import { confirmAsync } from '@/lib/confirm';
import { errorMessage, formatHuf, formatItemCount, parsePrice, priceToInput } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { deleteBundle, newItemId, saveBundle } from '@/lib/items';
import type { Item } from '@/lib/types';

/**
 * Creates a bundle from `items` (pass no `bundleId`) or edits an existing bundle's price
 * and lets you unbundle it.
 */
export function BundleModal({
  bundleId,
  items,
  onClose,
  onSaved,
}: {
  bundleId?: string;
  items: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const isNew = bundleId === undefined;
  const [id] = useState(() => bundleId ?? newItemId());
  const [listedFor, setListedFor] = useState(priceToInput(items[0]?.bundle_listed_for));
  const [priceError, setPriceError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'unbundling' | null>(null);

  const totalBought = items.reduce((sum, item) => sum + item.bought_for, 0);

  async function handleSave() {
    const price = parsePrice(listedFor);
    const error = price.error ?? (price.value === null ? t('bundle.priceRequired') : undefined);
    setPriceError(error);
    if (error || price.value === null) return;

    setBusy('saving');
    setFormError(null);
    try {
      await saveBundle(id, price.value, isNew ? items.map((item) => item.id) : undefined);
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setBusy(null);
    }
  }

  async function handleUnbundle() {
    const confirmed = await confirmAsync(t('bundle.unbundleTitle'), t('bundle.unbundleBody'), t('bundle.unbundle'));
    if (!confirmed) return;
    setBusy('unbundling');
    setFormError(null);
    try {
      await deleteBundle(id);
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <ModalSheet
      title={isNew ? t('bundle.create') : t('bundle.edit')}
      onClose={onClose}
      footer={
        <>
          {isNew ? null : (
            <Button
              title={t('bundle.unbundle')}
              icon="cut-outline"
              variant="danger-ghost"
              onPress={handleUnbundle}
              loading={busy === 'unbundling'}
              disabled={disabled}
            />
          )}
          <View className="flex-1" />
          <Button title={t('common.cancel')} variant="secondary" onPress={onClose} disabled={disabled} />
          <Button title={t('common.save')} onPress={handleSave} loading={busy === 'saving'} disabled={disabled} />
        </>
      }>
      {formError ? <ErrorBanner message={formError} /> : null}
      <View className="gap-1 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('bundle.summary', { count: formatItemCount(items.length), total: formatHuf(totalBought) })}
        </Text>
        {items.map((item) => (
          <Text key={item.id} numberOfLines={1} className="text-sm text-slate-600 dark:text-slate-300">
            • {item.name}
          </Text>
        ))}
      </View>
      <PriceField
        label={t('bundle.price')}
        value={listedFor}
        onChangeText={(value) => {
          setListedFor(value);
          setPriceError(undefined);
        }}
        hint={isNew ? t('bundle.listedHint') : undefined}
        error={priceError}
        editable={!disabled}
        autoFocus
      />
    </ModalSheet>
  );
}
