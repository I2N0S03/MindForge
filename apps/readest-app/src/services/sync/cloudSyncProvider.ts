import type { SystemSettings } from '@/types/settings';
import type { UserPlan } from '@/types/quota';
import { isCloudSyncAllowed } from '@/utils/access';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';

/**
 * The cloud sync provider kind for library data (book files, book rows,
 * progress, notes). There is no Readest Cloud backend in this fork, so this
 * is just the third-party file-sync backends.
 */
export type CloudSyncProviderKind = FileSyncBackendKind;

/** Settings slice key for a third-party backend kind. */
export const settingsKeyForBackend = (
  kind: FileSyncBackendKind,
): 'webdav' | 'googleDrive' | 's3' | 'onedrive' => (kind === 'gdrive' ? 'googleDrive' : kind);

/** Human-readable provider name (product names — deliberately untranslated). */
export const cloudProviderDisplayName = (kind: CloudSyncProviderKind): string =>
  kind === 'gdrive'
    ? 'Google Drive'
    : kind === 'webdav'
      ? 'WebDAV'
      : kind === 's3'
        ? 'S3'
        : 'OneDrive';

/**
 * The third-party backends the user has switched on, in a STABLE order that
 * every loop, list, and sync pass in the app relies on.
 */
export const getEnabledFileSyncBackends = (
  settings: SystemSettings | null | undefined,
): FileSyncBackendKind[] => {
  const enabled: FileSyncBackendKind[] = [];
  if (settings?.webdav?.enabled) enabled.push('webdav');
  if (settings?.googleDrive?.enabled) enabled.push('gdrive');
  if (settings?.s3?.enabled) enabled.push('s3');
  if (settings?.onedrive?.enabled) enabled.push('onedrive');
  return enabled;
};

/** Any third-party file-sync backend switched on. */
export const hasAnyThirdPartyEnabled = (settings: SystemSettings | null | undefined): boolean =>
  getEnabledFileSyncBackends(settings).length > 0;

/** Every provider syncing the library on this device. */
export const getCloudSyncProviders = (
  settings: SystemSettings | null | undefined,
): CloudSyncProviderKind[] => getEnabledFileSyncBackends(settings);

/** Comma-joined product names, for the "Synced via {{provider}}" copy. */
export const cloudProvidersDisplayName = (kinds: CloudSyncProviderKind[]): string =>
  kinds.map(cloudProviderDisplayName).join(', ');

export interface CloudSyncGate {
  /** Third-party backends the user switched on, in the fixed webdav/gdrive/s3/onedrive order. */
  backends: FileSyncBackendKind[];
  /**
   * True when third-party backends are switched on but the plan does not allow
   * cloud sync. Always false now that `CLOUD_SYNC_REQUIRES_PREMIUM` is off —
   * kept so callers don't need a separate code path.
   */
  paused: boolean;
}

export const resolveCloudSyncGate = (
  settings: SystemSettings | null | undefined,
  plan: UserPlan = 'free',
): CloudSyncGate => {
  const backends = getEnabledFileSyncBackends(settings);
  return {
    backends,
    paused: backends.length > 0 && !isCloudSyncAllowed(plan),
  };
};

/** The backends that may actually run right now (empty when paused). */
export const getActiveFileSyncBackends = (
  settings: SystemSettings | null | undefined,
  plan?: UserPlan,
): FileSyncBackendKind[] => {
  const gate = resolveCloudSyncGate(settings, plan);
  return gate.paused ? [] : gate.backends;
};

/**
 * One-time upgrade migration helper (appService migrate20260706): users
 * who already had WebDAV/Drive enabled before provider selection shipped
 * become "third-party selected" on upgrade, which gates native Readest
 * Cloud uploads off — with syncBooks at its old `false` default their
 * books would back up nowhere. Flip syncBooks on for every enabled backend.
 * Mutates `settings` in place (the migration runner saves the same
 * snapshot afterwards) and returns whether anything changed.
 */
export const applySyncBooksAutoEnable = (settings: SystemSettings): boolean => {
  let changed = false;
  for (const kind of getEnabledFileSyncBackends(settings)) {
    // A switch (rather than a generically-keyed write) keeps each branch's
    // settings slice type intact; `settings[key] = { ...slice, syncBooks }`
    // does not typecheck when `key` is a union of literal keys.
    switch (kind) {
      case 'webdav':
        if (settings.webdav && !settings.webdav.syncBooks) {
          settings.webdav = { ...settings.webdav, syncBooks: true };
          changed = true;
        }
        break;
      case 'gdrive':
        if (settings.googleDrive && !settings.googleDrive.syncBooks) {
          settings.googleDrive = { ...settings.googleDrive, syncBooks: true };
          changed = true;
        }
        break;
      case 's3':
        if (settings.s3 && !settings.s3.syncBooks) {
          settings.s3 = { ...settings.s3, syncBooks: true };
          changed = true;
        }
        break;
      case 'onedrive':
        if (settings.onedrive && !settings.onedrive.syncBooks) {
          settings.onedrive = { ...settings.onedrive, syncBooks: true };
          changed = true;
        }
        break;
    }
  }
  return changed;
};
