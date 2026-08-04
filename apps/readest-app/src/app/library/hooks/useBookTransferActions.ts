import { useCallback } from 'react';
import type { Book } from '@/types/book';
import type { EnvConfigType } from '@/services/environment';
import type { AppService } from '@/types/system';
import type { ProgressPayload } from '@/utils/transfer';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { eventDispatcher } from '@/utils/event';
import { getActiveFileSyncBackends } from '@/services/sync/cloudSyncProvider';
import { runFileBookDownload, runFileBookUpload } from '@/services/sync/file/runLibrarySync';

interface BookDownloadOptions {
  redownload?: boolean;
  queued?: boolean;
}

/**
 * Explicit per-book Upload/Download routing — mirrored to every enabled
 * third-party cloud sync backend (WebDAV / Google Drive / S3 / OneDrive).
 * There is no Readest Cloud backend in this build, so a book with no
 * backend enabled has nowhere to upload to or download from.
 */
export const useBookTransferActions = (
  envConfig: EnvConfigType,
  appService: AppService | null,
  updateBook: (envConfig: EnvConfigType, book: Book) => Promise<void>,
  // File-sync backends report success/failure only, no per-chunk progress —
  // kept for call-site compatibility with the progress-bar UI.
  _updateBookTransferProgress: (bookHash: string, progress: ProgressPayload) => void,
) => {
  const _ = useTranslation();

  const handleBookUpload = useCallback(
    async (book: Book, _syncBooks = true) => {
      const settingsNow = useSettingsStore.getState().settings;
      const backends = getActiveFileSyncBackends(settingsNow);

      // An explicit Upload must reach EVERY destination the user selected
      // (#5062), not just the first one.
      const pushed = backends.length > 0 ? await runFileBookUpload(envConfig, book) : false;

      if (pushed) {
        eventDispatcher.dispatch('toast', {
          type: 'info',
          timeout: 2000,
          message: _('Book uploaded: {{title}}', { title: book.title }),
        });
        return true;
      }
      // An explicit Upload action must never silently no-op.
      eventDispatcher.dispatch('toast', {
        type: backends.length > 0 ? 'error' : 'info',
        timeout: 5000,
        message:
          backends.length > 0
            ? _('Failed to upload book: {{title}}', { title: book.title })
            : _('Turn on a provider in Cloud Sync settings to upload this book'),
      });
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleBookDownload = useCallback(
    async (book: Book, _downloadOptions: BookDownloadOptions = {}) => {
      const settingsNow = useSettingsStore.getState().settings;
      const backends = getActiveFileSyncBackends(settingsNow);

      if (backends.length > 0) {
        const ok = await runFileBookDownload(envConfig, book);
        if (ok) await updateBook(envConfig, book);
        eventDispatcher.dispatch('toast', {
          type: ok ? 'info' : 'error',
          timeout: 2000,
          message: ok
            ? _('Book downloaded: {{title}}', { title: book.title })
            : _('Failed to download book: {{title}}', { title: book.title }),
        });
        return ok;
      }

      eventDispatcher.dispatch('toast', {
        type: 'info',
        timeout: 5000,
        message: _('Turn on a provider in Cloud Sync settings to download this book'),
      });
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appService],
  );

  return { handleBookUpload, handleBookDownload };
};
