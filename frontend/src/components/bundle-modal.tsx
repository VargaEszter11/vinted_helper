import { useState } from 'react';
import { Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { Button, ErrorBanner, PriceField } from '@/components/ui';
import { confirmAsync } from '@/lib/confirm';
import { errorMessage, formatHuf, formatItemCount, parsePrice, priceToInput } from '@/lib/format';
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
  const isNew = bundleId === undefined;
  const [id] = useState(() => bundleId ?? newItemId());
  const [listedFor, setListedFor] = useState(priceToInput(items[0]?.bundle_listed_for));
  const [priceError, setPriceError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'unbundling' | null>(null);

  const totalBought = items.reduce((sum, item) => sum + item.bought_for, 0);

  async function handleSave() {
    const price = parsePrice(listedFor);
    const error = price.error ?? (price.value === null ? 'Bundle price is required' : undefined);
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
    const confirmed = await confirmAsync(
      'Unbundle?',
      'The items stay listed, each with its own price.',
      'Unbundle',
    );
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
      title={isNew ? 'Create bundle' : 'Edit bundle'}
      onClose={onClose}
      footer={
        <>
          {isNew ? null : (
            <Button
              title="Unbundle"
              icon="cut-outline"
              variant="danger-ghost"
              onPress={handleUnbundle}
              loading={busy === 'unbundling'}
              disabled={disabled}
            />
          )}
          <View className="flex-1" />
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={disabled} />
          <Button title="Save" onPress={handleSave} loading={busy === 'saving'} disabled={disabled} />
        </>
      }>
      {formError ? <ErrorBanner message={formError} /> : null}
      <View className="gap-1 rounded-lg border border-slate-200 p-3">
        <Text className="text-sm font-medium text-slate-700">
          {formatItemCount(items.length)} · bought for {formatHuf(totalBought)} in total
        </Text>
        {items.map((item) => (
          <Text key={item.id} numberOfLines={1} className="text-sm text-slate-600">
            • {item.name}
          </Text>
        ))}
      </View>
      <PriceField
        label="Bundle price (Ft)"
        value={listedFor}
        onChangeText={(value) => {
          setListedFor(value);
          setPriceError(undefined);
        }}
        hint={isNew ? 'The items will be marked as listed.' : undefined}
        error={priceError}
        editable={!disabled}
        autoFocus
      />
    </ModalSheet>
  );
}
