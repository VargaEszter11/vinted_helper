import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { BundleModal } from '@/components/bundle-modal';
import { ItemFormModal } from '@/components/item-form-modal';
import { MarkBundleSoldModal } from '@/components/mark-bundle-sold-modal';
import { MarkSoldModal } from '@/components/mark-sold-modal';
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
  Segmented,
  StatusBadge,
  useWideLayout,
} from '@/components/ui';
import { useItemList } from '@/hooks/use-item-list';
import { formatItemCount } from '@/lib/format';
import { filterOptions, itemMatchesFilters, itemMatchesQuery, NO_FILTERS, type ItemFilters } from '@/lib/items';
import type { Item, ItemStatus } from '@/lib/types';

const UNSOLD: ItemStatus[] = ['in_stock', 'listed'];

type Filter = 'all' | 'in_stock' | 'listed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'listed', label: 'Listed' },
];

type Row =
  | { kind: 'item'; item: Item; inBundle: boolean }
  | { kind: 'bundle'; id: string; items: Item[] };

type BundleTarget = { id: string; items: Item[] };

/** Groups bundled items under a bundle row, placed where the bundle's newest item would be. */
function buildRows(visibleItems: Item[], allItems: Item[]): Row[] {
  const members = new Map<string, Item[]>();
  for (const item of allItems) {
    if (item.bundle_id) members.set(item.bundle_id, [...(members.get(item.bundle_id) ?? []), item]);
  }
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const item of visibleItems) {
    if (!item.bundle_id) {
      rows.push({ kind: 'item', item, inBundle: false });
    } else if (!seen.has(item.bundle_id)) {
      seen.add(item.bundle_id);
      const bundleItems = members.get(item.bundle_id) ?? [item];
      rows.push({ kind: 'bundle', id: item.bundle_id, items: bundleItems });
      for (const member of bundleItems) rows.push({ kind: 'item', item: member, inBundle: true });
    }
  }
  return rows;
}

const rowKey = (row: Row) =>
  row.kind === 'bundle' ? `bundle-${row.id}` : `${row.inBundle ? 'bundled' : 'item'}-${row.item.id}`;

export default function ItemsScreen() {
  const { items, thumbnailFor, loading, refreshing, error, reload, refresh, retry } = useItemList(
    UNSOLD,
    'created_at',
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ItemFilters>(NO_FILTERS);
  // undefined: closed, null: adding a new item
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [selling, setSelling] = useState<Item | null>(null);
  // Bundle select mode: the ids of the items picked so far, or null when not selecting.
  const [selected, setSelected] = useState<string[] | null>(null);
  // A bundle being created (no id) or edited.
  const [bundleEditing, setBundleEditing] = useState<{ id?: string; items: Item[] } | null>(null);
  const [bundleSelling, setBundleSelling] = useState<BundleTarget | null>(null);
  const wide = useWideLayout();

  const searching = query.trim().length > 0;
  const filtering = filters.brand !== null || filters.size !== null || filters.condition !== null;
  const statusItems = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const { brands, sizes } = filterOptions(statusItems);
  const matches = (item: Item) => itemMatchesQuery(item, query) && itemMatchesFilters(item, filters);
  // A bundle stays together when any of its items match, so the bundle price still makes sense.
  const matchedBundleIds = new Set(
    statusItems.filter((item) => item.bundle_id && matches(item)).map((item) => item.bundle_id),
  );
  const visibleItems = statusItems.filter(
    (item) => matches(item) || (item.bundle_id != null && matchedBundleIds.has(item.bundle_id)),
  );
  const rows = buildRows(visibleItems, items);
  const selecting = selected !== null;

  const thumbSize = wide ? 48 : 40;
  const rowClass = wide ? 'gap-4 px-4' : 'gap-2 px-3';
  const moneyClass = wide ? 'w-28 text-sm' : 'w-[68px] text-[13px]';
  const actionClass = wide ? 'w-32' : 'w-16';

  function closeAndReload() {
    setEditing(undefined);
    setSelling(null);
    setBundleEditing(null);
    setBundleSelling(null);
    setSelected(null);
    reload();
  }

  function toggleSelected(id: string) {
    setSelected((current) =>
      current?.includes(id) ? current.filter((x) => x !== id) : [...(current ?? []), id],
    );
  }

  function renderItemRow(item: Item, inBundle: boolean) {
    const isSelected = selected?.includes(item.id) ?? false;
    // Bundled items can't be picked for a new bundle.
    const dimmed = selecting && inBundle;
    return (
      <Pressable
        onPress={() => (selecting ? toggleSelected(item.id) : setEditing(item))}
        disabled={dimmed}
        style={dimmed ? { opacity: 0.4 } : undefined}
        className={`flex-row items-center border-b border-slate-100 py-2.5 active:bg-slate-50 ${
          isSelected ? 'bg-teal-50' : 'bg-white'
        } ${inBundle ? 'border-l-4 border-l-teal-300' : ''} ${rowClass}`}>
        <Thumbnail uri={thumbnailFor(item)} size={thumbSize} />
        <View className="flex-1 gap-1">
          <Text numberOfLines={2} className="text-sm font-medium text-slate-900">
            {item.name}
          </Text>
          {wide ? null : (
            <View className="flex-row items-center gap-1.5">
              <StatusBadge status={item.status} />
              <Text className="text-xs text-slate-500">{item.status_changed_at.slice(0, 10)}</Text>
            </View>
          )}
        </View>
        <Money value={item.bought_for} className={moneyClass} />
        <Money value={item.listed_for} className={moneyClass} />
        {wide ? (
          <View className="w-24 gap-0.5">
            <StatusBadge status={item.status} />
            <Text className="text-xs text-slate-500">{item.status_changed_at.slice(0, 10)}</Text>
          </View>
        ) : null}
        <View className={`items-center ${actionClass}`}>
          {selecting ? (
            inBundle ? null : (
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={24}
                color={isSelected ? BRAND_COLOR : '#94a3b8'}
                accessibilityLabel={isSelected ? 'Selected' : 'Not selected'}
              />
            )
          ) : inBundle ? null : (
            <Button
              title={wide ? 'Mark as sold' : 'Sold'}
              variant="secondary"
              size="sm"
              onPress={() => setSelling(item)}
              className="w-full"
            />
          )}
        </View>
      </Pressable>
    );
  }

  function renderBundleRow(bundle: BundleTarget) {
    const totalBought = bundle.items.reduce((sum, item) => sum + item.bought_for, 0);
    return (
      <Pressable
        onPress={() => setBundleEditing(bundle)}
        accessibilityLabel={`Bundle of ${formatItemCount(bundle.items.length)}`}
        disabled={selecting}
        style={selecting ? { opacity: 0.4 } : undefined}
        className={`flex-row items-center border-b border-l-4 border-slate-100 border-l-teal-600 bg-teal-50 py-2.5 active:bg-teal-100 ${rowClass}`}>
        <View
          style={{ width: thumbSize, height: thumbSize }}
          className="items-center justify-center rounded-lg bg-teal-100">
          <Ionicons name="albums-outline" size={thumbSize * 0.5} color={BRAND_COLOR} />
        </View>
        <View className="flex-1 gap-1">
          <Text numberOfLines={1} className="text-sm font-semibold text-slate-900">
            Bundle
          </Text>
          <View className="flex-row items-center gap-1.5">
            {wide ? null : <StatusBadge status="listed" />}
            <Text className="text-xs text-slate-500">{formatItemCount(bundle.items.length)}</Text>
          </View>
        </View>
        <Money value={totalBought} className={moneyClass} />
        <Money
          value={bundle.items[0]?.bundle_listed_for ?? null}
          className={`font-semibold ${moneyClass}`}
          textClassName="text-slate-900"
        />
        {wide ? (
          <View className="w-24">
            <StatusBadge status="listed" />
          </View>
        ) : null}
        <View className={`items-center ${actionClass}`}>
          {selecting ? null : (
            <Button
              title={wide ? 'Mark as sold' : 'Sold'}
              variant="secondary"
              size="sm"
              onPress={() => setBundleSelling(bundle)}
              className="w-full"
            />
          )}
        </View>
      </Pressable>
    );
  }

  const selectedItems = items.filter((item) => selected?.includes(item.id));

  return (
    <View className="flex-1 bg-slate-50">
      <View className="w-full max-w-5xl flex-1 self-center">
        {selecting ? (
          <View className="flex-row flex-wrap items-center gap-3 px-3 pt-3">
            <Text className="min-w-[160px] flex-1 text-sm text-slate-700">
              Tap the items you listed together.
            </Text>
            <View className="flex-row gap-2">
              <Button title="Cancel" variant="secondary" onPress={() => setSelected(null)} />
              <Button
                title={`Create bundle (${selected.length})`}
                icon="albums-outline"
                onPress={() => setBundleEditing({ items: selectedItems })}
                disabled={selected.length < 2}
              />
            </View>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center gap-3 px-3 pt-3">
            <View className="min-w-[220px] flex-1">
              <Segmented options={FILTERS} value={filter} onChange={setFilter} />
            </View>
            <View className="flex-row gap-2">
              <Button title="Add item" icon="add" onPress={() => setEditing(null)} />
              <Button
                title="Bundle"
                icon="albums-outline"
                variant="secondary"
                onPress={() => setSelected([])}
                disabled={items.length < 2}
              />
            </View>
          </View>
        )}

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
            data={rows}
            keyExtractor={rowKey}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND_COLOR} />
            }
            ListEmptyComponent={
              items.length === 0 ? (
                <EmptyState title="No items in stock">
                  Tap “Add item” to add the first thing you bought.
                </EmptyState>
              ) : (
                <EmptyState
                  title={
                    searching || filtering ? 'No items match your search' : 'No items match this filter'
                  }
                />
              )
            }
            renderItem={({ item: row }) =>
              row.kind === 'bundle' ? renderBundleRow(row) : renderItemRow(row.item, row.inBundle)
            }
          />
        )}

        {!loading && items.length > 0 ? (
          <View className={`border-t border-slate-200 bg-white py-3 ${rowClass}`}>
            <Text className="text-sm font-medium text-slate-700">
              {filter === 'all' && !searching && !filtering
                ? formatItemCount(items.length)
                : `${visibleItems.length} of ${formatItemCount(items.length)}`}
            </Text>
          </View>
        ) : null}
      </View>

      {editing !== undefined ? (
        <ItemFormModal
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={closeAndReload}
        />
      ) : null}
      {selling ? (
        <MarkSoldModal
          item={selling}
          otherItems={items.filter((item) => item.id !== selling.id)}
          onClose={() => setSelling(null)}
          onSaved={closeAndReload}
        />
      ) : null}
      {bundleEditing ? (
        <BundleModal
          bundleId={bundleEditing.id}
          items={bundleEditing.items}
          onClose={() => setBundleEditing(null)}
          onSaved={closeAndReload}
        />
      ) : null}
      {bundleSelling ? (
        <MarkBundleSoldModal
          bundleId={bundleSelling.id}
          items={bundleSelling.items}
          onClose={() => setBundleSelling(null)}
          onSaved={closeAndReload}
        />
      ) : null}
    </View>
  );
}
