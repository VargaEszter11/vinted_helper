import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { registerConfirmHost, type ConfirmRequest } from '@/lib/confirm';

/**
 * Draws the confirm dialog requested through confirmAsync() on web. Mount it once at the root.
 * It is rendered only while open, so it stacks above any popup that asked for it.
 */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(
    () =>
      registerConfirmHost((next) =>
        setRequest((current) => {
          // A second request while one is open cancels the first.
          current?.resolve(false);
          return next;
        }),
      ),
    [],
  );

  // Escape cancels. Caught on window before the popups underneath see it, so they stay open.
  useEffect(() => {
    if (!request || Platform.OS !== 'web') return;
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      request.resolve(false);
      setRequest(null);
    };
    window.addEventListener('keyup', onKeyUp, true);
    return () => window.removeEventListener('keyup', onKeyUp, true);
  }, [request]);

  if (!request) return null;

  const answer = (confirmed: boolean) => {
    request.resolve(confirmed);
    setRequest(null);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => answer(false)}>
      <View className="flex-1 items-center justify-center p-6">
        <Pressable
          onPress={() => answer(false)}
          accessibilityLabel="Cancel"
          className="absolute inset-0 bg-black/40"
        />
        <View
          accessibilityRole="alert"
          className="w-full max-w-sm gap-2 rounded-2xl bg-white p-5 shadow-lg">
          <Text className="text-lg font-semibold text-slate-900">{request.title}</Text>
          <Text className="text-sm text-slate-600">{request.message}</Text>
          <View className="mt-3 flex-row justify-end gap-2">
            <Button title="Cancel" variant="secondary" onPress={() => answer(false)} />
            <Button title={request.confirmLabel} variant="danger" onPress={() => answer(true)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
