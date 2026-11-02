import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { BRAND_COLOR, Button, ErrorBanner, Field, PriceField } from '@/components/ui';
import {
  errorMessage,
  formatHuf,
  isValidIsoDate,
  parsePrice,
  priceToInput,
  splitEvenly,
  todayIso,
} from '@/lib/format';
import { useT } from '@/lib/i18n';
import { markItemSold, newItemId, sellItemsAsBundle } from '@/lib/items';
import type { Item } from '@/lib/types';

/**
 * Marks one item sold, or, when the buyer bundled it with other items, sells them all
 * together and splits the price evenly.
 */
export function MarkSoldModal({
  item,
  otherItems,
  onClose,
  onSaved,
}: {
  item: Item;
  /** Other unsold items the buyer may have bundled with this one. */
  otherItems: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [soldFor, setSoldFor] = useState(priceToInput(item.listed_for));
  const [soldDate, setSoldDate] = useState(todayIso());
  const [asBundle, setAsBundle] = useState(false);
  const [bundledIds, setBundledIds] = useState<string[]>([]);
  // Generated once so a retry after an error doesn't create a second bundle.
  const [bundleId] = useState(newItemId);
  const [errors, setErrors] = useState<{ soldFor?: string; soldDate?: string; items?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const price = parsePrice(soldFor);
  const itemCount = 1 + bundledIds.length;
  const shares = asBundle && price.value !== null ? splitEvenly(price.value, itemCount) : null;
  const sharesHint =
    shares && bundledIds.length > 0
      ? t('soldModal.eachItem', {
          price:
            shares[0] === shares[shares.length - 1]
              ? formatHuf(shares[0])
              : `${formatHuf(shares[shares.length - 1])}–${formatHuf(shares[0])}`,
        })
      : undefined;

  /** Updates a field and clears its error as soon as the user edits it. */
  const edit = (setter: (value: string) => void, field: keyof typeof errors) => (value: string) => {
    setter(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  function toggleBundled(id: string) {
    setBundledIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
    setErrors((current) => ({ ...current, items: undefined }));
  }

  async function handleSave() {
    const next: typeof errors = {};
    if (price.error) next.soldFor = price.error;
    else if (price.value === null) next.soldFor = t('itemForm.soldForRequired');
    if (!isValidIsoDate(soldDate.trim())) next.soldDate = t('itemForm.dateFormat');
    if (asBundle && bundledIds.length === 0) next.items = t('soldModal.needOthers');
    setErrors(next);
    if (Object.keys(next).length > 0 || price.value === null) return;

    setSaving(true);
    setFormError(null);
    try {
      if (asBundle) {
        await sellItemsAsBundle(bundleId, [item.id, ...bundledIds], price.value, soldDate.trim());
      } else {
        await markItemSold(item.id, price.value, soldDate.trim());
      }
      onSaved();
    } catch (e) {
      setFormError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      title={t('soldModal.title')}
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
        <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.name}</Text>
        <Text className="text-sm text-slate-500 dark:text-slate-400">{t('soldModal.boughtFor', { price: formatHuf(item.bought_for) })}</Text>
      </View>

      {otherItems.length > 0 ? (
        <CheckRow
          label={t('soldModal.asBundle')}
          checked={asBundle}
          onPress={() => setAsBundle(!asBundle)}
          disabled={saving}
        />
      ) : null}

      {asBundle ? (
        <View className="gap-1">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('soldModal.otherItems')}</Text>
          <View className="rounded-lg border border-slate-200 dark:border-slate-700">
            {otherItems.map((other) => (
              <CheckRow
                key={other.id}
                label={other.name}
                detail={t('soldModal.bought', { price: formatHuf(other.bought_for) })}
                checked={bundledIds.includes(other.id)}
                onPress={() => toggleBundled(other.id)}
                disabled={saving}
                compact
              />
            ))}
          </View>
          {errors.items ? <Text className="text-xs text-red-600">{errors.items}</Text> : null}
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <PriceField
          label={asBundle ? t('soldModal.bundleSoldFor') : t('itemForm.soldFor')}
          value={soldFor}
          onChangeText={edit(setSoldFor, 'soldFor')}
          hint={sharesHint}
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

function CheckRow({
  label,
  detail,
  checked,
  onPress,
  disabled,
  compact = false,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onPress: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 active:bg-slate-50 ${compact ? 'px-3 py-2' : 'py-1'}`}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? BRAND_COLOR : '#94a3b8'}
      />
      <Text numberOfLines={1} className="flex-1 text-sm text-slate-800 dark:text-slate-200">
        {label}
      </Text>
      {detail ? <Text className="text-xs text-slate-500 dark:text-slate-400">{detail}</Text> : null}
    </Pressable>
  );
}
