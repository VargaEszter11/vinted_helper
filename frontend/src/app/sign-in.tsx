import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBanner, Field } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { signIn } from '@/lib/api';

export default function SignInScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (username.trim() === '' || password === '') {
      setError('Enter your username and password.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError('Choose a password of at least 8 characters.');
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
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-full max-w-sm gap-4">
            <View className="gap-1">
              <Text className="text-3xl font-bold text-teal-700">Vinted Helper</Text>
              <Text className="text-base text-slate-600">Sign in to your stock tracker.</Text>
            </View>
            {error ? <ErrorBanner message={error} /> : null}
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!loading}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onSubmitEditing={submit}
              editable={!loading}
            />
            <Button
              title={mode === 'login' ? 'Sign in' : 'Create account'}
              onPress={submit}
              loading={loading}
            />
            <Button
              title={mode === 'login' ? 'Create an account' : 'I already have an account'}
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
