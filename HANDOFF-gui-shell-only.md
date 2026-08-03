# GUI-shell-only extraction — COMPLETE

**Branch:** `claude/gui-shell-only` · **PR:** #1 (draft)

**Status: `pnpm lint` (tsgo + biome) and `pnpm test` are both clean, modulo one
pre-existing, unrelated environment issue described below.** Ready for review;
the draft label can come off once someone's eyeballed the diff.

## What changed

Removed all backend/cloud code from this Readest fork — Supabase auth, Stripe/Apple/Google IAP,
Readest Cloud (R2) storage+sync, DeepL/Yandex translation proxies, and their CI/hosting
infrastructure (docker/, vercel-merge/docker-image/upload-to-r2 workflows) — while keeping the
entire GUI, Tauri shell, and reader engine working with no dead-end clicks. Kept fully working:
BYO cloud sync (WebDAV/Google Drive/OneDrive/S3, now paywall-free since there's no payment system
to gate on), KOReader sync, Readwise, Hardcover, OPDS catalogs, reader/annotation/TTS/themes, the
four API routes that were incidentally auth-gated but aren't backend features (AI assistant,
metadata search, Edge TTS — now run unauthenticated).

Guiding rule throughout: `useAuth()`'s `user`/`token` are permanently null (no login exists
anymore, kept as a no-op `AuthContext` stub since some translator/TTS hooks still destructure it
and already treat signed-out as normal). Every UI branch on user/token/premium either had its gate
removed (if it guarded a kept feature) or its entry point deleted (if it guarded a removed
feature) — never left as a dead button routing to a page that no longer exists.

## The one remaining failure (not caused by this work)

`src/utils/simplecc.ts` imports `@simplecc/simplecc_wasm`, which resolves to
`packages/simplecc-wasm/` — a git submodule that IS checked out on disk here,
but is a Rust→WASM crate (`Cargo.toml` + `Makefile`) that needs an actual
build step (`pnpm setup-simplecc` builds and copies `dist/web/*`) beyond a
plain `pnpm install`, and this sandbox has no Rust/wasm-pack toolchain to run
it. Per this repo's own `CLAUDE.md`, `pnpm worktree:new` is what normally
handles this kind of submodule/vendor setup for a fresh checkout — it wasn't
run here. This blocks: `src/__tests__/utils/simplecc.test.ts`, and cascades
into every module that imports `services/nav/index.ts` (which imports
simplecc) — that's the whole `document/*`, `libs/document.test.ts`,
`novel-import.test.ts`, `jieba.test.ts`, and several reader-hook test files.
Confirmed by direct error message: `Cannot find package '@simplecc/simplecc_wasm'`.
Verify on a real dev machine (`pnpm worktree:new` or equivalent) rather than
in this sandbox.

## Not done (out of scope so far)

`src-tauri/` Rust: optionally could strip the macOS `apple_auth`/`safari_auth` native
Sign-in-with-Apple command registrations from `lib.rs` — low priority, they're isolated,
self-contained files that don't break anything left as unused dead code.
