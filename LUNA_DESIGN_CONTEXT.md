# Luna Design Context Package
### For Astra UI/UX Redesign and Shared Development Handoff

> [!IMPORTANT]
> **Boundary & Authority Statement**:
> This package describes Luna for UI/UX design purposes. It is not authority to modify Luna's backend architecture, database schema, privacy model, memory model, or product semantics.

---

## 1. Executive Design Philosophy

Luna began as a container for personal expression and has evolved into a living personal **Field**.

A person chooses what enters their Field. Echoes hold moments of original experience — spoken or written — preserved with fidelity and care. Returning to an Echo can feel like:

> *"Tapping into the flow that already is, and just adding, pouring into it."*

Luna supports continuity across time without imposing rigid interpretations or unsolicited AI evaluations onto someone's private life.

### Core Principles for Astra:
1. **One Field. Many ways of seeing**: The Field is unified. Views, filters, rings, and cycles are lenses onto the same enduring memories.
2. **Original experience before AI interpretation**: The person's original voice and exact words always take precedence over AI summaries or co-created reflections.
3. **Observation before explanation**: Present what was felt, spoken, or committed before attempting to analyze why.
4. **Cycles rather than disconnected feeds**: Time in Luna is cyclical (29.5-day synodic rhythm), not an endless vertical dopamine feed.
5. **Return rather than endless scrolling**: Experiences are designed to be revisited across subsequent cycles, building relational memory.
6. **Relationships rather than folders**: Experiences connect organically via shared phases, themes, and linked Loops rather than rigid nested directories.
7. **Depth without clutter**: Essential actions are immediate; deep cosmic and reflective layers are available on request.
8. **Calm without emptiness**: Warm, grounded, atmospheric surfaces (celestial gold, deep navy, soft cream) that invite reflection.
9. **Moon as structure, not decoration**: The lunar phase is astronomical reality and functional structure, not arbitrary astrology clip art.

### Long-Term Visual Horizon (For Astra's Design Exploration):
$$\text{Cycle world} \longrightarrow \text{Phase condition} \longrightarrow \text{Time-of-day atmosphere} \longrightarrow \text{Individual Echo}$$

* **The Cycle** provides a shared visual environment (e.g. *Hunter's Moon* evokes deep amber, long shadows, and late autumn earth).
* **Phases** change the condition of that same environment (clear illumination at Full Moon; soft mist and quiet darkness at New Moon).
* **Time of Day** subtly alters atmospheric lighting (dawn mist, midday clarity, twilight violet, midnight stillness).
* **Design Constraint**: Visual themes must arise from shared astronomical and seasonal reality. **Never generate or assign visual themes based on the psychological sentiment of a person's private Echo.**

---

## 2. Phase 1 — Repository & Working Tree Verification

* **Repository Location**: `C:\Users\Ben\Documents\Codex\2026-10-12\files-pasted-by-the-user-ran\work\loops-app`
* **Active Branch**: `codex/luna-echo-entry`
* **Base Commit**: `ebe8be29e61185479a07d84030ef281ffa8fc5fb` (`docs: add CODEX.md development and architecture guide for autonomous agents`)
* **Remote HEAD / Production**: `https://github.com/Gbenro/loops.git` on branch `main` (verified identical at `ebe8be2`).
* **Working Tree State**:
  - **Modified**:
    - `src/tabs/Echoes.jsx`: Integrates Codex's `<EchoEntry />` component replacing the idle button pair.
    - `package.json`: Adds `dev:echo-preview` and `build:echo-preview` scripts.
    - `.gitignore`: Excludes `dist-echo-preview/`.
  - **Untracked Codex Implementation Files**:
    - `src/components/EchoEntry.jsx`, `.css`, `.test.jsx`
    - `design/echo-entry.html`, `.jsx`, `.css`, `preview-adapters.js`
    - `docs/ECHO_ENTRY_PROTOTYPE.md`
    - `vite.echo-preview.config.js`
* **Preservation Guarantee**: All Codex changes remain completely intact; uncommitted work was neither merged nor overwritten.

---

## 3. Phase 2 — Luna's Product Model

| Concept | Tier | Description & UX Reality |
| :--- | :--- | :--- |
| **Personal Field** | **PRODUCTION** | The personal space holding a person's recorded Echoes, Loops, and Reflections. Zero-knowledge encrypted client-side when enabled. |
| **Echoes** | **PRODUCTION** | Fundamental unit of personal experience. Spoken audio or written thought anchored in lunar time. |
| **Original Voice** | **PRODUCTION** | Raw audio recording captured via browser/native MediaRecorder (`audio/webm`). User-authored and immutable. |
| **Transcripts** | **PRODUCTION** | Client-side transcription produced by local Transformers.js (Whisper WASM/WebGPU). Fully editable before save. |
| **AI / Co-created Reflections**| **PRODUCTION** | Synthetic insights created in dialogue with Luna. Formally stored with `provenanceAuthor: 'co-created'` and `provenanceKind: 'conversation_reflection'`. |
| **Loops** | **PRODUCTION** | Conscious commitments. **Cycle Loops** (29.5-day intentions with 8 phase checkpoints) and **Phase Loops** (3.5-day focused actions). |
| **Threads** | **PARTIAL** | Relational groupings of Echoes and Loops across cycles. Basic data associations exist; self-organizing trajectory UI is proposed. |
| **Lunar Cycles** | **PRODUCTION** | 29.53-day synodic months named after traditional seasonal moons (Wolf, Snow, Worm, Pink, Flower, Strawberry, Buck, Sturgeon, Harvest, Hunter's, Beaver, Cold). |
| **Lunar Phases** | **PRODUCTION** | 8 symmetric windows: 4 Thresholds (New, First Quarter, Full, Last Quarter) and 4 Flows (Waxing Crescent, Waxing Gibbous, Waning Gibbous, Waning Crescent). |
| **Relational Memory** | **PRODUCTION** | Attention V1/V2 engine retrieving historical Echoes and reflections into Chat context based on semantic relevance. |
| **Chat with Luna** | **PRODUCTION** | Conversational contemplation space using LLMs (Claude 3.5 / GPT-4o) with grounded citations (`[Ref: ...]`) and Nicole/Nova speech synthesis. |
| **Tags & Provenance** | **PRODUCTION** | Every record tracks `provenance_author` (`user` vs `co-created`) and `provenance_kind` to protect original voice from synthetic drift. |
| **People & Places** | **PROPOSED** | Explicit entities for people and geographical places are conceptual aspirations; they do not currently exist in the database or UI. |

---

## 4. Phase 3 & 4 — Information Architecture & Design System

For complete screen-by-screen inventory and component reference tables, see:
* [screens.md](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screens.md)
* [components.md](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/components.md)
* [diagrams.md](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/diagrams.md)

### Design Tokens Summary
* **Color Palette**:
  - Celestial Background: `#040810`
  - Surface Card: `#080d1a`
  - Gold Accent / Border: `#e6c594` / `rgba(245, 230, 200, 0.20)`
  - Lavender Focus: `#c4b5fd`
  - Text: High-contrast white (`#ffffff`) with muted levels (`0.88`, `0.72`, `0.55`).
* **Themes**: Dark (default), Dim, Light (warm cream paper), Sunlight (high-contrast outdoor), and Auto.
* **Typography**:
  - Headings & Poetic Questions: *Cormorant Garamond* (Serif).
  - Body & Form Controls: *DM Sans* (Clean, readable sans-serif).
  - Metadata & Badges: *Monospace* (Uppercase, letter-spacing 0.1em).
* **Touch Targets**: Minimum 48px height across all buttons.

---

## 5. Phase 5 — Echo Experience Deep Audit

### Recording & Saving Flow:
1. **Idle Entrance**:
   - *Production*: Small prompt button `“{phaseContent.asks}”` next to 48px round voice orb `◎`.
   - *Codex Prototype*: Standalone `<EchoEntry />` card with prominent **Begin speaking** button and secondary **Write instead** link.
2. **Permission & Initiation**: Clicking "Begin speaking" initiates `navigator.mediaDevices.getUserMedia`. The button switches to "Opening microphone…" with `aria-busy="true"` to prevent duplicate click collisions.
3. **Capture**: `MediaRecorder` records `audio/webm;codecs=opus`. A live timer and audio visualizer display in the composer.
4. **Resilient Local Draft**: When stopped, the raw audio blob is **immediately saved to IndexedDB** (`luna_audio_drafts`) before any transcription or network request is made.
5. **Transcription**: Client-side Whisper parses the audio. If successful, text is populated into an editable textarea.
6. **Save & Sync**: Tap "ECHO ↩" uploads audio to Supabase Storage and records the row in `echoes`. Upon server confirmation, the IndexedDB draft is marked `synced` and removed.
7. **Interruption Recovery**: If network fails or the browser closes, the draft remains in IndexedDB. Upon reopen, the **Recovered Drafts Banner** displays the audio with ▶ LISTEN, RESUME, RETRY SYNC, and DISCARD options.

### Echo Field Schema & Reality:
* `id`: **GUARANTEED** (Unique string `e_...`)
* `text`: **GUARANTEED** (Transcript or note)
* `source`: **GUARANTEED** (`'voice'` | `'text'` | `'luna_conversation'`)
* `audio_path`: **OPTIONAL** (Present for voice Echoes; null for text-only)
* `created_at`: **GUARANTEED** (ISO 8601 UTC timestamp)
* `phase` & `phase_name`: **GUARANTEED** (Astronomically computed phase)
* `phase_type`: **GUARANTEED** (`'threshold'` vs `'flow'`)
* `lunar_month`: **GUARANTEED** (Current synodic cycle name, e.g. *Hunter's*)
* `day_of_cycle`: **GUARANTEED** (Day 0.0 to 29.5)
* `zodiac`: **GUARANTEED** (Moon zodiac sign)
* `illumination`: **GUARANTEED** (Percentage 0–100%)
* `provenance_author`: **GUARANTEED** (`'user'` | `'co-created'`)
* `provenance_kind`: **GUARANTEED** (`'original_echo'` | `'conversation_reflection'`)
* `parent_id`: **OPTIONAL** (Points to parent echo if reflection)
* `is_encrypted`: **GUARANTEED** (Boolean flag)
* `tags`: **GUARANTEED** (Array of string tags)
* `loop_ids`: **GUARANTEED** (Array of linked Loop IDs)
* `waveform_data`: **NOT IMPLEMENTED** (Currently generated dynamically from raw audio element)
* `sentiment_scores`: **NOT IMPLEMENTED / REJECTED BY PRINCIPLE** (Luna does not score emotional valence)

---

## 6. Phase 6 — Lunar and Cycle Engine

* **Algorithm**: Jean Meeus Moon Ephemeris (`src/lib/lunar.js`) computing true geometric coordinates.
* **Synodic Period**: `29.53058867` days average.
* **8 Symmetric Phases**:
  1. **New Moon** (0.0 to 0.925d) — *Threshold*
  2. **Waxing Crescent** (0.925 to 6.458d) — *Flow*
  3. **First Quarter** (6.458 to 8.308d) — *Threshold*
  4. **Waxing Gibbous** (8.308 to 13.840d) — *Flow*
  5. **Full Moon** (13.840 to 15.690d) — *Threshold*
  6. **Waning Gibbous** (15.690 to 21.223d) — *Flow*
  7. **Last Quarter** (21.223 to 23.073d) — *Threshold*
  8. **Waning Crescent** (23.073 to 28.605d) — *Flow*
* **Cycle Boundary**: The cycle begins exactly at the astronomical New Moon conjunction and continues until the next conjunction.
* **Hemisphere Support**: Setting Southern Hemisphere in Profile inverts the visible lunar crescent angle to match local sky observation.

---

## 7. Implementation Reality Matrix

| Capability | Production Now | Partial | Proposed | Design May Explore | Evidence / Source File |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Voice Recording with Device Drafts** | ✅ | | | | `src/tabs/Echoes.jsx`, `src/lib/audioStorage.js` |
| **Local Whisper Transcription** | ✅ | | | | `src/lib/whisper.js` |
| **Codex EchoEntry Entrance** | | ✅ | | ⭐ | `src/components/EchoEntry.jsx`, `design/` |
| **Astronomical Lunar Calculation (Meeus)** | ✅ | | | | `src/lib/lunar.js` |
| **Symmetric Phase Tides (Opening/Closing)**| ✅ | | | | `src/lib/lunar.js`, `src/data/phaseContent.js` |
| **Cycle & Phase Loops with Rings** | ✅ | | | | `src/tabs/Loops.jsx`, `src/components/Ring.jsx` |
| **New Moon Intention Ritual** | ✅ | | | ⭐ | `src/components/NewMoonRitual.jsx` |
| **Chat with Luna + Grounded Citations** | ✅ | | | | `src/tabs/Chat.jsx`, `mcp-server/src/chat.ts` |
| **Nicole/Nova Speech Synthesis** | ✅ | | | | `src/lib/useLunaVoicePlayback.js` |
| **Client-Side Zero-Knowledge Encryption**| ✅ | | | | `src/lib/encryption.js`, `EncryptionContext.jsx` |
| **Continuous Voice Playback Queue** | ✅ | | | ⭐ | `src/tabs/Echoes.jsx` (lines 2110-2440) |
| **Rhythm Habit Observation Tab** | | ✅ | | ⭐ | `src/tabs/Rhythm.jsx` |
| **Living Phase / Cycle Reflections** | | | 💡 | ⭐ | Proposed conceptual evolution |
| **Cycle Environmental Worlds** | | | 💡 | ⭐ | Proposed visual system |
| **Time-of-Day Lighting Atmospheres** | | | 💡 | ⭐ | Proposed visual system |
| **Longitudinal "Returns Across Time"** | | | 💡 | ⭐ | Proposed cyclical resurfacing |
| **People & Places Knowledge Graph** | | | 💡 | ⚠️ | Not implemented in database |
| **Sentiment / Mood Scoring** | ❌ | | | 🚫 | Rejected: contradicts core philosophy |

*(Legend: ✅ Production Now · 💡 Proposed Exploration · ⭐ Astra Free to Redesign · 🚫 Explicitly Prohibited)*

---

## 8. Artifacts & Deliverables Index

* **Primary Documentation**:
  - `LUNA_DESIGN_CONTEXT.md` (This document)
  - `LUNA_ASTRA_HANDOFF.md` (Executive design handoff guide)
* **Supporting Package Files** (`luna-design-context/`):
  - `screens.md`: Detailed screen-by-screen specifications
  - `diagrams.md`: 4 Mermaid architecture & workflow diagrams
  - `components.md`: Component catalog & token definitions
  - `existing-capabilities.md`: Production truth
  - `proposed-capabilities.md`: Future horizon
  - `constraints.md`: Architectural & privacy invariants
  - `sample-data.json`: 100% synthetic privacy-safe test dataset
  - `screenshots/`: 12 live application screenshots (Desktop, Mobile, Dark, Light, Sheets)
