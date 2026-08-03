import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

/**
 * There is no Readest Cloud backend in this build. useBooksSync's
 * pullLibrary/pushLibrary both just run the file-sync pass for whichever
 * third-party backends (WebDAV / Google Drive / S3 / OneDrive) are enabled,
 * and no-op when none is.
 */

const backends = vi.hoisted(() => ({
  active: [] as ('webdav' | 'gdrive' | 's3' | 'onedrive')[],
}));

const runFileLibrarySyncPass = vi.hoisted(() => vi.fn(async () => ({ booksSynced: 3 })));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation:
    () =>
    (text: string, params?: Record<string, string | number>): string => {
      if (!params) return text;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
        text,
      );
    },
}));

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {} }),
}));

vi.mock('@/services/sync/cloudSyncProvider', () => ({
  getActiveFileSyncBackends: () => backends.active,
}));

vi.mock('@/services/sync/file/runLibrarySync', () => ({
  runFileLibrarySyncPass: (...args: unknown[]) => runFileLibrarySyncPass(...args),
}));

const dispatchedToasts: Array<{ type: string; message: string }> = [];
vi.mock('@/utils/event', () => ({
  eventDispatcher: {
    dispatch: (_event: string, payload: { type: string; message: string }) => {
      dispatchedToasts.push(payload);
    },
  },
}));

import { useBooksSync } from '@/app/library/hooks/useBooksSync';

describe('useBooksSync', () => {
  beforeEach(() => {
    backends.active = [];
    runFileLibrarySyncPass.mockClear().mockResolvedValue({ booksSynced: 3 });
    dispatchedToasts.length = 0;
  });

  afterEach(() => cleanup());

  it('pullLibrary runs the file-sync pass when a backend is enabled', async () => {
    backends.active = ['webdav'];
    const { result } = renderHook(() => useBooksSync());
    await act(async () => {
      await result.current.pullLibrary();
    });
    expect(runFileLibrarySyncPass).toHaveBeenCalledTimes(1);
  });

  it('pullLibrary is a no-op when no backend is enabled', async () => {
    backends.active = [];
    const { result } = renderHook(() => useBooksSync());
    await act(async () => {
      await result.current.pullLibrary();
    });
    expect(runFileLibrarySyncPass).not.toHaveBeenCalled();
  });

  it('pullLibrary toasts the synced count exactly once when verbose', async () => {
    backends.active = ['webdav', 'gdrive'];
    const { result } = renderHook(() => useBooksSync());
    await act(async () => {
      await result.current.pullLibrary(true, true);
    });
    const syncToasts = dispatchedToasts.filter((t) => t.message.includes('synced'));
    expect(syncToasts).toHaveLength(1);
    expect(syncToasts[0]?.message).toContain('3');
  });

  it('pullLibrary does not toast when not verbose', async () => {
    backends.active = ['webdav'];
    const { result } = renderHook(() => useBooksSync());
    await act(async () => {
      await result.current.pullLibrary(true, false);
    });
    expect(dispatchedToasts).toHaveLength(0);
  });

  it('pushLibrary runs the same file-sync pass', async () => {
    backends.active = ['s3'];
    const { result } = renderHook(() => useBooksSync());
    await act(async () => {
      await result.current.pushLibrary();
    });
    expect(runFileLibrarySyncPass).toHaveBeenCalledTimes(1);
  });

  it('toasts an error when the pass fails', async () => {
    backends.active = ['webdav'];
    runFileLibrarySyncPass.mockResolvedValue(null);
    const { result } = renderHook(() => useBooksSync());
    await act(async () => {
      await result.current.pullLibrary(true, true);
    });
    expect(dispatchedToasts.at(-1)?.type).toBe('error');
  });
});
