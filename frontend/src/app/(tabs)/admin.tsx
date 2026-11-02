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
import { useT } from '@/lib/i18n';

export default function AdminScreen() {
  const t = useT();
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
    return <EmptyState title={t('admin.only')} />;
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
      t('admin.replaceTitle'),
      t('admin.replaceBody', { name: file.name }),
      t('admin.replace'),
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
      <View className="flex-1 items-center justify-center gap-3 bg-slate-50 p-6 dark:bg-slate-950">
        <Text className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.importFinished')}</Text>
        <Text className="max-w-md text-center text-sm text-slate-600 dark:text-slate-300">
          {t('admin.importSummary', {
            users: imported.users,
            items: imported.items,
            bundles: imported.bundles,
            photos: imported.photos,
          })}
        </Text>
        <Button title={t('admin.signInAgain')} onPress={() => setToken(null)} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-slate-950" contentContainerClassName="items-center p-4">
      <View className="w-full max-w-xl gap-4">
        {error ? <ErrorBanner message={error} /> : null}

        {stats ? (
          <Text className="text-sm text-slate-600 dark:text-slate-300">
            {t('admin.stats', {
              users: stats.users,
              items: stats.items,
              bundles: stats.bundles,
              photos: stats.photos,
            })}
          </Text>
        ) : !error ? (
          <CenteredSpinner />
        ) : null}

        <Card title={t('admin.exportTitle')} description={t('admin.exportBody')}>
          <Button
            title={t('admin.download')}
            icon="download-outline"
            onPress={handleExport}
            loading={busy === 'exporting'}
            disabled={busy !== null}
            className="self-start"
          />
        </Card>

        <Card title={t('admin.importTitle')} description={t('admin.importBody')}>
          {Platform.OS === 'web' ? (
            <Button
              title={busy === 'importing' ? t('admin.importing') : t('admin.chooseFile')}
              icon="cloud-upload-outline"
              variant="danger"
              onPress={handleImport}
              loading={busy === 'importing'}
              disabled={busy !== null}
              className="self-start"
            />
          ) : (
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.importWebOnly')}
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
    <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <View className="gap-1">
        <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-300">{description}</Text>
      </View>
      {children}
    </View>
  );
}
