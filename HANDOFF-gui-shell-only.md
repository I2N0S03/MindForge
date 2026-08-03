# WIP handoff — GUI-shell-only extraction

**Branch:** `claude/gui-shell-only` · **PR:** #1 (draft) · **Status: INCOMPLETE, does not typecheck. Do not merge.**

## Goal

Strip all backend/cloud code from this Readest fork, keep the entire GUI, Tauri shell, and reader engine
working with no dead-end clicks. Removing: Supabase auth, Stripe/Apple/Google IAP, Readest Cloud
(R2) storage+sync, DeepL/Yandex translation proxies. Keeping fully working: BYO sync
(WebDAV/GDrive/OneDrive/S3), KOReader sync, Readwise, Hardcover, OPDS, reader/annotation/TTS/themes.

Guiding rule: `useAuth()` user/token is permanently null (no login exists anymore). Every UI branch on
user/token/premium either (a) gets the gate removed if it guards a kept feature, or (b) has its entry
point deleted if it guards a removed feature. Never leave a button that routes nowhere.

## Done and pushed (commit 1, CI green expected)

- Deleted `.github/workflows/{vercel-merge,docker-image,upload-to-r2}.yml` and `docker/`.
- `release.yml`/`nightly.yml`: kept Tauri build/sign matrix, dropped Supabase secret injection.

## Done but UNCOMMITTED/UNVERIFIED (~204 files in working tree)

Largely complete deletions: `app/api/{stripe,apple,google,share,yandex-translate}/`, `app/auth/`,
`app/user/`, `app/s/`, `libs/payment/`, share dialogs, `TransferQueuePanel`, `useNotesSync`,
`useProgressSync`, replica sync files, storage/R2 utils.
Edited: auth-gate removed from `api/{ai/chat,ai/embed,metadata/search,tts/edge}/route.ts` (these are GUI
features, not accounts — they now run unauthenticated, which is intended for a fork with no login).

## Exact resume point

The agent was killed **mid-edit in `apps/readest-app/src/app/library/components/SettingsMenu.tsx`** —
imports and handlers were deleted but the JSX still references them. This is the top error source.

Needed there: drop the `{user ? ... : <Sign In>}` block entirely (avatar / "Logged in as" / Quota /
Account / Cloud File Transfers / Data Sync / Upgrade rows), and keep the sync-status MenuItem always
visible, ungated — `Icon={backends.length > 0 && !providerLastError ? MdSync : MdSyncProblem}`, spin on
`providerSyncing` only. Then drop now-unused imports (`useAuth`, `useQuotaStats`, `UserAvatar`, `Quota`,
`navigateToLogin`, `navigateToProfile`, `PiUserCircle*`, `MdCloudSync`, `useTransferQueue`) and the
`readestEnabled`/`providers`/`nativeLastSyncedAt` computation (Readest Cloud is gone; providers =
third-party backends only).

## Remaining after that

1. `pnpm --filter @readest/readest-app lint` and fix dangling imports until green.
2. Delete test files covering deleted features (payment, auth, R2/storage/object, share, replica sync,
   transferStore, DeepL/Yandex). Update — don't weaken — tests for kept features
   (e.g. `cloudSync.test.ts` asserting `CLOUD_SYNC_REQUIRES_PREMIUM === true`, now false).
3. Not yet started: `IntegrationsPanel.tsx` premium-paywall removal (badges, `isPremium` in
   `canToggleCloudProvider`, Readest Cloud row + `readest-cloud` subpage, Discord login prompt);
   `utils/access.ts` cleanup; `utils/nav.ts` drop `navigateToLogin`/`navigateToProfile`;
   `.env` fallback keys (`NEXT_PUBLIC_DEFAULT_SUPABASE_*`, `..._STRIPE_*` — keep PostHog).
4. Out of scope so far: `src-tauri/` Rust (optional macOS Apple/Safari auth command removal).

## Known pre-existing failure (not ours)

`src/utils/simplecc.ts` → `Cannot find module '@simplecc/simplecc_wasm'` — uninitialized git submodule
in this environment, unrelated to this change.
