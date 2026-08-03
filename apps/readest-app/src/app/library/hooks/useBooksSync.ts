import { useCallback, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';
import { useSettingsStore } from '@/store/settingsStore';
import { getActiveFileSyncBackends } from '@/services/sync/cloudSyncProvider';
import { runFileLibrarySyncPass } from '@/services/sync/file/runLibrarySync';

/**
 * Library-wide sync for the enabled third-party cloud backends (WebDAV /
 * Google Drive / S3 / OneDrive). Every backend's pass is bidirectional
 * (push + pull in one go — see runFileLibrarySyncPass), so `pullLibrary`
 * and `pushLibrary` both just run it; the distinction only mattered for
 * Readest Cloud's separate push/pull native-sync channel, which no longer
 * exists in this build.
 */
export const useBooksSync = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const isPullingRef = useRef(false);

  const runFileSync = useCallback(
    async (verbose = false) => {
      const backends = getActiveFileSyncBackends(useSettingsStore.getState().settings);
      if (backends.length === 0) return;
      if (isPullingRef.current) return;

      isPullingRef.current = true;
      try {
        const result = await runFileLibrarySyncPass(envConfig, _);
        if (verbose) {
          eventDispatcher.dispatch('toast', {
            type: result !== null ? 'info' : 'error',
            message:
              result !== null
                ? _('{{count}} book(s) synced', { count: result.booksSynced })
                : _('Sync failed'),
          });
        }
      } finally {
        isPullingRef.current = false;
      }
    },
    [_, envConfig],
  );

  // `fullRefresh` is accepted for call-site compatibility (pull-to-refresh
  // vs. long-press hard refresh) but has no effect: the file-sync pass
  // always reconciles the full library regardless of who triggered it.
  const pullLibrary = useCallback(
    async (_fullRefresh = false, verbose = false) => {
      await runFileSync(verbose);
    },
    [runFileSync],
  );

  const pushLibrary = useCallback(async () => {
    await runFileSync(false);
  }, [runFileSync]);

  return { pullLibrary, pushLibrary };
};
