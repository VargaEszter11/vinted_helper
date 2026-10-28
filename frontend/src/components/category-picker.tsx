import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';

import { BRAND_COLOR, SearchField } from '@/components/ui';
import {
  searchVintedCategories,
  vintedCategoryById,
  type ItemVintedCategory,
  type VintedCategoryEntry,
} from '@/lib/item-vinted-categories';

const LIST_MAX_HEIGHT = 320;

type CategoryOption = { value: ItemVintedCategory; label: string };

function filterOptionsByQuery(options: CategoryOption[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) => option.label.toLowerCase().includes(needle));
}

/** Filter chip for list screens: searchable list of categories that appear in the inventory. */
export function CategoryFilterSelect({
  value,
  options,
  onChange,
}: {
  value: ItemVintedCategory | null;
  options: CategoryOption[];
  onChange: (value: ItemVintedCategory | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    (value ? vintedCategoryById(value)?.path : null);
  const active = selectedLabel != null;
  const results = useMemo(() => {
    if (options.length > 0) {
      return filterOptionsByQuery(options, query);
    }
    return searchVintedCategories(query).map((entry) => ({
      value: entry.id,
      label: entry.path,
    }));
  }, [options, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(next: ItemVintedCategory) {
    onChange(next);
    close();
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Filter by category"
        className={`flex-row items-center gap-1 rounded-lg border px-3 py-2 ${
          active ? 'border-teal-700 bg-teal-50' : 'border-slate-300 bg-white active:bg-slate-100'
        }`}>
        <Text
          numberOfLines={1}
          className={`max-w-[140px] text-sm ${active ? 'font-semibold text-teal-800' : 'text-slate-700'}`}>
          {selectedLabel ?? 'Category'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={active ? BRAND_COLOR : '#64748b'} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={close}>
        <View className="flex-1 items-center justify-center bg-black/40 p-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="absolute inset-0"
            onPress={close}
          />
          <View
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white"
            style={Platform.OS === 'web' ? { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)' } : undefined}>
            <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3">
              <Text className="text-base font-semibold text-slate-900">Category</Text>
              <Pressable onPress={close} accessibilityLabel="Close" className="rounded-full p-1.5 active:bg-slate-100">
                <Ionicons name="close" size={20} color="#475569" />
              </Pressable>
            </View>
            <View className="border-b border-slate-100 px-4 py-3">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={
                  options.length > 0 ? 'Search categories in your items' : 'Search e.g. jeans, stroller, vinyl'
                }
              />
            </View>
            <Pressable
              onPress={() => {
                onChange(null);
                close();
              }}
              className="border-b border-slate-100 px-4 py-2.5 active:bg-slate-50">
              <Text className="text-sm text-slate-600">All categories</Text>
            </Pressable>
            <FlatList
              data={results}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: LIST_MAX_HEIGHT }}
              ListEmptyComponent={
                <Text className="px-4 py-6 text-center text-sm text-slate-500">No categories match.</Text>
              }
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <Pressable
                    onPress={() => choose(item.value)}
                    className={`border-b border-slate-50 px-4 py-2.5 ${selected ? 'bg-teal-50' : 'active:bg-slate-50'}`}>
                    <Text
                      numberOfLines={2}
                      className={`text-sm leading-snug ${selected ? 'font-semibold text-teal-900' : 'text-slate-800'}`}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

export function CategoryPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ItemVintedCategory | null;
  onChange: (value: ItemVintedCategory | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = value ? vintedCategoryById(value) : null;
  const results = useMemo(() => searchVintedCategories(query), [query]);

  function choose(entry: VintedCategoryEntry) {
    onChange(entry.id);
    setOpen(false);
    setQuery('');
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Choose category"
        className={`flex-row items-center gap-2 rounded-lg border px-3 py-2.5 ${
          selected ? 'border-teal-700 bg-teal-50' : 'border-slate-300 bg-white active:bg-slate-100'
        } ${disabled ? 'opacity-50' : ''}`}>
        <Ionicons name="folder-outline" size={18} color={selected ? BRAND_COLOR : '#64748b'} />
        <Text
          numberOfLines={2}
          className={`flex-1 text-sm ${selected ? 'font-medium text-teal-900' : 'text-slate-600'}`}>
          {selected ? selected.path : 'Choose a Vinted category'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#64748b" />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={close}>
        <View className="flex-1 items-center justify-center bg-black/40 p-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="absolute inset-0"
            onPress={close}
          />
          <View
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white"
            style={Platform.OS === 'web' ? { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)' } : undefined}>
            <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3">
              <Text className="text-base font-semibold text-slate-900">Choose category</Text>
              <Pressable onPress={close} accessibilityLabel="Close" className="rounded-full p-1.5 active:bg-slate-100">
                <Ionicons name="close" size={20} color="#475569" />
              </Pressable>
            </View>
            <View className="border-b border-slate-100 px-4 py-3">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search e.g. jeans, stroller, vinyl"
              />
            </View>
            {value ? (
              <Pressable
                onPress={() => {
                  onChange(null);
                  close();
                }}
                className="border-b border-slate-100 px-4 py-2.5 active:bg-slate-50">
                <Text className="text-sm text-slate-600">Clear category</Text>
              </Pressable>
            ) : null}
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: LIST_MAX_HEIGHT }}
              ListEmptyComponent={
                <Text className="px-4 py-6 text-center text-sm text-slate-500">No categories match.</Text>
              }
              renderItem={({ item }) => {
                const active = item.id === value;
                return (
                  <Pressable
                    onPress={() => choose(item)}
                    className={`border-b border-slate-50 px-4 py-2.5 ${active ? 'bg-teal-50' : 'active:bg-slate-50'}`}>
                    <Text
                      numberOfLines={2}
                      className={`text-sm leading-snug ${active ? 'font-semibold text-teal-900' : 'text-slate-800'}`}>
                      {item.path}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
