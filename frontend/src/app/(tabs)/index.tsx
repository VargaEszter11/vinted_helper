import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { ItemFormModal } from '@/components/item-form-modal';
import { MarkSoldModal } from '@/components/mark-sold-modal';
import { Thumbnail } from '@/components/thumbnail';
import {
  BRAND_COLOR,
  Button,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  ErrorState,
  HeaderText,
  Money,
  Segmented,
  StatusBadge,
  useWideLayout,
} from '@/components/ui';
import { useItemList } from '@/hooks/use-item-list';
import type { Item, ItemStatus } from '@/lib/types';

const UNSOLD: ItemStatus[] = ['in_stock', 'listed'];

type Filter = 'all' | 'in_stock' | 'listed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'listed', label: 'Listed' },
];

export default function ItemsScreen() {
  const { items, thumbnailFor, loading, refreshing, error, reload, refresh, retry } = useItemList(
    UNSOLD,
    'created_at',
  );
  const [filter, setFilter] = useState<Filter>('all');
  // undefined: closed, null: adding a new item
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [selling, setSelling] = useState<Item | null>(null);
  const wide = useWideLayout();

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.status === filter);

  const thumbSize = wide ? 48 : 40;
  const rowClass = wide ? 'gap-4 px-4' : 'gap-2 px-3';
  const moneyClass = wide ? 'w-28 text-sm' : 'w-[68px] text-[13px]';
  const actionClass = wide ? 'w-32' : 'w-16';

  function closeAndReload() {
    setEditing(undefined);
    setSelling(null);
    reload();
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="w-full max-w-5xl flex-1 self-center">
        <View className="flex-row flex-wrap items-center gap-3 px-3 py-3">
          <View className="min-w-[220px] flex-1">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          </View>
          <Button title="Add item" icon="add" onPress={() => setEditing(null)} />
        </View>

        {error && items.length > 0 ? (
          <View className="px-3 pb-3">
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <View className={`flex-row items-center border-b border-slate-200 py-2 ${rowClass}`}>
          <View style={{ width: thumbSize }} />
          <HeaderText className="flex-1">Name</HeaderText>
          <HeaderText className={`text-right ${moneyClass}`}>Bought</HeaderText>
          <HeaderText className={`text-right ${moneyClass}`}>Listed</HeaderText>
          {wide ? <HeaderText className="w-24">Status</HeaderText> : null}
          <View className={actionClass} />
        </View>

        {loading ? (
          <CenteredSpinner />
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND_COLOR} />
            }
            ListEmptyComponent={
              items.length === 0 ? (
                <EmptyState title="No items in stock">
                  Tap “Add item” to add the first thing you bought.
                </EmptyState>
              ) : (
                <EmptyState title="No items match this filter" />
              )
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setEditing(item)}
                className={`flex-row items-center border-b border-slate-100 bg-white py-2.5 active:bg-slate-50 ${rowClass}`}>
                <Thumbnail uri={thumbnailFor(item)} size={thumbSize} />
                <View className="flex-1 gap-1">
                  <Text numberOfLines={2} className="text-sm font-medium text-slate-900">
                    {item.name}
                  </Text>
                  {wide ? null : <StatusBadge status={item.status} />}
                </View>
                <Money value={item.bought_for} className={moneyClass} />
                <Money value={item.listed_for} className={moneyClass} />
                {wide ? (
                  <View className="w-24">
                    <StatusBadge status={item.status} />
                  </View>
                ) : null}
                <Button
                  title={wide ? 'Mark as sold' : 'Sold'}
                  variant="secondary"
                  size="sm"
                  onPress={() => setSelling(item)}
                  className={actionClass}
                />
              </Pressable>
            )}
          />
        )}
      </View>

      {editing !== undefined ? (
        <ItemFormModal
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={closeAndReload}
        />
      ) : null}
      {selling ? (
        <MarkSoldModal item={selling} onClose={() => setSelling(null)} onSaved={closeAndReload} />
      ) : null}
    </View>
  );
}
