# Luna Design Handoff — Guide for Astra

Welcome, Astra. You are leading the comprehensive UI/UX redesign of Luna.

This handoff is your navigational compass. It establishes what is grounded in working production code, what is open for your creative redesign, and what must remain architecturally protected.

---

## 1. What You Need to Understand First

Luna is not a productivity tool, a habit tracker, or an ordinary voice recorder. It began as a container for personal expression and has matured into a **living personal Field**.

When someone speaks or writes into Luna, they are pouring original experience into an ongoing current. When they return, they are not reading a chronological social feed; they are revisiting memories shaped by natural, cyclical time.

### The Sacred Boundary:
* **The Person's Original Voice is primary**: AI does not grade, analyze, or put words into the user's mouth.
* **Observation before explanation**: Allow moments to exist as they were felt.
* **The Moon is structure**: The 29.5-day synodic rhythm and 8 phases provide the temporal scaffold, not decorative clip art.
* **Environmental, not emotional, theming**: Visual environments reflect astronomical reality (season, phase, daylight/night), **never** an algorithmic mood score of what was spoken.

---

## 2. Which Files to Read First

We have organized a complete design context package in this repository:

1. **Primary Master Package**:
   * `LUNA_DESIGN_CONTEXT.md` — Complete design specifications, product model, and reality matrix.
2. **Deep-Dive Modular Specs** (`luna-design-context/`):
   * `screens.md` — Detailed screen inventory with inputs, actions, and states.
   * `diagrams.md` — 4 visual Mermaid diagrams of user flows and entity models.
   * `components.md` — Existing component maturity and CSS token definitions.
   * `existing-capabilities.md` — What works right now in production.
   * `proposed-capabilities.md` — Visual ideas you are invited to explore.
   * `constraints.md` — Non-negotiable privacy, immutability, and hardware boundaries.
   * `sample-data.json` — Pure synthetic dataset to use for mockups.

---

## 3. Which Screenshots to Inspect

Inspect the 12 live captures in `luna-design-context/screenshots/`:

| File | What It Illustrates |
| :--- | :--- |
| `01_echo_entry_desktop_dark.png` | Codex's new Echo entrance on desktop (gold accent, generous margins). |
| `02_echo_entry_mobile_dark.png` | Codex's entrance stacked for mobile viewports (48px touch targets). |
| `03_echo_entry_mobile_light.png` | Warm cream / paper theme appearance. |
| `04_echo_entry_composer_transition.png` | Transition into active writing and audio draft controls. |
| `05_sky_tab_mobile.png` | Real-time MoonFace, illumination percentage, tide bar, and starfield. |
| `06_deep_cosmic_sheet_mobile.png` | Slide-up astronomical drawer with exact phase start/end dates. |
| `08_loops_tab_mobile.png` | Active Cycle loops, Phase loops, and circular completion rings. |
| `10_echoes_tab_mobile.png` | Real Echoes feed, audio playback queue bar, and recovered drafts banner. |
| `11_rhythm_tab_mobile.png` | 8-phase practice observation cards. |
| `12_chat_tab_mobile.png` | Luna conversation interface with thinking states and grounded citations. |
| `13_sky_tab_desktop.png` | Sky view rendered within a focused desktop column. |
| `14_loops_tab_desktop.png` | Loops view rendered on desktop. |

---

## 4. What is Real vs What is Proposed

### Real (Functioning Production Backend & Frontend):
* Spoken voice recording with client-side Whisper transcription.
* Resilient device-local audio drafts in IndexedDB.
* Continuous voice playback queue.
* 8-phase Meeus astronomical engine & 12 named lunar cycles.
* Cycle & Phase Loops with subtask rings.
* Client-side zero-knowledge passphrase encryption.
* Grounded Chat citations (`[Ref: ...]`) and ElevenLabs Nicole TTS.

### Proposed (Astra is Invited to Explore Visually):
* **Cycle Visual Worlds**: A shared visual environment that morphs with the seasonal moon (e.g. Sturgeon deep waters vs Harvest golden fields).
* **Phase Environmental Variation**: Shifting conditions within that world (clarity vs mist).
* **Time-of-Day Lighting**: Subtle atmospheric transitions (dawn, twilight, midnight).
* **Living Phase & Cycle Reflections**: Evolving narrative synthesis of accumulating memories across 29 days.
* **Returns Across Time**: Resurfacing memories from past cycles when the moon returns to the same phase and sign.

---

## 5. What You are Free to Redesign vs What Must Remain Unchanged

### What You are Free to Redesign (Astra's Creative Domain):
* Visual hierarchy, typography scaling, and layout rhythm.
* Card anatomy for Echoes, Loops, and Reflections.
* Transition animations and tactile micro-interactions.
* Navigation structure and drawer/sheet mechanics.
* Audio player waveforms, controls, and queue presentation.
* The visual manifestation of the lunar cycle and time-of-day lighting.

### What Must Remain Architecturally Unchanged (Engineering Invariants):
* **Immutability of Original Echoes**: Historical user recordings cannot be altered or overwritten by AI.
* **Provenance Separation**: Original voice (`provenanceAuthor: 'user'`) must always remain strictly distinct from co-created reflections (`provenanceAuthor: 'co-created'`).
* **Zero-Knowledge Architecture**: The UI must preserve the client-side encryption flow without exposing plaintext to servers.
* **Device Draft Safety**: Recording must never discard an audio draft before server sync confirmation.

---

## 6. Product Questions Requiring Human Approval

Before finalizing high-fidelity mockups, align with the human director on:
1. Should the **Rhythm tab** remain a separate top-level tab, or should practice observation fold into the Field?
2. How should the transition between the **Cycle World** and the **Personal Field** feel — an immersive backdrop or an editorial frame?
3. What is the preferred visual metaphor for **Returns Across Time** — a cosmic constellation, a spiral timeline, or seasonal markers?
