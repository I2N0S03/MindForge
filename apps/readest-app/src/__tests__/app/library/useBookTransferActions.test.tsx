import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

import type { Book } from '@/types/book';
import type { EnvConfigType } from '@/services/environment';
import type { AppService } from '@/types/system';
import type { ProgressPayload } from '@/utils/transfer';

/**
 * There is no Readest Cloud backend in this build. A per-book Upload/Download
 * routes to every enabled third-party file-sync backend (WebDAV / Google
 * Drive / S3 / OneDrive) via runFileBookUpload/runFileBookDownload, and is a
 * no-op (with an explanatory toast) when none is enabled.
 */

const backends = vi.hoisted(() => ({
  active: [] as ('webdav' | 'gdrive' | 's3' | 'onedrive')[],
}));

const runFileBookUpload = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => true));
const runFileBookDownload = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => true));

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

vi.mock('@/services/sync/cloudSyncProvider', () => ({
  getActiveFileSyncBackends: () => backends.active,
}));

vi.mock('@/services/sync/file/runLibrarySync', () => ({
  runFileBookUpload: (...args: unknown[]) => runFileBookUpload(...args),
  runFileBookDownload: (...args: unknown[]) => runFileBookDownload(...args),
}));

const dispatchedToasts: Array<{ type: string; message: string }> = [];
vi.mock('@/utils/event', () => ({
  eventDispatcher: {
    dispatch: (_event: string, payload: { type: string; message: string }) => {
      dispatchedToasts.push(payload);
    },
  },
}));

import { useBookTransferActions } from '@/app/library/hooks/useBookTransferActions';

const makeBook = (): Book =>
  ({
    hash: 'h1',
    format: 'EPUB',
    title: 'Test Book',
    sourceTitle: 'Test Book',
    author: 'A',
    createdAt: 1,
    updatedAt: 1,
  }) as Book;

describe('useBookTransferActions', () => {
  const envConfig = {} as EnvConfigType;
  const appService = {} as AppService;
  const updateBook = vi.fn(async () => {});
  const updateProgress = vi.fn((_h: string, _p: ProgressPayload) => {});

  beforeEach(() => {
    backends.active = [];
    runFileBookUpload.mockClear().mockResolvedValue(true);
    runFileBookDownload.mockClear().mockResolvedValue(true);
    updateBook.mockClear();
    dispatchedToasts.length = 0;
  });

  it('upload: reaches the enabled file backends and toasts success', async () => {
    backends.active = ['webdav', 'gdrive'];
    const { result } = renderHook(() =>
      useBookTransferActions(envConfig, appService, updateBook, updateProgress),
    );
    let ok = false;
    await act(async () => {
      ok = await result.current.handleBookUpload(makeBook());
    });
    expect(ok).toBe(true);
    expect(runFileBookUpload).toHaveBeenCalledTimes(1);
    expect(dispatchedToasts.at(-1)?.type).toBe('info');
  });

  it('upload: no-ops with an explanatory toast when no backend is enabled', async () => {
    backends.active = [];
    const { result } = renderHook(() =>
      useBookTransferActions(envConfig, appService, updateBook, updateProgress),
    );
    let ok = true;
    await act(async () => {
      ok = await result.current.handleBookUpload(makeBook());
    });
    expect(ok).toBe(false);
    expect(runFileBookUpload).not.toHaveBeenCalled();
    expect(dispatchedToasts.at(-1)?.message).toContain('Turn on a provider');
  });

  it('upload: toasts an error when every backend fails', async () => {
    backends.active = ['webdav'];
    runFileBookUpload.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useBookTransferActions(envConfig, appService, updateBook, updateProgress),
    );
    let ok = true;
    await act(async () => {
      ok = await result.current.handleBookUpload(makeBook());
    });
    expect(ok).toBe(false);
    expect(dispatchedToasts.at(-1)?.type).toBe('error');
  });

  it('download: pulls from an enabled backend and updates the book', async () => {
    backends.active = ['s3'];
    const { result } = renderHook(() =>
      useBookTransferActions(envConfig, appService, updateBook, updateProgress),
    );
    let ok = false;
    await act(async () => {
      ok = await result.current.handleBookDownload(makeBook());
    });
    expect(ok).toBe(true);
    expect(runFileBookDownload).toHaveBeenCalledTimes(1);
    expect(updateBook).toHaveBeenCalledTimes(1);
  });

  it('download: no-ops with an explanatory toast when no backend is enabled', async () => {
    backends.active = [];
    const { result } = renderHook(() =>
      useBookTransferActions(envConfig, appService, updateBook, updateProgress),
    );
    let ok = true;
    await act(async () => {
      ok = await result.current.handleBookDownload(makeBook());
    });
    expect(ok).toBe(false);
    expect(runFileBookDownload).not.toHaveBeenCalled();
    expect(dispatchedToasts.at(-1)?.message).toContain('Turn on a provider');
  });
});
