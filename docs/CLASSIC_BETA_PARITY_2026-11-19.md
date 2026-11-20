# Classic-to-Beta reliability handoff — 19 November 2026

Ben wants Beta to become his daily Luna app with Classic's capabilities. He confirms the repeated-login failure occurs when reopening the same browser/app, not only when switching between origins.

## Ownership agreed with Gemini in Antigravity

- Codex: session persistence, Echo/Loop and audio reliability, integration checks, and release preparation.
- Gemini: backend chat/provider repair in mcp-server/src/chat.ts, backend verification, frontend review, and release coordination.
- Codex worktree: C:/Users/Ben/Documents/Codex/2026-11-19/all-right-um-i-want-to/luna-parity.
- Branch: codex/parity-gap-closure-20261119, based on ddc8624.
- Gemini's preserved Beta worktree: C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/luna-reliability-journey, branch gemini/beta-reading-waveform-chat.
- No frontend deployment or replacement of Classic was performed in this session.

## Existing work retained

ddc8624 contains collapsible transcripts, measured waveform seeking, and live Beta chat integration. Its parent 6d7346c contains the earlier audio-download and dual-storage auth changes. These local branch changes must not be confused with a verified live frontend deployment.

## Corrective changes in this branch

1. Shared src/lib/authStorage.js for Classic and the generated Beta bundle:
   - prefer the current synchronous token instead of overwriting it with stale IndexedDB;
   - mirror local-only sessions into IndexedDB;
   - recover IndexedDB-only sessions on Beta startup;
   - bound open and transaction waits and close connections;
   - retain a signout tombstone when durable deletion cannot complete;
   - prevent late restoration from overwriting a newer sign-in.
2. Beta refresh uses Supabase's existing lock:<storageKey> Web Lock name when Classic and Beta share an origin.
3. Startup sync is explicitly initiated by the app after account listeners are installed. Focus/resume refreshes Field data, with in-flight coalescing and a recording guard.
4. Beta's five Loop states persist in existing metadata.luna_beta_lifecycle; Classic sees compatible active, released, or closed statuses. Classic edits preserve metadata; a Classic status change supersedes an older Beta marker. Offline retries retain unrelated server metadata and closure fields.
5. Durable audio paths take precedence over stale remote audio URLs, allowing signed URL renewal and cache expiry.

This does not create cross-origin cookie sharing. Classic and Beta subdomains retain independent browser storage.

## Verification

- npm run build:beta: passed; regenerated tracked Beta HTML/review artifacts.
- Node Luna Field/Echo Journey tests: 114 passed.
- Focused Vitest: storage, auth storage, audio storage, audio format, Echo download — 52 passed.
- Playwright desktop: built Beta startup/capture and persistent-browser restart auth — 2 passed. Tests use synthetic sessions and intercept external traffic.
- Restart acceptance test closes and relaunches Chrome with the same profile, checks persistence, removes localStorage to prove IndexedDB recovery, then verifies explicit signout survives a further restart.
- Full Vitest before the final two added storage cases: 939 passed, 4 failed. All four failures reproduce on unchanged ddc8624:
  - two chatAttentionIntegration.test.js longitudinal-span expectations;
  - dshHarnessBridge.test.js WSL path expectation on Windows;
  - ChatTimeoutRecovery.test.jsx retry assistant-reply expectation.
- Backend TypeScript build passed to supply full-suite dependencies; backend source was not edited.
- Capacitor sync to this isolated worktree's Android project passed. No APK installation or physical Android/DuckDuckGo verification was performed. The separate canonical Windows Android checkout was not overwritten.
- Full-suite reports and build logs remain local in the worktree; test browser profiles are excluded from commits.

## Release checks and remaining feature gaps

This is a tested reliability increment, not a declaration of full Classic parity or authorization to replace the main app.

Gemini should review the exact commit diff, compare with current remote Beta/main, prepare the appropriate Classic and Beta frontend releases, and verify deployment identity. The shared auth/storage commit can be applied independently to Classic; Beta's follow-up depends on it.

Before calling Beta the main app:
1. Verify the release on Ben's actual Android browser after close/reopen and token expiry, as well as explicit signout/account switching.
2. Exercise real text/voice Echo sync both directions, tags, offline recovery, original audio playback and downloads.
3. Exercise all Loop statuses through Classic/Beta and offline retry.
4. Verify real chat, session history, selected context, provider error/fallback labeling and retry deduplication.
5. Audit and implement remaining Classic capabilities: optional encrypted Echo unlock/read/write, Loop subtasks/checkpoints and richer metadata, chat model/voice controls and TTS, and any required Rhythm/settings flows. Beta's current contracts expose a smaller Loop and Chat interface, and its live adapter has no encryption path.
6. Resolve or explicitly triage the baseline test failures before claiming a fully green release.

## Backend status reported by Gemini

Gemini reported that the live app used a Railway service with a stale OpenRouter key, while a different project held the valid key. It reported correcting the service configuration and verifying genuine replies through Gemini and GPT models. It also reported that the selected Claude model still encountered a credit/budget failure and began a transparent fallback patch. This document records Gemini's report; Codex has not independently verified a final fallback deployment.
