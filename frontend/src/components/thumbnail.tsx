import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/lib/theme';

export function Thumbnail({ uri, size }: { uri?: string; size: number }) {
  const { theme } = useTheme();
  if (!uri) {
    return (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
        <Ionicons name="image-outline" size={size * 0.45} color="#94a3b8" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 8, backgroundColor: theme === 'dark' ? '#1e293b' : '#f1f5f9' }}
      contentFit="cover"
      transition={150}
    />
  );
}
