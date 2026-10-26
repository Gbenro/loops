> Historical Journey preview context, preserved from the UI worktree. The live integration and current issue are documented in [the Beta release candidate](../luna-field/RELEASE_CANDIDATE.md). The isolated preview still uses synthetic fixtures.

# Luna Echo Playback Journey — isolated frontend preview

This design continues Beta's navy surfaces, restrained gold Original Voice waveform,
serif Echo titles and orbital controls. A chronological path sits beside the current
voice on desktop and below it on mobile. Grouping changes the headings, not the
order of a life. No sentiment, psychological interpretation or new lunar calculation
influences the display.

The existing Beta player plays one Echo at a time and stops on hash navigation.
Its Echo list and cycle context already exist. This prototype adds queue interaction
without editing that application or Gemini's live-services boundary.

## Open on Windows

Double-click `preview.cmd` in this folder, then open **http://127.0.0.1:5181/**.
Keep the command window open. If the port is already in use by this preview, open
the URL directly. The script uses Node from PATH or the installed Codex Node runtime.
Node 24 is used for validation (the build uses built-in TypeScript stripping).

Or, from the repository root:

```powershell
node design/echo-journey/build.mjs
node design/echo-journey/serve.mjs
```

No package installation is required. Build output stays in this folder's ignored
`dist/`; the server binds loopback only. Existing Beta ports and bundles are untouched.

## Try it

1. Press the gold play button; let a recording end to hear automatic advancement.
2. Pause, seek along the waveform, move next/previous, and return to a visited Echo.
3. Choose oldest/newest order; the current voice keeps its position. The new order
   determines the next Echo. Choose day, phase or cycle without interrupting audio.
4. Keep a place, move elsewhere, then return. Reload and use Return to saved place
   to confirm the explicit preview bookmark persists. Return always starts paused.
5. Narrow the window. A compact control bar appears when the full player scrolls
   out of view. Switch light/dark with the top-right theme control.

## What is real and what is simulated

- Real browser audio playback, seeking, pause/resume, next/previous, automatic ended
  transitions, race protection, queue ordering, grouping and preview bookmark storage.
- **Synthetic test data only:** five playable illustrative moments reuse two existing
  synthetic MP3 clips. A sixth unavailable recording is visible but excluded from
  playback. Waveforms are measured from those files. Dates/phase/cycle labels are
  illustrative, not astronomical claims.
- No authentication, live Field records, API requests, uploads, recording or persisted
  audio. CSP blocks network API connections. No import of Gemini's live adapter.
- Authenticated pagination, signed storage access/renewal, account-scoped bookmark
  persistence, account-switch wiring and real-phone background reliability remain
  integration work. See `COORDINATION.md`; the proposed contract is not yet agreed.

## Files added

All changes are inside `design/echo-journey/` on `agent/codex-ui`:

- `index.html`, `styles.css`, `app.mjs`: responsive interface and interactions.
- `journey.mjs`: queue, grouping, media lifecycle and position controller.
- `fixtures.mjs`: explicitly isolated demonstration adapter.
- `contract.ts`, `COORDINATION.md`: proposed Gemini boundary and coordination blocker.
- `build.mjs`, `serve.mjs`, `preview.cmd`, `.gitignore`: local preview tooling.
- `tests/journey.test.mjs`, `tests/browser.mjs`: controller and browser validation.
- `README.md`: review and handoff instructions.

Build copies the existing fixture audio and waveform data into its private output.
It does not edit them. No existing tracked files, shared app/contracts, live adapter,
auth, persistence, recording, lunar/Sky code, public Beta bundles or database changed.
No new dependencies, commits, push, merge or deployment.

## Validation

```powershell
node --test design/echo-journey/tests/journey.test.mjs
node design/echo-journey/tests/browser.mjs
```

Browser checks require the preview server and installed Chrome; override executable
with `CHROME_PATH` if needed. They use a fresh Playwright context with synthetic data,
real MP3 decoding, muted output, and local-only requests. Screenshots and axe output
are ignored under `artifacts/`. No personal browser session is accessed.

Controller: 19 tests passed, covering order/timezones, positions, sequential playback,
boundaries, cancellation/races, unavailable media, auth failures and browser rejection.
Browser: real playback, seek, queue transition, bookmark across reload, grouping,
ordering, themes, mobile widths, dock playback controls, keyboard seeking, no page
errors or external requests. WCAG A/AA axe checks on desktop dark/light, mobile dark
and the visible mobile dock report zero violations; automated checks
do not replace keyboard, screen reader or real-device review.

Existing `design/luna-field` suite: 23 source tests passed. Two artifact checks could
not run successfully because its generated `dist/Luna-Prototype.html` is absent in
this worktree. Its shared build was deliberately not run because it rewrites the
production Beta bundles. This is an outstanding artifact-test limitation, not a claim
that the whole legacy suite passed. Full root/backend regression was not run for this
isolated frontend addition.
