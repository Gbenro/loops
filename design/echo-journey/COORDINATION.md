> Historical Journey preview context, preserved from the UI worktree. The live integration and current issue are documented in [the Beta release candidate](../luna-field/RELEASE_CANDIDATE.md). The isolated preview still uses synthetic fixtures.

# Gemini handoff: Echo Playback Journey

Issue: `iss_1792189315472_sdtm`
Task: `codex-echo-playback-journey`
Agent/workstream: Codex / frontend playback interaction
Branch: `agent/codex-ui`
Base: `158984f116c4076b4f453ea56a9e914464f3fb2e`
Status: isolated prototype; proposed contract; **Gemini agreement pending**.

## Coordination evidence

Read the live Bridge events successfully (HTTP 200), including Gemini's latest
available event `evt_1792683592756_yuid`. Inspected Gemini branch `1e4e570` and
release branch `b47d2e8`; neither changes `design/luna-field` relative to shared
UI base `f74d017`. No playback contract response is present.

The local auth store supplies a discovery/read credential only. The approved
Codex session store at `%LOCALAPPDATA%\Luna\DevelopmentSecrets\codex\session.json`
does not exist. No discovery write, legacy credential workaround, session claim,
or provisioning was attempted. This document is a prepared message, **not a
published Bridge event or a confirmed agreement**. A creator-provisioned scoped
Codex coordination credential is needed to publish through the existing CLI.
No secrets should be pasted into this file or chat.

## Proposed smallest service boundary

Reuse `EchoAdapter.list` and `AudioAdapter.resolve` behind a read-only wrapper;
keep Gemini's adapters unchanged until reviewed. `contract.ts` specifies the
proposed wrapper, not a new backend endpoint. Live wiring is not implemented.

1. List authenticated voice Echo metadata, using cursor pagination. Return stable
   ID, original instant, title, recorded duration/real waveform if available,
   availability, and server-authoritative cycle/phase context. Cycle IDs must be
   globally unique across years. Written Echoes and TTS of transcripts never enter
   Original Voice playback. Missing audio stays unavailable; no synthesized fallback.
2. Resolve original audio by Echo ID, just before playback. Gemini owns authorized
   storage access and signed-URL renewal. Distinguish ready, unavailable, auth required,
   forbidden, and retryable error. Support cancellation. Never include storage
   credentials or URLs in persistent frontend bookmarks or development reports.
3. Codex owns sorting, contiguous grouping, media controls, queue state, seeking,
   presentation and error feedback. Grouping does not reorder chronological time.
   Phase headings distinguish separate cycles; day boundaries use the displayed
   browser timezone, subject to product confirmation.
4. Page through the complete requested history before claiming the queue is complete;
   during integration show pagination/loading failures and do not silently call a
   partial snapshot the person's entire history. The preview has a finite fixture
   queue and does not claim to exercise authenticated pagination.
5. On sign-out/account switch dispose media, abort resolution and clear queue/positions.
   No default fixture fallback in authenticated mode, including offline/error paths.
6. A position is `{echoId, seconds, order}`. The prototype keeps visited positions in
   memory and an explicitly requested bookmark in a **preview-only** storage key.
   Live account-scoped/device persistence requires Gemini review; cross-device sync
   is a product decision and is not implemented. Resume is paused, never unsolicited audio.

## Message ready for Gemini

Please review `design/echo-journey/contract.ts` and the six points above. Confirm
canonical cycle identifiers, metadata availability/pagination, audio-resolution
status mapping, account-switch lifecycle, and preferred bookmark ownership. Codex
will leave shared `app.ts`, `contracts.ts`, live services, and generated Beta bundles
unchanged until this boundary is agreed. Gemini retains live sync, storage, capture,
authentication and recording reliability ownership. This preview contains no live
data connection and introduces no fixture records into the authenticated Field.

Suggested recognized event: `developer.question`; target `gemini`; workstream
`echo-playback-ui`; task ID above. Once a verified session exists, use its exact
session ID in the existing report CLI. Report completion as frontend-preview only,
with tests from README; never as live feature acceptance.

## Decisions before integration

- Gemini agreement and a supported scoped Bridge publishing credential.
- Device-only versus cross-device listening positions and retention/account scoping.
- Whether order changes should keep the current Echo (prototype behavior).
- Browser-local day boundaries versus the person's account timezone.
- Mobile locked-screen/background playback expectations; real-device testing with
  authenticated storage is required. No guarantee of OS background execution is made.
- Human approval of the design and subsequent integration. No deploy is authorized.
