# Luna frontend integration contract

Status: **independent design exploration; production integration and deployment stopped.**

This document describes the contracts the frontend needs. It does not document verified existing endpoints. No database tables, routes, credential shapes, encryption properties, or authorization rules have been guessed. `src/contracts.ts` is a frontend domain model that must be mapped to the existing application's actual contracts.

## Feature status

The status labels distinguish product claims from the implementation in this package. Every working interaction in this package uses the frontend prototype.

| Feature | Capability status | Current implementation / verification needed |
| --- | --- | --- |
| Field overview | **Frontend prototype only** | An in-memory view of synthetic records. Verify a minimal authorized Field summary contract before real retrieval. |
| Authentication and Field authorization | **Existing backend capability — requires verification** | Mock `getSession()` returns demo mode. Verify the existing session mechanism, identity scope, expiration, record permissions, and logout behavior. |
| Text and voice Echo capture/retrieval | **Existing backend capability — requires verification** | In-memory text creation and browser-local recording. Verify schemas, upload and processing lifecycle, limits, and idempotency. |
| Original Voice playback and transcripts | **Existing backend capability — requires verification** | Embedded synthetic samples or local blob URLs, with measured waveform data; supplied text or a user note. Verify media access and authoritative transcript availability. |
| Live voice visualization | **Frontend prototype only** | Local Web Audio microphone analysis and audio-derived playback curves. Actual microphone/browser compatibility still requires device testing. |
| Loops | **Existing backend capability — requires verification** | Local states and local transition history. Verify actual state names, carry-forward semantics, and relationship to cycles. |
| Threads | **Existing backend capability — requires verification** | Explicit local links to existing demonstration Threads. Verify actual relationship models and mutation capabilities. |
| Lunar cycles and phases | **Existing backend capability — requires verification** | Fixed illustrative fixtures. Obtain authoritative backend context; no astronomical calculations are implemented. |
| User-authored / AI-assisted reflections | **Existing backend capability — requires verification** | New local user reflections; separately labeled static AI-assisted examples. Verify supported authorship, provenance, and lifecycle. |
| Chat with selected Field context | **Existing backend capability — requires verification** | Scripted local responses with selected Echo references. Verify server-side context authorization and actual model/service behavior. |
| Side-by-side Returns | **Frontend prototype only** | A curated comparison of two synthetic Echoes and an optional local reflection attached to the recent Echo. |
| Cycle worlds and phase/time illumination | **Frontend prototype only** | Deterministic SVG world rendering based solely on selected phase and time. |
| Living Phase and Cycle Reflections | **Proposed new capability** | Described only. No generation, refresh, scheduling, or storage behavior is implemented. |
| World selection and continuity across cycles | **Requires product decision** | This exploration uses one ocean world for both synthetic cycles. Decide who selects worlds and whether each cycle locks its world. |
| Return selection and invitations | **Requires product decision** | Decide whether Returns are user-curated, requested, or suggested; establish evidence and dismissal behavior. |
| Draft retention and offline behavior | **Requires product decision** | Memory only. No IndexedDB or local-storage content persistence, sync queue, or retry upload. |
| Saving conversation content back to the Field | **Requires product decision** | No automatic Echo creation from chat. Any future save needs a distinct user action and provenance. |

## Boundaries to preserve

Presentation is separated from domain interfaces, synthetic fixtures, data operations, and application state. The current controller uses `snapshot()` as a **mock-only convenience** to render the small fixture set. A production implementation must replace that path with bounded, authorized queries and a view-model cache; it must not fetch the entire Personal Field by default.

`LunaServices` groups authentication, Echo, Loop, Cycle, Thread, Reflection, Chat, and audio adapters. It does not assume these services map one-to-one to backend endpoints. A verified adapter can call the existing application's approved client or service layer and translate its output into these domain objects.

Native recording and playback orchestration remain in the application controller; `VoiceEngine` separates local microphone analysis and decoding, and `audio-geometry.ts` contains pure signal-to-curve functions. Before integration, align the recording controller with the existing upload/processing lifecycle and interruption semantics. Keep recorded bytes separate from original text, transcript revisions, and reflections.

## Contracts to obtain from the existing application

| Boundary | Required inputs and outputs | Questions to resolve before connecting |
| --- | --- | --- |
| Session | Current session result and permitted Field scope; unauthenticated/expired states | How is the session established? How are browser origins, CSRF, refresh, and logout handled by the existing app? Do not introduce a second login system. |
| Field summary | Bounded recent Echoes, open intentions, and current authoritative temporal context | Which summaries are already supported? What is visible to this session? Can requests be cancelled? |
| Echo listing | Cursor/limit and approved filters → scoped page of Echo summaries | Which filters exist? What is the ordering? How are permissions, pagination, archived content, and deleted records represented? |
| Echo detail | Authorized Echo identifier → original expression, media availability, context, permitted relationships | Is a transcript original, corrected, pending, or machine-generated? Which details require additional authorization? |
| Echo creation | User text or recorded media reference, user-selected title, authoritative context, client request identity | What are size and duration limits? What is required vs optional? How are retries made idempotent? Is context set at capture time or processing time? |
| Audio upload | Approved media types, staged upload authorization, completion and processing result | What existing upload flow is supported? How are cancellations and failed processing cleaned up? What retention rules apply? |
| Audio playback | Echo/media identity → authorized, potentially expiring playback access | Is range seeking supported? What are expiry and refresh semantics? How are cross-origin playback and deletion handled? Never store privileged playback credentials in frontend files. |
| Loops | Bounded list and permitted transition operations → updated intention with authoritative history/version | Which of open/evolving/completed/carried-forward/closed map to real states? Does carrying forward create a link, a new record, or change context? |
| Threads | Bounded connections and explicit user-authorized link operations | Can a Thread contain Echoes, Loops, and reflections? Are any links suggested rather than authored? How is that distinction exposed? |
| Lunar context | Capture timestamp and applicable timezone → authoritative phase/cycle context | What exact timezone, hemisphere, date boundary, and cycle definitions does Luna use? Which service already owns these values? |
| Reflections | Source IDs, authorship/provenance, content and lifecycle | Are user edits and AI assistance tracked separately? Are revisions immutable? How are source links and deletion handled? |
| Chat | Current user message, selected context references, existing conversation identity → response and authorized evidence links | Is there a consent/authorization boundary for context expansion? How are streaming, interruption, retention, model disclosures, and source citations represented? |
| Errors | Typed failure categories and retry guidance | Distinguish unauthenticated, denied, not-found, offline, conflict, rate-limit, and unavailable. Do not collapse denied access into empty content. |

These are requirements to discuss, not claims that particular backend parameters already exist.

## Original expression and provenance

- Never rewrite an original Echo with a reflection or model summary.
- Keep original audio, any transcript, user corrections, user reflections, and AI-assisted reflections explicitly attributed.
- Preserve the timestamp and authoritative phase/cycle relationship belonging to the experience. Display timezone clearly and support late capture according to the backend's actual behavior.
- Source connections are evidence links. A suggested relationship must not be presented as the user's own conclusion.
- Waveform provenance is explicit: `decoded-audio`, `capture-levels`, or `unavailable`. The embedded synthetic speech is genuinely measured. New local recordings are decoded where supported, with an explicitly approximate timestamped live-level envelope as fallback. Keep waveform duration, amplitude normalization, channel treatment, and provenance aligned with the authorized media. Decide whether the production adapter provides precomputed data or permits local decoding; these fields are frontend contracts, not verified backend fields.
- The audio fixtures are computer-generated voices reading synthetic text. They are never presented as recordings of the real user.

## Audio visualization contract

`Echo` and `CaptureInput` accept a normalized amplitude array and its `waveformSource`. These are presentation metadata for the exploration, not changes to the existing backend. Live recording connects `MediaStreamAudioSourceNode` to `AnalyserNode` only; the microphone is never connected to the audio output. Signed time-domain measurements are smoothed into a continuous curve. Silence decays to a still line.

Finished audio uses a 256-bin envelope computed from decoded channels, combining channel energy without phase cancellation. A timestamped input-level fallback is explicitly approximate and may contain gaps if the browser suspends animation sampling. The waveform is a normalized amplitude visualization, not a forensic or sample-accurate oscilloscope.

Playback progress and its circular position indicator use the audio element's actual `currentTime` and duration. The surrounding ring may respond to measured envelope energy at that position; it never runs an independent decorative loop. Pause freezes progress; scrubbing changes the actual playhead. Reduced-motion mode disables ring expansion and the moving live curve while preserving audio controls and measured level feedback.

All source nodes, animation frames, microphone tracks, and discarded blob URLs are cleaned up on stop/cancel/exit. Decoding failures do not pretend that visualization succeeded. No network connection is introduced.

## World selection contract

The rendering hierarchy is **cycle world → phase condition → time of day → individual Echo**. The renderer accepts phase index and a selected time label. It never receives Echo text, sentiment, a psychological profile, or inferred emotion.

A future environment descriptor may contain an approved world identifier, palette/asset revision, authoritative phase, and time-of-day variant. Agree the actual contract with the existing team. Do not derive a world from private content. “Ocean” is not a label for emotion, and phases carry no behavioral prescription.

## Privacy and security boundaries

This build embeds no credentials, makes no network requests, and includes `connect-src 'none'` in the standalone application's CSP. Existing records are all synthetic. New session content exists only in memory; media uses local blob URLs, microphone tracks stop on completion/cancel/exit, and URLs are revoked when discarded or reset. Theme preference is the only local-storage value.

Before an approved integration:

1. Reuse existing authentication and authorization. Enforce access on the server for every record, relationship, and media operation.
2. Use the host application's approved browser client or backend mediation. Never place service-role keys or production secrets in browser code.
3. Request only the minimal records needed by the active view. Do not treat a frontend filter as an authorization boundary.
4. Replace the prototype CSP with the host application's reviewed policy and nonce/hash build behavior. Permit only verified service and media origins.
5. Establish deletion, export, retention, private media handling, consent, and logging behavior from actual application contracts. This prototype makes no encryption or compliance claim.
6. Keep logs and telemetry free of Echo bodies, recordings, tokens, and private chat content unless an explicitly approved policy provides otherwise.
7. Add contract tests with a sanctioned fixture/test account before any real-user access. Keep production credentials out of this handoff.

## Graceful-state integration

The review dialog exposes simulated loading, empty, error, denied, and offline states. Simulations are labeled; they do not exercise a server. Microphone denial can also be simulated without requesting browser permission. Real native microphone failures have separate permission, no-device, and unsupported-context messages.

On integration, preserve drafts through transient failures, provide retry only where valid, represent conflicts explicitly, and avoid suggesting a save succeeded before the authoritative response arrives. A genuine offline mode, persistent recording recovery, and a synchronization queue require product decisions and additional implementation.

## Approved next work, when requested

The current deliverable ends at review. A future integration task should begin by reading the real client contracts and selecting which design decisions to adopt. Then implement the approved adapter, replace the mock snapshot with scoped queries, add integration and browser tests, and review with synthetic or sanctioned test data. Production access and deployment require a separate instruction.
