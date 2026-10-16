import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { ItemFormModal } from '@/components/item-form-modal';
import { Thumbnail } from '@/components/thumbnail';
import {
  BRAND_COLOR,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  ErrorState,
  HeaderText,
  Money,
  profitColor,
  useWideLayout,
} from '@/components/ui';
import { useItemList } from '@/hooks/use-item-list';
import { formatHuf, formatItemCount } from '@/lib/format';
import type { Item, ItemStatus } from '@/lib/types';

const SOLD: ItemStatus[] = ['sold'];

const profitOf = (item: Item) => (item.sold_for ?? 0) - item.bought_for;

export default function SoldScreen() {
  const { items, thumbnailFor, loading, refreshing, error, reload, refresh, retry } = useItemList(
    SOLD,
    'sold_date',
  );
  const [editing, setEditing] = useState<Item | null>(null);
  const wide = useWideLayout();

  const totalProfit = items.reduce((sum, item) => sum + profitOf(item), 0);

  const thumbSize = wide ? 48 : 40;
  const rowClass = wide ? 'gap-4 px-4' : 'gap-2 px-3';
  const moneyClass = wide ? 'w-28 text-sm' : 'w-[68px] text-[13px]';

  return (
    <View className="flex-1 bg-slate-50">
      <View className="w-full max-w-5xl flex-1 self-center">
        {error && items.length > 0 ? (
          <View className="px-3 pt-3">
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <View className={`flex-row items-center border-b border-slate-200 py-2 ${rowClass}`}>
          <View style={{ width: thumbSize }} />
          <HeaderText className="flex-1">Name</HeaderText>
          <HeaderText className={`text-right ${moneyClass}`}>Bought</HeaderText>
          <HeaderText className={`text-right ${moneyClass}`}>Sold for</HeaderText>
          {wide ? <HeaderText className="w-28 text-right">Sold date</HeaderText> : null}
          <HeaderText className={`text-right ${moneyClass}`}>Profit</HeaderText>
        </View>

        {loading ? (
          <CenteredSpinner />
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND_COLOR} />
            }
            ListEmptyComponent={
              <EmptyState title="Nothing sold yet">
                Items you mark as sold show up here.
              </EmptyState>
            }
            renderItem={({ item }) => {
              const profit = profitOf(item);
              return (
                <Pressable
                  onPress={() => setEditing(item)}
                  accessibilityRole="button"
                  className={`flex-row items-center border-b border-slate-100 bg-white py-2.5 active:bg-slate-50 ${rowClass}`}>
                  <Thumbnail uri={thumbnailFor(item)} size={thumbSize} />
                  <View className="flex-1 gap-0.5">
                    <Text numberOfLines={2} className="text-sm font-medium text-slate-900">
                      {item.name}
                    </Text>
                    {wide ? null : <Text className="text-xs text-slate-500">{item.sold_date}</Text>}
                    {item.bundle_id ? (
                      <Text className="text-xs font-medium text-teal-700">Sold in a bundle</Text>
                    ) : null}
                  </View>
                  <Money value={item.bought_for} className={moneyClass} />
                  <Money value={item.sold_for} className={moneyClass} />
                  {wide ? (
                    <Text className="w-28 text-right text-sm text-slate-700">{item.sold_date}</Text>
                  ) : null}
                  <Money
                    value={profit}
                    className={`font-semibold ${moneyClass}`}
                    textClassName={profitColor(profit)}
                  />
                </Pressable>
              );
            }}
          />
        )}

        {!loading && items.length > 0 ? (
          <View
            className={`flex-row items-center justify-between border-t border-slate-200 bg-white py-3 ${rowClass}`}>
            <Text className="text-base font-semibold text-slate-900">
              Total profit
              <Text className="text-sm font-normal text-slate-500">
                {`  ·  ${formatItemCount(items.length)}`}
              </Text>
            </Text>
            <Text className={`text-base font-bold ${profitColor(totalProfit)}`}>
              {formatHuf(totalProfit)}
            </Text>
          </View>
        ) : null}
      </View>

      {editing ? (
        <ItemFormModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </View>
  );
}
