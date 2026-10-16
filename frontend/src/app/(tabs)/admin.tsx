import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';

import { Button, CenteredSpinner, EmptyState, ErrorBanner } from '@/components/ui';
import {
  downloadExport,
  fetchStats,
  importExport,
  pickExportFile,
  type DatabaseStats,
  type ImportResult,
} from '@/lib/admin';
import { setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirmAsync } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';

export default function AdminScreen() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [busy, setBusy] = useState<'exporting' | 'importing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return;
      fetchStats()
        .then(setStats)
        .catch((e) => setError(errorMessage(e)));
    }, [isAdmin]),
  );

  if (!isAdmin) {
    return <EmptyState title="Admins only" />;
  }

  async function handleExport() {
    setError(null);
    setBusy('exporting');
    try {
      await downloadExport();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    setError(null);
    const file = await pickExportFile();
    if (!file) return;
    const confirmed = await confirmAsync(
      'Replace everything?',
      `All items, photos and accounts on this server will be deleted and replaced with the contents of “${file.name}”. This cannot be undone. You will have to sign in again.`,
      'Replace',
    );
    if (!confirmed) return;

    setBusy('importing');
    try {
      setImported(await importExport(file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (imported) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-slate-50 p-6">
        <Text className="text-lg font-semibold text-slate-900">Import finished</Text>
        <Text className="max-w-md text-center text-sm text-slate-600">
          Imported {imported.users} accounts, {imported.items} items, {imported.bundles} bundles and{' '}
          {imported.photos} photos. Accounts and passwords now come from the file, so sign in again.
        </Text>
        <Button title="Sign in again" onPress={() => setToken(null)} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="items-center p-4">
      <View className="w-full max-w-xl gap-4">
        {error ? <ErrorBanner message={error} /> : null}

        {stats ? (
          <Text className="text-sm text-slate-600">
            This server has {stats.users} accounts, {stats.items} items, {stats.bundles} bundles and{' '}
            {stats.photos} photos.
          </Text>
        ) : !error ? (
          <CenteredSpinner />
        ) : null}

        <Card title="Export" description="Download everything (accounts, items, bundles, status history and photos) as one file. Use it as a backup, or to move your data to another server.">
          <Button
            title="Download export"
            icon="download-outline"
            onPress={handleExport}
            loading={busy === 'exporting'}
            disabled={busy !== null}
            className="self-start"
          />
        </Card>

        <Card title="Import" description="Replace everything on this server with an export file. The current accounts, items and photos are deleted first, and nothing is changed if the file turns out to be invalid.">
          {Platform.OS === 'web' ? (
            <Button
              title={busy === 'importing' ? 'Importing…' : 'Choose export file…'}
              icon="cloud-upload-outline"
              variant="danger"
              onPress={handleImport}
              loading={busy === 'importing'}
              disabled={busy !== null}
              className="self-start"
            />
          ) : (
            <Text className="text-sm text-slate-500">
              Importing needs a file picker, so open the web version of the app to do it.
            </Text>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <View className="gap-1">
        <Text className="text-base font-semibold text-slate-900">{title}</Text>
        <Text className="text-sm text-slate-600">{description}</Text>
      </View>
      {children}
    </View>
  );
}
