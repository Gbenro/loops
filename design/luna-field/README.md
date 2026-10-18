# Luna — A Living Personal Field

An independent frontend design exploration. **No existing Luna application was modified, connected, registered, or deployed.**

## Circular refinement

This revision builds on the original ocean-world prototype. The primary Speak entrance is circular, the recorder contains a live microphone waveform, and the eight phases form a navigable orbit. Echo playback uses measured, smoothly curved amplitude data with a progress sweep. Returns and Threads use curved connections while text remains on readable surfaces.

The two supplied Luna storyboards informed the coastal layers, moonlight, immersive listening space, and continuity between an Echo and its phase. Their prescriptive phase interpretations and automatically declared meanings were not imported into the interface.

## Open the experience

1. Open `dist/Luna-Review.html` in a current desktop browser. Use **Desktop** and **Mobile · 390px** to review the same application in two actual iframe viewports. Switching views preserves the current session.
2. Open `dist/Luna-Prototype.html` for the application without the review frame. All styles, scripts, vector environments, and two synthetic audio samples are embedded. No installation or internet access is needed for these files.
3. For the most reliable microphone permissions, serve the extracted project locally with the command below, then open `http://localhost:4173/Luna-Review.html`. A browser must support `MediaRecorder` and grant microphone access. If recording is unavailable, the capture dialog explains the limitation and keeps writing available.

```bash
python3 -m http.server 4173 --directory dist
```

Opening a new full-app window starts an independent session. **Reloading, closing, or resetting the application clears entries, recordings, reflections, intention changes, and chat.** Only the selected visual theme may be stored as a browser preference. The prototype does not upload or queue anything.

## A short review path

1. Start in **Field**. Select the circular **Speak** control or **Write instead**. Speak requests microphone access; allow it and speak, pause naturally, then tap the circle to finish. Keep an Echo and see its detail view.
2. Open **A little room between things**. Play its synthetic narration, watch progress pass through its measured waveform, pause, seek, and read the original transcript. Add a reflection in your own words.
3. Follow the **First Quarter** context link. Move around the eight-phase orbit (arrow keys also work), and explore Dawn, Day, Dusk, and Night. The same ocean remains recognizable.
4. Return to the Field and select **The same path. Another evening.** Compare the two source expressions without a predetermined conclusion.
5. Open **Loops**. Leave an intention, change its state, and explore Unfolding and Settled. A carried-forward state and history are demonstrated; no real cycle mutation occurs.
6. Follow a **Thread**. Connect another Echo to an existing demonstration Thread from the Echo detail.
7. Bring an Echo to **Luna**. Choose or remove context. Send a message; its response is explicitly scripted.
8. Select the sun icon for the light palette. In **Explore this prototype**, review empty, loading, error, access-denied, offline, and microphone-denied states.

## Architecture

| Layer | Source | Responsibility |
| --- | --- | --- |
| Domain contracts | `src/contracts.ts` | Typed frontend models and adapter boundaries; not a claim about backend schemas |
| Synthetic data | `src/fixtures.ts` | Example Echoes, Loops, Threads, Reflections, and illustrative lunar context |
| Data adapters | `src/mock-services.ts` | In-memory operations, validation, filtering, pagination, and scripted chat |
| View state | `src/state.ts` | Hash routing and review state |
| Presentation primitives | `src/visuals.ts`, `src/components.ts` | Icons, phase symbols, ocean, waveform, cards, navigation, context links |
| Screens | `src/views.ts` | Connected Field, Echo, Cycle, Loop, Thread, Reflection, Return, and Chat views |
| Audio analysis | `src/voice-engine.ts`, `src/audio-geometry.ts` | Real microphone samples, smoothed curves, decoded amplitude envelopes, fallback provenance, and cleanup |
| Measured fixtures | `src/audio-fixtures.ts` | Waveform data derived from the included synthetic narration |
| Application controller | `src/app.ts` | Interaction orchestration, native recording/playback, drafts, lifecycle cleanup |
| Design system | `src/styles.css`, `src/refinement.css` | Color tokens, typography, spacing, components, responsive and reduced-motion behavior |

The application is dependency-free TypeScript with native browser APIs. `build.mjs` uses Node's TypeScript stripping API to package it into standalone HTML. It does **not** run a static TypeScript type checker. The build helper is deliberately scoped to the current single-line import structure; replace it with the host app's bundler during a verified integration.

## Rebuild and run checks

Node 24 or newer is needed for the source build. The built HTML does not need Node.

```bash
npm run build
npm test
node --check dist/app.bundle.js
```

No package installation is required. Audio samples are already included in `assets/`. They were generated locally from the synthetic text using FFmpeg's Flite speech filter. Their 256-bin waveforms are derived from the actual decoded audio. `analyse-fixtures.mjs` regenerates those measurements when FFmpeg is available; normal building does not require FFmpeg.

During recording, Web Audio reads the actual microphone signal at up to 30 visual updates per second. When you finish, the browser attempts to decode the recording for its waveform. If the container cannot be decoded, a timestamped live-input envelope is used and labeled approximate. If neither is available, the interface explicitly says the waveform is unavailable; it does not substitute a fake animation.

Reduced-motion mode keeps the recording curve still and displays a measured input level. Playback position remains functional, while the surrounding ring does not expand or contract. All processing is local.

## Documents

- `docs/INTEGRATION-CONTRACT.md`: required capabilities, contract questions, trust boundaries, and feature status.
- `docs/DESIGN-SYSTEM.md`: visual direction, reusable components, responsive behavior, and accessibility intentions.
- `docs/VALIDATION.md`: completed checks and browser review limitations.

## Scope

**Frontend prototype only.** It does not use a real AI model, real lunar calculation, production login, production records, durable storage, upload service, automatic transcription, automatic connection inference, or live Phase/Cycle Reflections. Real integration requires the existing Luna contracts and an explicitly approved integration task.
