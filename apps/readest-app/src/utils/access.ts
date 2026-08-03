import { UserPlan } from '@/types/quota';

/**
 * Plans that include third-party cloud sync (WebDAV / Google Drive): any paid
 * plan — Plus, Pro, and Lifetime (`purchase`). Free users see an upgrade prompt
 * in Settings and the reader's auto-sync stays off, so syncing to a personal
 * cloud is a premium feature.
 */
export const CLOUD_SYNC_PLANS: readonly UserPlan[] = ['plus', 'pro', 'purchase'];

export const isCloudSyncInPlan = (plan: UserPlan): boolean =>
  (CLOUD_SYNC_PLANS as readonly UserPlan[]).includes(plan);

/**
 * Master switch for the third-party cloud-sync premium paywall. ON: cloud
 * sync (WebDAV / Google Drive / S3) requires a {@link CLOUD_SYNC_PLANS} plan —
 * free users see the provider rows with a Premium badge and an upgrade route
 * instead of the config sub-pages, and a downgraded account's still-selected
 * provider is paused (never a silent fallback to Readest Cloud uploads, #4959).
 * Every gate goes through {@link isCloudSyncAllowed}, so this flag is the
 * whole toggle.
 */
export const CLOUD_SYNC_REQUIRES_PREMIUM = false;

/**
 * Whether third-party cloud sync is available for a plan. Falls back to the
 * {@link isCloudSyncInPlan} paywall while {@link CLOUD_SYNC_REQUIRES_PREMIUM}
 * is on; flipping the switch off ungates every plan.
 */
export const isCloudSyncAllowed = (plan: UserPlan): boolean =>
  !CLOUD_SYNC_REQUIRES_PREMIUM || isCloudSyncInPlan(plan);

/**
 * Plans that include the offline TTS audio cache — pre-downloading a book's
 * Read Aloud audio per chapter so it plays without a network: any paid plan
 * (Plus, Pro, and Lifetime `purchase`). Free users see the download row with a
 * Premium badge and an upgrade route instead of the per-chapter controls.
 */
export const TTS_CACHE_PLANS: readonly UserPlan[] = ['plus', 'pro', 'purchase'];

export const isTTSCacheInPlan = (plan: UserPlan): boolean =>
  (TTS_CACHE_PLANS as readonly UserPlan[]).includes(plan);

/**
 * Master switch for the offline-audio premium paywall, mirroring
 * {@link CLOUD_SYNC_REQUIRES_PREMIUM}. ON: pre-downloading TTS audio requires a
 * {@link TTS_CACHE_PLANS} plan. Flipping it off ungates every plan. The
 * automatic playback cache (audio kept as the user listens) is unaffected —
 * only the explicit download UI is gated.
 */
export const TTS_CACHE_REQUIRES_PREMIUM = false;

export const isTTSCacheAllowed = (plan: UserPlan): boolean =>
  !TTS_CACHE_REQUIRES_PREMIUM || isTTSCacheInPlan(plan);
