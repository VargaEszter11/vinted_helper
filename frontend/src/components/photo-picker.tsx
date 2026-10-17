import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Thumbnail } from '@/components/thumbnail';
import { BRAND_COLOR, Button } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { pickPhotos } from '@/lib/photos';
import type { ItemPhoto, LocalPhoto } from '@/lib/types';

export const TILE_SIZE = 84;

export function PhotoPicker({
  existing,
  existingUrls,
  added,
  onAdd,
  onRemoveExisting,
  onRemoveAdded,
  disabled = false,
}: {
  existing: ItemPhoto[];
  existingUrls: Record<string, string>;
  added: LocalPhoto[];
  onAdd: (photos: LocalPhoto[]) => void;
  onRemoveExisting: (photo: ItemPhoto) => void;
  onRemoveAdded: (photo: LocalPhoto) => void;
  disabled?: boolean;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(source: 'library' | 'camera') {
    setError(null);
    setProcessing(true);
    try {
      const photos = await pickPhotos(source);
      if (photos.length > 0) onAdd(photos);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setProcessing(false);
    }
  }

  const isEmpty = existing.length === 0 && added.length === 0 && !processing;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-slate-700">Photos</Text>
      {isEmpty ? (
        <Text className="text-sm text-slate-500">No photos yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {existing.map((photo) => (
            <PhotoTile
              key={photo.id}
              uri={existingUrls[photo.storage_path]}
              onRemove={() => onRemoveExisting(photo)}
              disabled={disabled}
            />
          ))}
          {added.map((photo) => (
            <PhotoTile
              key={photo.key}
              uri={photo.uri}
              onRemove={() => onRemoveAdded(photo)}
              disabled={disabled}
            />
          ))}
          {processing ? (
            <View
              style={{ width: TILE_SIZE, height: TILE_SIZE }}
              className="items-center justify-center rounded-lg bg-slate-100">
              <ActivityIndicator color={BRAND_COLOR} />
            </View>
          ) : null}
        </ScrollView>
      )}
      <View className="flex-row gap-2">
        <Button
          title={Platform.OS === 'web' ? 'Choose files' : 'Gallery'}
          icon="images-outline"
          variant="secondary"
          size="sm"
          onPress={() => add('library')}
          disabled={disabled || processing}
        />
        {Platform.OS !== 'web' ? (
          <Button
            title="Camera"
            icon="camera-outline"
            variant="secondary"
            size="sm"
            onPress={() => add('camera')}
            disabled={disabled || processing}
          />
        ) : null}
      </View>
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

export function PhotoTile({
  uri,
  onRemove,
  disabled,
}: {
  uri?: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <View>
      <Thumbnail uri={uri} size={TILE_SIZE} />
      <Pressable
        onPress={onRemove}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        hitSlop={6}
        className="absolute right-1 top-1 rounded-full bg-black/60 p-1">
        <Ionicons name="close" size={14} color="#ffffff" />
      </Pressable>
    </View>
  );
}
