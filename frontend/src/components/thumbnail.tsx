import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { View } from 'react-native';

export function Thumbnail({ uri, size }: { uri?: string; size: number }) {
  if (!uri) {
    return (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-lg bg-slate-100">
        <Ionicons name="image-outline" size={size * 0.45} color="#94a3b8" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 8, backgroundColor: '#f1f5f9' }}
      contentFit="cover"
      transition={150}
    />
  );
}
