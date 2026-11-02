import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBanner, Field } from '@/components/ui';
import { signIn } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useT } from '@/lib/i18n';

export default function SignInScreen() {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (username.trim() === '' || password === '') {
      setError(t('auth.needCredentials'));
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await signIn(mode, username, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-full max-w-sm gap-4">
            <View className="gap-1">
              <Text className="text-3xl font-bold text-teal-700 dark:text-teal-300">Vinted Helper</Text>
              <Text className="text-base text-slate-600 dark:text-slate-400">{t('auth.tagline')}</Text>
            </View>
            {error ? <ErrorBanner message={error} /> : null}
            <Field
              label={t('auth.username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!loading}
            />
            <Field
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onSubmitEditing={submit}
              editable={!loading}
            />
            <Button
              title={mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
              onPress={submit}
              loading={loading}
            />
            <Button
              title={mode === 'login' ? t('auth.createAnAccount') : t('auth.haveAccount')}
              variant="secondary"
              onPress={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              disabled={loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
