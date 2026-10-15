import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** A popup: a bottom sheet on phones, a centered dialog on wider screens. */
export function ModalSheet({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View
          className="flex-1 items-center justify-end bg-black/40 sm:justify-center sm:p-6"
          style={{ paddingTop: insets.top + 24 }}>
          <View
            className="max-h-full w-full max-w-lg rounded-t-2xl bg-white sm:rounded-2xl"
            style={{ paddingBottom: insets.bottom }}>
            <View className="flex-row items-center justify-between border-b border-slate-200 py-2 pl-4 pr-2">
              <Text className="text-lg font-semibold text-slate-900">{title}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="rounded-full p-2 active:bg-slate-100">
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-4 p-4">
              {children}
            </ScrollView>
            {footer ? (
              <View className="flex-row items-center gap-2 border-t border-slate-200 p-4">
                {footer}
              </View>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
