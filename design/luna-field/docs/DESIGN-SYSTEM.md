# Luna visual system — Ocean & Horizon

The composition invites expression first, then return. A quiet ocean world gives continuity to the Field. Serif headings create space around a thought; compact interface typography keeps navigation and actions clear. The gold waveform is the recognizable marker for Original Voice.

## Circular refinement

The second pass uses circles for entering, listening, and navigating time. The primary Speak control opens into concentric recording rings with a measured live curve. The phase wheel is a functional orbit, with its arc ending at the selected phase. Curved links and open spirals connect Returns and Thread moments. Text, transcripts, and writing areas retain comfortable rectangular reading geometry with softer edges.

The supplied storyboard references informed the layered coast, warmer horizon, larger environmental Echo header, and focused Original Voice treatment. Original expression and user agency remain more prominent than any reflection.

## Navigation

| Primary space | Purpose | Contextual pathways |
| --- | --- | --- |
| Field | Reenter the ongoing Field and express something | Capture → Echo; recent Echo → detail; intention → Loops; Return → comparison |
| Echoes | Browse original experiences | Echo → Phase → Cycle; Echo → Thread → connected Echo; Echo → reflection or selected chat context |
| Cycles | Encounter the same Field through recurring time | Phase → its Echoes; Cycle → all its Echoes; earlier phase → a Return |

Loops, Threads, and Reflections are secondary views within the Field. Chat is “With Luna,” with explicit selected context. On mobile, primary views and Chat live in a bottom navigation bar, with capture in its center and secondary views in the menu.

## Palette

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#0b1019` | `#f4f3ee` | Canvas |
| `--sidebar` | `#0e141f` | `#eeeee8` | Navigation and primary document surface |
| `--surface` | `#121b28` | `#fbfbf7` | Audio, contextual invitations, forms |
| `--text` | `#ebece9` | `#26313b` | Main expression and headings |
| `--muted` | `#a2adbb` | `#566473` | Supporting text |
| `--faint` | `#8391a3` | `#627080` | Metadata |
| `--gold` | `#dbc18c` | `#795b22` | Original Voice, primary action, selected context |
| `--line` | `#263140` | `#d1d7d4` | Quiet grouping and dividers |

The cinematic ocean keeps its own dark treatment in both interface themes. Gold is restrained; borders do not glow. There are no decorative star fields or purple AI gradients.

## Typography and spacing

- Headings use the platform's Iowan/Palatino/Georgia serif family. UI text uses the native sans-serif stack. No third-party font request is made.
- Desktop display titles: approximately 40–53 px; mobile: 32–39 px. Original expression: 15–16 px with generous line spacing.
- Section titles are modest. Metadata uses small, contrast-conscious type and does not carry essential interaction instructions alone.
- Spacing follows a mostly 4 px rhythm, with 22–50 px page gutters depending on viewport. Reading surfaces use approximately 18–36 px corners, with larger curved environmental edges. Action controls and temporal nodes are circular; long inputs remain readable.
- Content is constrained on large screens; mobile is a single column. Medium widths collapse secondary columns before reducing reading space.

## Components

| Component | Role and behavior |
| --- | --- |
| Ocean world | Same layered SVG horizon through all eight phase conditions. Dawn/day/dusk/night are explicit controls. No content-dependent selection. |
| Phase orbit | Eight keyboard-operable circular phase nodes around a continuity ring. The selected node and arc show position in the illustrative cycle. No astronomical calculation is performed. |
| Original Voice waveform | Stable warm-gold language across all environments, with a native range input for seeking. Stored shape is derived from audio; the recording shape comes from live microphone samples. Approximate live-envelope fallbacks are labeled. |
| Echo row | Timestamp and phase → original title and excerpt → voice/written format. Whole row opens detail. |
| Original Voice player | Play/pause, seek, elapsed and duration, synthetic/local provenance, transcript below. |
| Reflection | Original expression remains above it. Authorship label and subtle side rule distinguish user and AI-assisted perspectives. |
| Intention row | Title, optional context, explicit state selector, local history, and originating Echo where provided. No due date or overdue state. |
| Return comparison | Two original expressions with temporal context and optional user reflection. No automatically declared meaning. |
| Chat context | User-selected Echo chips, removable individually; response source links; explicit scripted-demo label. |
| Circular Speak | Native modal with concentric rings, actual microphone curves, measured input level, recording preview, optional words, and explicit analysis availability. |
| Review dialog | Capability labels, graceful-state controls, microphone-denial simulation, and deliberate reset. |

## Motion and accessibility

Motion is limited to short control transitions, audio-driven curves and ring response, playback progress, and the loading skeleton. There is no timed decorative voice loop. The ocean is still. Live SVG updates are capped at about 30 Hz. `prefers-reduced-motion` replaces the moving recording curve with a still line and a measured level, removes ring scaling, and suppresses nonessential transitions. Playback progress remains tied to the real playhead.

The implementation provides semantic landmarks, a skip link, labeled controls, visible focus styles, keyboard-operable native buttons/forms/dialogs, selected states, status/error announcements, transcripts, and phase-button arrow navigation. Most primary controls target 44 px or more; compact secondary phase controls have spacing and keyboard alternatives. Decorative icons and waveforms are hidden from screen readers.

Accessibility intent is implemented but not certified. Browser keyboard traversal, focus behavior, zoom, screen-reader output, microphone permissions, and final rendered contrast still need real-browser review. The current environment did not expose the supported browser QA control.

## Agency and interpretation

Every original expression remains primary. No environment is chosen from the person's text. No phase assigns a task, mood, or identity. The synthetic AI-assisted reflection asks whether a connection is relevant; the interface never promotes it into a conclusion. Loops can be closed or carried forward by the person. Chat receives only selected demonstration context, and its scripted nature is visible.
