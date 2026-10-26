import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { ItemFormModal } from '@/components/item-form-modal';
import { Thumbnail } from '@/components/thumbnail';
import {
  BRAND_COLOR,
  Button,
  CenteredSpinner,
  CONDITION_OPTIONS,
  EmptyState,
  ErrorBanner,
  ErrorState,
  FilterSelect,
  HeaderText,
  Money,
  SearchField,
  profitColor,
  useWideLayout,
} from '@/components/ui';
import { useItemList } from '@/hooks/use-item-list';
import { formatHuf, formatItemCount } from '@/lib/format';
import { filterOptions, itemMatchesFilters, itemMatchesQuery, NO_FILTERS, type ItemFilters } from '@/lib/items';
import type { Item, ItemStatus } from '@/lib/types';

const SOLD: ItemStatus[] = ['sold'];

const profitOf = (item: Item) => (item.sold_for ?? 0) - item.bought_for;

export default function SoldScreen() {
  const { items, thumbnailFor, loading, refreshing, error, reload, refresh, retry } = useItemList(
    SOLD,
    'sold_date',
  );
  const [editing, setEditing] = useState<Item | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ItemFilters>(NO_FILTERS);
  const wide = useWideLayout();

  const searching = query.trim().length > 0;
  const filtering = filters.brand !== null || filters.size !== null || filters.condition !== null;
  const { brands, sizes } = filterOptions(items);
  const visibleItems = items.filter(
    (item) => itemMatchesQuery(item, query) && itemMatchesFilters(item, filters),
  );
  const totalProfit = visibleItems.reduce((sum, item) => sum + profitOf(item), 0);

  const thumbSize = wide ? 48 : 40;
  const rowClass = wide ? 'gap-4 px-4' : 'gap-2 px-3';
  const moneyClass = wide ? 'w-28 text-sm' : 'w-[68px] text-[13px]';

  return (
    <View className="flex-1 bg-slate-50">
      <View className="w-full max-w-5xl flex-1 self-center">
        <View className="gap-2 px-3 py-3">
          <SearchField value={query} onChangeText={setQuery} />
          <View className="flex-row flex-wrap items-center gap-2">
            {brands.length > 0 ? (
              <FilterSelect
                label="Brand"
                options={brands.map((brand) => ({ value: brand, label: brand }))}
                value={filters.brand}
                onChange={(brand) => setFilters((current) => ({ ...current, brand }))}
              />
            ) : null}
            {sizes.length > 0 ? (
              <FilterSelect
                label="Size"
                options={sizes.map((size) => ({ value: size, label: size }))}
                value={filters.size}
                onChange={(size) => setFilters((current) => ({ ...current, size }))}
              />
            ) : null}
            <FilterSelect
              label="Condition"
              options={CONDITION_OPTIONS}
              value={filters.condition}
              onChange={(condition) => setFilters((current) => ({ ...current, condition }))}
            />
            {filtering ? (
              <Button title="Clear filters" variant="ghost" size="sm" onPress={() => setFilters(NO_FILTERS)} />
            ) : null}
          </View>
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
            data={visibleItems}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND_COLOR} />
            }
            ListEmptyComponent={
              items.length === 0 ? (
                <EmptyState title="Nothing sold yet">
                  Items you mark as sold show up here.
                </EmptyState>
              ) : (
                <EmptyState title="No items match your search" />
              )
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

        {!loading && visibleItems.length > 0 ? (
          <View
            className={`flex-row items-center justify-between border-t border-slate-200 bg-white py-3 ${rowClass}`}>
            <Text className="text-base font-semibold text-slate-900">
              {searching || filtering ? 'Profit' : 'Total profit'}
              <Text className="text-sm font-normal text-slate-500">
                {searching || filtering
                  ? `  ·  ${visibleItems.length} of ${formatItemCount(items.length)}`
                  : `  ·  ${formatItemCount(items.length)}`}
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
