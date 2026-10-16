import { Alert, Platform } from 'react-native';

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (confirmed: boolean) => void;
};

let showDialog: ((request: ConfirmRequest) => void) | null = null;

/** Called by <ConfirmHost />, which draws the in-app confirm dialog on web. */
export function registerConfirmHost(show: (request: ConfirmRequest) => void): () => void {
  showDialog = show;
  return () => {
    if (showDialog === show) showDialog = null;
  };
}

/**
 * Asks the user to confirm a destructive action. Uses the system alert on iOS and Android,
 * and the app's own dialog on web instead of the browser's confirm() box.
 */
export function confirmAsync(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const show = showDialog;
    if (!show) return Promise.resolve(false);
    return new Promise((resolve) => show({ title, message, confirmLabel, resolve }));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
