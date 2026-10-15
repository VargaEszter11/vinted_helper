import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { errorMessage } from '@/lib/format';
import { fetchItems } from '@/lib/items';
import { getSignedUrls } from '@/lib/photos';
import type { Item, ItemStatus } from '@/lib/types';

/** Loads items with the given statuses (and their thumbnail URLs) whenever the screen is focused. */
export function useItemList(statuses: readonly ItemStatus[], orderBy: 'created_at' | 'sold_date') {
  const [items, setItems] = useState<Item[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusKey = statuses.join(',');

  const reload = useCallback(async () => {
    try {
      const rows = await fetchItems(statusKey.split(',') as ItemStatus[], orderBy);
      const coverPaths = rows.flatMap((item) =>
        item.item_photos[0] ? [item.item_photos[0].storage_path] : [],
      );
      // A missing thumbnail is not worth failing the whole list for.
      const urls = coverPaths.length > 0 ? await getSignedUrls(coverPaths).catch(() => ({})) : {};
      setItems(rows);
      setThumbnails(urls);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [statusKey, orderBy]);

  useFocusEffect(
    useCallback(() => {
      reload().finally(() => setLoading(false));
    }, [reload]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const retry = useCallback(async () => {
    setLoading(true);
    await reload();
    setLoading(false);
  }, [reload]);

  const thumbnailFor = (item: Item) => {
    const cover = item.item_photos[0];
    return cover ? thumbnails[cover.storage_path] : undefined;
  };

  return { items, thumbnailFor, loading, refreshing, error, reload, refresh, retry };
}
