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

## Final coordination update

Local frontend commits:
- 023cbc9: shared auth persistence and Classic Loop metadata preservation.
- 15ea715: Beta restoration, lifecycle/audio sync, generated bundle and tests.

Gemini completed a read-only frontend review and reported no blocking issue. Its review covered the earlier 112-test version; Codex subsequently added two passing offline/durable-storage cases and preserved server-only metadata. Final local counts above reflect 114 Node tests and 52 focused Vitest tests.

Gemini's final backend report:
- main commits d1090eb (bounded OpenRouter completion tokens), cbae9cc (transparent Gemini fallback), eedc702 (Gemini tool-schema compatibility).
- Railway deployment 310b1da2-8363-4cde-adeb-375933407cf5 reported SUCCESS.
- A request selecting Claude returned HTTP 200 with a genuine Gemini 2.5 Flash reply and an explicit fallback notice; the selected model remained unchanged.
- This is Gemini's live verification report, not a Codex independent production probe.

The next feature phase should explicitly divide encryption/subtasks/realtime work and model/voice/transcription work between agents before edits, using separate worktrees. The current reliability candidate is prepared for frontend release review; full Classic replacement remains pending the feature and Android acceptance checks above.

## November 24 data parity implementation

- Classic auth is now on main as 0b29224. Codex independently fetched https://lunaloops.app and verified bundle /assets/index-DW_LR_iR.js contains durable auth storage and the signout tombstone. Ben has not yet confirmed physical Android reopen.
- Added Classic-compatible encrypted Echo unlock/lock/read/create. Passphrase and derived key remain in memory; decrypted text is never persisted by the Beta adapter. Encryption follows Classic: text only, original audio unchanged. Existing encryption setup remains in Classic.
- Added Loop checklist add/toggle/remove/reorder with Classic text/done fields, preserved phase checkpoint metadata, offline retry, account isolation, and protection from late acknowledgements.
- Added account-scoped Supabase Realtime notifications for Echoes/Loops/reflections. Hidden pages disconnect. Thirty-second visible idle synchronization backs up missed notifications; typing, recording and open dialogs defer redraw.
- No database schema or security policy changes. Uses the installed Supabase SDK via the existing build toolchain.
- Verified 123/123 Node tests, 3/3 Chrome browser tests (persistent process restart, mobile private Echo/checklist flow, startup), build:beta, local isolated Capacitor Android sync.
- Full Vitest: 941 pass, 4 failures in the same three suites independently reproduced on baseline Nov 19: chatAttentionIntegration (2), dshHarnessBridge Windows/WSL path (1), ChatTimeoutRecovery (1).
- Synthetic screenshots reviewed at test-results/private-echo-mobile.png and checklist-mobile.png. Local test reports/profiles and generated Gradle changes are excluded from commits.
- Gemini voice/chat 089876c is under review; cancellation/late-result handling and fallback disclosure corrections requested before integration. Final release must update both production main and the separate beta branch/project. Do not call physical-device login accepted or full release finished from these local tests.
