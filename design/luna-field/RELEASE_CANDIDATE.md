# Luna Beta reliability + Echo Playback Journey release candidate

Issue: `iss_1792789180166_oz55`. Base: `8324905269b006f53721666584f46649fbec622f`.
Branch: `codex/beta-reliability-journey`. Implementation owner: Codex.

## What changed

- Audio repair retains an uploaded path with `audioMetadataPending` until an
  owner-scoped metadata PATCH returns the confirmed path. Failed PATCHes retry
  without uploading the same audio again. Missing audio cannot become synchronized.
- A recorder session owns its draft ID, owner, chunks and sequential persistence
  through asynchronous stop events, independent of dialog teardown. Beta offers
  **Recover recording → Listen and recover → Keep this Echo**, plus discard.
  Recovery preserves the original capture timestamp and derives its lunar context
  at that time. Original bytes are available for download.
- Failed IndexedDB writes reject Echo creation, show a visible error and retain
  audio in memory while the page remains open. Memory is not a durable-save receipt.
- Draft reads/enumeration enforce exact ownership, including the signed-out case.
  Refresh responses recheck session identity after decoding. Web Locks serialize
  cooperating Beta refreshes across tabs; storage events invalidate media, views,
  pending requests and account caches. Beta no longer restores stale auth from IDB.
- Deletion and active-history queries paginate completely, with deterministic
  ordering and owner filters. Failed/malformed deletion pages stop reconciliation.
  Tombstones take precedence over active rows and newer local merges.
- **Listen** reuses the existing `design/echo-journey` controller, layout, styling
  and mobile dock. The new adapter loads only authenticated, original voice Echoes;
  no fixture adapter is imported into the live Journey.
- Journey supports day/phase/cycle filtering, both chronological orders, continuous
  playback, previous/next, seeking, queue progress, automatic resume and a separate
  explicitly kept place. Positions are stored locally per account, without audio
  URLs, transcripts or credentials. Resume never starts playback automatically.
- Playback prefers local IndexedDB, then signed URLs. Media errors renew a remote
  URL once before presenting retry; missing recordings are labeled unavailable.
  Account changes abort resolution and stop/release media. A durationless WebM can
  discover its duration through the browser decoder without changing its bytes.
- Historical display uses original timestamps and saved phase/month metadata;
  missing context uses the existing astronomical engine. Journey cycle identities
  distinguish lunations across years. Historical records and lunar calculations
  are not modified.

## Verification

All accounts, audio and records used in tests are synthetic; network traffic in
browser tests is intercepted. No private Field records or production writes used.

| Check | Result |
| --- | --- |
| Beta reliability/service/domain tests | 67 passed |
| Existing + extended Journey controller tests | 22 passed |
| Combined focused suite | **89 passed, 0 failed** |
| Beta TypeScript | Clean |
| MCP TypeScript (for Classic test prerequisites) | Clean; backend source unchanged |
| Generated Beta artifacts | All 3 match a fresh build; both scripts parse |
| Real Chrome capture | Recording remained active beyond 126 seconds; 126.12-second saved audio played after reload |
| Real Chrome recovery | Interrupted recording recovered, played and kept through Beta UI |
| Real Chrome IDB failure | Visible failure, capture retained, original audio download available |
| Real Chrome Journey | Cross-cycle playback, reverse order, all filters, saved place, expired URL renewal, missing audio, offline local playback passed |
| Real Chrome accounts | Pending audio cancelled on cross-tab switch; sign-out stops playback; late refresh cannot restore prior account; signed-out reload stays signed out |
| Responsive/navigation | Desktop dark, 390px mobile light/dock; Sky, Field, Echoes, Cycles, Loops, Threads, Reflections passed; no page errors |
| Full Classic Vitest | 914 passed, 4 failed; all 4 reproduced on exact base |

The four unchanged Classic failures are two `chatAttentionIntegration.test.js`
coverage-strategy assertions, `dshHarnessBridge.test.js` Windows path translation,
and `ChatTimeoutRecovery.test.jsx` retry-response rendering. The same selected base
tests produced 16 passes and those four failures. No `src/` or `mcp-server/src/`
changes are in this candidate.

## Run locally on Windows

Use Node 24+. From the repository root:

```powershell
node design/luna-field/build.mjs
node design/luna-field/serve.mjs
```

Open `http://127.0.0.1:5183/#/listen`, or double-click
`design/luna-field/preview.cmd` (includes a Codex-bundled Node fallback).
The server binds only to localhost. The live view begins signed out on a fresh
origin. Sign-in connects to the configured real services; test scripts instead
create isolated browser contexts with synthetic fixtures and intercepted requests.

```powershell
node --test design/luna-field/tests/*.test.mjs design/echo-journey/tests/journey.test.mjs
node mcp-server/node_modules/typescript/bin/tsc -p design/luna-field/tsconfig.json
node design/luna-field/tests/bundle-validation.mjs
node design/luna-field/tests/reliability-browser.mjs
node design/luna-field/tests/journey-browser.mjs
node design/luna-field/tests/auth-browser.mjs
node mcp-server/node_modules/typescript/bin/tsc -p mcp-server/tsconfig.json
node node_modules/vitest/vitest.mjs run
```

Browser scripts use installed Chrome on Windows (`CHROME_PATH` can override it).
They write JSON evidence and synthetic screenshots in ignored `design/luna-field/dist/`.
The original Journey preview remains independently runnable in `design/echo-journey/`.

## Scope and review limits

- Separate integration worktree; Gemini's checkout and the original Codex Journey
  directory remain unchanged. Generated Beta HTML is built, never hand edited.
- No dependencies added, authentication provider changed, schema migration, secret
  rotation, push, deployment, merge or production mutation performed.
- The repository's Android mirror command was not run: it writes into the shared
  native checkout, outside this isolated web candidate. Native packaging is pending.
- Foreground Chrome with a mobile viewport is not a physical Android screen-lock,
  OS process-kill, incoming-call or storage-pressure certification. Browsers may
  suspend recording; recovery can preserve only chunks the browser delivered and
  committed before termination. In-memory audio cannot survive closing the page.
- Offline playback covers recordings already stored locally. A cloud-only recording
  needs connectivity; this release does not silently download the whole audio library.
- Position storage is per account on this browser, not cross-device synchronization.
- Gemini's focused schema/storage/Classic compatibility review remains required.
  User approval remains required for any production action. Local recommendation:
  **GO for compatibility review and release-candidate testing; hold deployment.**
