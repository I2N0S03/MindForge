import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SystemSettings } from '@/types/settings';

vi.mock('@/utils/access', () => ({
  isCloudSyncAllowed: vi.fn(),
}));

import { isCloudSyncAllowed } from '@/utils/access';
import {
  applySyncBooksAutoEnable,
  cloudProviderDisplayName,
  cloudProvidersDisplayName,
  getActiveFileSyncBackends,
  getCloudSyncProviders,
  getEnabledFileSyncBackends,
  hasAnyThirdPartyEnabled,
  resolveCloudSyncGate,
  settingsKeyForBackend,
} from '@/services/sync/cloudSyncProvider';

beforeEach(() => {
  vi.mocked(isCloudSyncAllowed).mockReturnValue(true);
});

describe('settingsKeyForBackend', () => {
  test('maps each backend kind to its settings slice', () => {
    expect(settingsKeyForBackend('webdav')).toBe('webdav');
    expect(settingsKeyForBackend('gdrive')).toBe('googleDrive');
    expect(settingsKeyForBackend('s3')).toBe('s3');
    expect(settingsKeyForBackend('onedrive')).toBe('onedrive');
  });
});

describe('cloudProviderDisplayName', () => {
  test('names every provider kind', () => {
    expect(cloudProviderDisplayName('webdav')).toBe('WebDAV');
    expect(cloudProviderDisplayName('gdrive')).toBe('Google Drive');
    expect(cloudProviderDisplayName('s3')).toBe('S3');
    expect(cloudProviderDisplayName('onedrive')).toBe('OneDrive');
  });
});

describe('cloudProvidersDisplayName', () => {
  test('joins provider names for the "synced via" copy', () => {
    expect(cloudProvidersDisplayName(['webdav', 'gdrive'])).toBe('WebDAV, Google Drive');
    expect(cloudProvidersDisplayName([])).toBe('');
  });
});

describe('getEnabledFileSyncBackends', () => {
  test('lists only switched-on backends in a stable order', () => {
    const settings = {
      webdav: { enabled: true },
      googleDrive: { enabled: false },
      s3: { enabled: true },
    } as unknown as SystemSettings;
    expect(getEnabledFileSyncBackends(settings)).toEqual(['webdav', 's3']);
  });

  test('includes onedrive when enabled', () => {
    const settings = { onedrive: { enabled: true } } as unknown as SystemSettings;
    expect(getEnabledFileSyncBackends(settings)).toEqual(['onedrive']);
  });

  test('returns an empty list for null/undefined settings', () => {
    expect(getEnabledFileSyncBackends(null)).toEqual([]);
    expect(getEnabledFileSyncBackends(undefined)).toEqual([]);
  });
});

describe('hasAnyThirdPartyEnabled', () => {
  test('true when at least one backend is on', () => {
    expect(
      hasAnyThirdPartyEnabled({ webdav: { enabled: true } } as unknown as SystemSettings),
    ).toBe(true);
  });

  test('false when nothing is on', () => {
    expect(hasAnyThirdPartyEnabled({} as unknown as SystemSettings)).toBe(false);
  });
});

describe('getCloudSyncProviders', () => {
  test('is the same as getEnabledFileSyncBackends - no native Readest Cloud provider', () => {
    const settings = {
      webdav: { enabled: true },
      googleDrive: { enabled: true },
    } as unknown as SystemSettings;
    expect(getCloudSyncProviders(settings)).toEqual(['webdav', 'gdrive']);
  });

  test('returns an empty list when everything is off', () => {
    expect(getCloudSyncProviders({} as unknown as SystemSettings)).toEqual([]);
  });
});

describe('resolveCloudSyncGate', () => {
  test('reports the enabled backends', () => {
    const settings = { webdav: { enabled: true } } as unknown as SystemSettings;
    const gate = resolveCloudSyncGate(settings, 'free');
    expect(gate.backends).toEqual(['webdav']);
  });

  test('third-party provider is active when allowed', () => {
    vi.mocked(isCloudSyncAllowed).mockReturnValue(true);
    const settings = { webdav: { enabled: true } } as unknown as SystemSettings;
    expect(resolveCloudSyncGate(settings, 'free').paused).toBe(false);
  });

  test('third-party provider is paused when disallowed', () => {
    vi.mocked(isCloudSyncAllowed).mockReturnValue(false);
    const settings = { webdav: { enabled: true } } as unknown as SystemSettings;
    expect(resolveCloudSyncGate(settings, 'free').paused).toBe(true);
  });

  test('never paused when no backend is enabled, regardless of plan', () => {
    vi.mocked(isCloudSyncAllowed).mockReturnValue(false);
    expect(resolveCloudSyncGate({} as unknown as SystemSettings, 'free').paused).toBe(false);
  });

  test('defaults to the free plan when no plan argument is given', () => {
    const settings = { webdav: { enabled: true } } as unknown as SystemSettings;
    resolveCloudSyncGate(settings);
    expect(isCloudSyncAllowed).toHaveBeenCalledWith('free');
  });
});

describe('getActiveFileSyncBackends', () => {
  test('returns the backends when not paused', () => {
    vi.mocked(isCloudSyncAllowed).mockReturnValue(true);
    const settings = { webdav: { enabled: true } } as unknown as SystemSettings;
    expect(getActiveFileSyncBackends(settings, 'free')).toEqual(['webdav']);
  });

  test('returns an empty list when paused', () => {
    vi.mocked(isCloudSyncAllowed).mockReturnValue(false);
    const settings = { webdav: { enabled: true } } as unknown as SystemSettings;
    expect(getActiveFileSyncBackends(settings, 'free')).toEqual([]);
  });
});

describe('applySyncBooksAutoEnable (upgrade migration for already-enabled providers)', () => {
  test('flips syncBooks on for an enabled webdav provider, mutating the given settings', () => {
    const settings = { webdav: { enabled: true, syncBooks: false } } as unknown as SystemSettings;
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.webdav?.syncBooks).toBe(true);
  });

  test('flips syncBooks on for an enabled gdrive provider', () => {
    const settings = {
      googleDrive: { enabled: true, syncBooks: false },
    } as unknown as SystemSettings;
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.googleDrive?.syncBooks).toBe(true);
  });

  test('no-op when nothing is enabled', () => {
    const settings = {} as unknown as SystemSettings;
    expect(applySyncBooksAutoEnable(settings)).toBe(false);
  });

  test('no-op when syncBooks is already on', () => {
    const settings = { webdav: { enabled: true, syncBooks: true } } as unknown as SystemSettings;
    expect(applySyncBooksAutoEnable(settings)).toBe(false);
  });

  test('flips syncBooks on for every enabled provider when multiple are enabled', () => {
    const settings = {
      webdav: { enabled: true, syncBooks: false },
      s3: { enabled: true, syncBooks: false },
      onedrive: { enabled: true, syncBooks: false },
    } as unknown as SystemSettings;
    expect(applySyncBooksAutoEnable(settings)).toBe(true);
    expect(settings.webdav?.syncBooks).toBe(true);
    expect(settings.s3?.syncBooks).toBe(true);
    expect(settings.onedrive?.syncBooks).toBe(true);
  });
});
