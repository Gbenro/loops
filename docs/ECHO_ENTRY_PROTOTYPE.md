# Luna Echo entrance — first implementation

Branch: `codex/luna-echo-entry`. Base: `ebe8be29e61185479a07d84030ef281ffa8fc5fb`.
Related brief: Luna Echo Experience Redesign, `iss_1792189315472_sdtm`.

This is a local prototype in the existing React application. On October 17, 2026,
network permission enabled a successful Development Bridge connection. The issue
and activity feed were read, and implementation, test, and build reports were
posted as `codex` and verified by reading them back. The issue remains `proposed`
and assigned to `gemini`; no reassignment or server change was needed to report.
GitHub's current `main` matches the base commit above. No commit, push, deployment,
schema change, or production Echo data change was made. Live deployment state
was not audited.

## Assessment and direction

Luna already has a useful foundation: recording and writing, original audio and
transcript playback, draft recovery, lunar/day/tag filtering, playback queues,
linked Loops, reflections, and multiple readable themes. Echoes owns its recorder
in `src/tabs/Echoes.jsx`; the separate voice hook is not that recording path.
Supabase storage and the backend transcription service sit behind it. Registration
uses the existing email/password and Google flows.

The current entry gives a writing prompt more space than its small voice button.
Echo cards combine the original expression with several controls and metadata
layers. The welcome copy foregrounds the moon before explaining the personal space.
These are opportunities to clarify hierarchy while preserving the working flows.

The proposed direction is **a place to speak, with time around it**:

| Experience | Proposed direction |
| --- | --- |
| Recording | An ordinary, welcoming invitation; a clearly named voice action; writing nearby. Warm gold, the existing navy/purple surfaces, generous spacing, and restrained motion. No required title or interpretation. |
| Revisiting | Original voice first, transcript next, dated reflections and explicit relationships available on request. Use chronological grouping to suggest continuity before trying a complex field map. |
| Welcome | Explain speaking, keeping, and returning in plain language. Present lunar context as optional. Audit storage, transcription, export, deletion, and encryption behavior before publishing privacy claims. |

The existing logo, moon texture, tutorial images, historical screenshots, and design
notes are references, not approval evidence. No creative assets were replaced.
Existing dark, dim, light, sunlight, and auto modes remain the visual foundation.

## The first increment

`EchoEntry` replaces only the idle entrance within the real Echoes tab:

- “You can begin anywhere.” and a short invitation.
- A labelled **Begin speaking** button and secondary **Write instead** action.
- A microphone permission pending state that prevents duplicate starts.
- Visible keyboard focus, 48px minimum button height, responsive layout, and theme
  colors. No new idle animation.

The existing `startRecording` and writing callbacks remain responsible for entering
the composer. The recorder, transcription, saving, recovery, library, playback,
reflections, auth, lunar calculations, relationships, and production data paths
were not changed. This patch does not fix interrupted recordings or add new
durability guarantees. The existing recorder persists a draft after stopping;
reliable protection during an interrupted recording needs its own focused patch.

New application files are `src/components/EchoEntry.jsx`, `.css`, and `.test.jsx`.
The `Echoes.jsx` diff is limited to one import and its idle JSX branch. Development
preview files live in `design/`, with their own Vite config and npm scripts.

## View it locally

The verified preview is currently running at
**http://127.0.0.1:5178/design/echo-entry.html** on this PC. It was already running
when checked; a second server was not started. If that server is stopped, restart
it from this repository:

```powershell
npm.cmd run dev:echo-preview
```

Dependencies are now installed. For a fresh checkout, run `npm.cmd ci` first.
Open **http://127.0.0.1:5178/design/echo-entry.html**. Keep the terminal running.
Use that full preview URL. This config intentionally blocks production clients.

The preview renders the actual Echoes tab with invented content and memory-only
storage adapters. It does not import App, auth, production Supabase clients, the
PWA plugin, or seeders. Microphone access happens only after the explicit recording
action and browser permission. Transcription is simulated. Preview recordings
and edits disappear on reload; use a disposable sample phrase. Theme preferences
can persist locally. The page refuses to mount Echoes if that browser origin has
an existing Echo cache; use a fresh private window in that case. Fonts use local
fallbacks because the preview does not load external font services.

Review the invitation and hierarchy first, then keyboard focus, writing entry,
microphone permission, and the transition into the existing composer. Check narrow
Android-sized widths and the light/sunlight themes. The library remains present
so the entrance can be judged in its real context.

## Validation and limits

Completed: Babel syntax parsing of all six changed/new JavaScript and JSX files;
Node syntax checks of the preview config/adapters; whitespace review respecting
the repository's existing CRLF; inspection of the minimal Echoes diff.

The earlier npm/DNS block no longer prevents validation. On October 17:

- **23 tests passed across 5 files:** the three new entrance tests, existing Echo
  initialization, cross-browser rendering, recovery, and immutability tests.
- **Both builds passed:** isolated Echo preview and normal Vite/PWA application.
  The main build still warns about the existing seedData import pattern, a large
  bundle, and old Browserslist data.
- **Chromium checks passed:** 320, 390, and 900px layouts in dark, light, and
  sunlight themes; no horizontal overflow; keyboard entry; writing/save; recording
  and stop using a fake microphone; simulated transcription and audio save;
  reload discarding preview records; and the existing-cache guard preserving its
  synthetic sentinel without displaying it. No runtime errors or external
  requests were observed. Dark and light screenshots were visually inspected.

These checks use invented content and synthetic microphone input. They do not
establish real-device interruption resilience or full application regression
coverage. Reproduce the targeted tests and builds with:

```powershell
npm.cmd test -- src/components/EchoEntry.test.jsx src/tabs/EchoesInitialization.test.jsx src/tabs/CrossBrowserEchoes.test.jsx src/lib/echoRecovery.test.js src/lib/immutability.test.js
npm.cmd run build:echo-preview
npm.cmd run build
```

Complete the project regression checks before integrating or committing. The
shared Android sync command was intentionally not run: this is an isolated web
experiment and that command copies assets into the shared Android checkout.

Recommended next step: review just this entrance together. After validation and
any adjustment, improve the recording/saving status and interruption resilience
as a separate increment; then work on a single Echo listening view. Refresh remote
code and reconcile newer work before integration. Production deployment still
requires explicit approval.

Development Bridge receipts, all authored by `codex` and read-back verified:

- Implementation: `evt_1792242349042_en4y`
- Tests: `evt_1792242349472_z4tv`
- Builds: `evt_1792242349771_fkx8`
