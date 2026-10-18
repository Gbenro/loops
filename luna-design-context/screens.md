# Luna Screen Inventory & Interaction Specifications

This inventory documents every primary screen, sheet, modal, and drawer currently present in the Luna codebase.

---

## 1. Primary Tab Navigation (Bottom Navigation Shell)

* **Component**: `src/App.jsx` (`nav[role="navigation"]`)
* **Tabs**:
  1. **Sky** (`☽`): Astronomical cosmic view, lunar phase, illumination, and deep cosmic sheet.
  2. **Loops** (`◯`): 29.5-day Cycle intentions and 3.5-day Phase actions with circular completion rings.
  3. **Echoes** (`◎`): Living personal field of voice and text memories, audio playback queue, and draft recovery.
  4. **Rhythm** (`〜`): Practice observation layer tracking habits across the 8 lunar phases.
  5. **Chat** (`✦`): Conversational reflection space connecting present inquiries to past Field records.

---

## 2. Screen-by-Screen Specifications

### Screen 1: Sky Tab
* **Source**: `src/tabs/Sky.jsx`
* **Purpose**: Anchor the person in natural cosmic time (moon phase, illumination, cycle day, solar season, and zodiac position).
* **Entry Points**: Default app entry or bottom navigation tab `☽ Sky`.
* **Primary Actions**:
  - Tap on the central Moon to open the **Deep Cosmic Sheet** (`DeepCosmicSheet.jsx`).
  - Tap on the top-right profile avatar to open **Profile & Settings** (`ProfileMenu.jsx`).
* **Secondary Actions**:
  - Tap "Begin speaking" or "Record Echo" to switch directly to the Echoes tab.
  - Dismiss the Phase Transition banner if the lunar phase recently changed.
* **Data Displayed**:
  - Realistic Canvas/CSS MoonFace with crater texture and live illumination mask (`src/components/MoonFace.jsx`).
  - Starfield background with 50 shimmering stars (`src/components/StarField.jsx`).
  - Phase Tide Bar (`opening`, `flowing`, `completing`, `closing`).
  - Current Cycle Name (e.g. *Hunter's Moon*) and Day of Cycle (e.g. *Day 7 of 29.5*).
  - Current astrological placement (Moon in Scorpio, Sun in Libra).
* **States**:
  - *Loading*: Displays shimmering skeleton with gentle pulse.
  - *Dismissed transition*: Transition card is collapsed until the next phase boundary.
* **Mobile vs Desktop**:
  - Mobile: Fullscreen atmospheric view with vertical scroll.
  - Desktop: Centered card container with fixed max-width (520px).

---

### Screen 2: Deep Cosmic Sheet (Modal Drawer)
* **Source**: `src/components/DeepCosmicSheet.jsx`
* **Purpose**: Full astronomical breakdown without cluttering the primary Sky view.
* **Entry Points**: Tap MoonFace or "Cosmic Details" on Sky tab.
* **Data Displayed**:
  - Exact astronomical phase start and end dates (UTC and localized).
  - Percentage illumination (0–100%).
  - Solar cycle, season, days to next solstice/equinox.
  - Natal resonance (if user birth date/time/location configured in profile).
  - All 8 phases visual timeline ring with current progress marker.
* **Actions**: Swipe down or tap "Close" to dismiss.

---

### Screen 3: Loops Tab
* **Source**: `src/tabs/Loops.jsx`
* **Purpose**: Align personal commitments with natural cycles (Intentions for the cycle; tangible actions for the phase).
* **Entry Points**: Bottom navigation tab `◯ Loops`.
* **Primary Actions**:
  - Tap floating / top `+` action to open **Loop Creation Sheet** (`LoopCreationSheet.jsx`).
  - Tap on an active Loop card to view subtasks and linked Echoes.
  - Check off a subtask or complete/release a loop.
* **Secondary Actions**:
  - New Moon Ritual invitation banner (triggers `NewMoonRitual.jsx` during New Moon window).
  - Filter by Cycle vs Phase loops.
  - Expand/collapse historical completed/released loops.
* **Data Displayed**:
  - Loop cards with SVG progress rings (`src/components/Ring.jsx`).
  - Phase badge showing when loop was opened.
  - Subtask checklist with check animation.
  - Linked Echo badges showing memories attached to this loop.
* **States**:
  - *Empty State*: Phase-specific empty guidance from `phaseText.js` (e.g., *"No loops yet. What seed are you planting?"*).
  - *Loading*: Monospace "SYNCING LOOPS..." indicator.

---

### Screen 4: Loop Creation Sheet
* **Source**: `src/components/LoopCreationSheet.jsx`
* **Purpose**: Create a new Cycle Loop (29.5-day intention) or Phase Loop (action window).
* **Entry Points**: Tap `+` button in Loops tab.
* **Fields**:
  - Title input with phase-inspired placeholder.
  - Type toggle: Cycle Loop (pre-populates 8 lunar phase checkpoints) vs Phase Loop.
  - Color picker (subtle cosmic pastel palette).
  - Optional subtasks (add/remove steps).
  - Optional personal note.
* **Actions**: "Plant Intention" / "Create Loop" button; "Cancel" button.

---

### Screen 5: Echoes Tab (The Living Field)
* **Source**: `src/tabs/Echoes.jsx`
* **Purpose**: Hold original voice and text reflections in an ongoing, cyclical feed.
* **Entry Points**: Bottom navigation tab `◎ Echoes`.
* **Primary Actions**:
  - **Idle Entrance**:
    - *Production base*: Small button pair: `“{phaseContent.asks}”` (text) + `◎` (voice orb).
    - *Codex prototype*: Standalone card `<EchoEntry />` with prominent **Begin speaking** button and secondary **Write instead** action.
  - **Voice Playback Queue**: Play continuous queue of all recorded voice Echoes.
* **Secondary Actions**:
  - Recovered Drafts banner: Play, Resume, Sync, or Discard interrupted recordings.
  - Filter by Tag, Cycle, or Phase.
  - Tap Echo card to expand detail, view transcript, edit tags, or link to Loops.
* **Data Displayed**:
  - Chronological list of Echo cards.
  - Audio waveform / progress bar for voice Echoes.
  - Lunar metadata badge (Phase icon, illumination, day of cycle).
  - Provenance tag: `Original Echo` (user) vs `Co-created Reflection` (with Luna).
  - Attached Loops.
* **States**:
  - *Empty State*: Dynamic phase guidance from `phaseText.js` (e.g. *"No echoes yet. What is beginning to stir?"*).
  - *Syncing*: Inline non-blocking indicator `SYNCING ECHOES...`.
  - *Recovered Drafts Alert*: Orange banner showing unsynced device-local audio.

---

### Screen 6: Echo Recording Composer
* **Source**: Embedded in `src/tabs/Echoes.jsx` (`isWriting || isRecording`)
* **Purpose**: Active capture mode for spoken voice or typed text.
* **States**:
  1. *Recording Active*: Flashing recording dot, elapsed timer, live audio waveform visualizer, "STOP RECORDING" button, "CANCEL" button.
  2. *Transcribing Active*: "WAIT..." indicator with animated model progress bar (Whisper local WebAssembly/WebGPU).
  3. *Review / Edit Draft*: Textarea showing transcribed text (editable), inline audio preview player (▶ LISTEN), tag selector, link loop dropdown.
  4. *Saving*: "SAVING ECHO (1/2)..." -> "SAVING ECHO (2/2)..."
* **Failure Handling**: If upload fails, preserves raw audio in IndexedDB and alerts user without losing data.

---

### Screen 7: Rhythm Tab
* **Source**: `src/tabs/Rhythm.jsx`
* **Purpose**: Practice observation across the 8 phases (e.g., meditation, creative studio work, movement).
* **Entry Points**: Bottom navigation tab `〜 Rhythm`.
* **Actions**:
  - Tap `+ New Rhythm` to define a practice.
  - Tap observation button for today's phase: `Present`, `Deep`, `Light`, `Rested`, `Missed`.
  - Tap a Rhythm card to open `RhythmDetail.jsx` or `RhythmReport.jsx`.
* **Data Displayed**:
  - 8-phase radial or linear progress tracking.
  - Consistency and energy patterns over multiple lunar cycles.

---

### Screen 8: Chat Tab (Chat with Luna)
* **Source**: `src/tabs/Chat.jsx`
* **Purpose**: Conversational contemplation space with Luna, grounded in the person's Field.
* **Entry Points**: Bottom navigation tab `✦ Chat`.
* **Primary Actions**:
  - Type message in auto-expanding textarea or hold voice microphone button to speak.
  - Tap "✦" to send.
  - Tap assistant message to listen via speech synthesis (Nova / Nicole voice).
  - Copy clean message text (strips internal telemetry/citations).
* **Secondary Actions**:
  - Tap top drawer icon to view historical Chat Sessions (Active vs Archived).
  - Start New Conversation.
  - Archive current conversation.
* **Data Displayed**:
  - Conversational message bubbles with Markdown rendering.
  - Grounded Field citations (e.g. `[Ref: Hunter's Waxing Crescent]`).
  - Dynamic thinking phase indicator (e.g. *"✦ Gathering threads from the Field..."*).

---

### Screen 9: Profile & Appearance Menu
* **Source**: `src/components/ProfileMenu.jsx`
* **Purpose**: Application preferences, appearance, security, and data export.
* **Entry Points**: Avatar button on Sky tab.
* **Sections**:
  1. **Account**: Email, Sign Out, or Sign In modal.
  2. **Appearance**: Theme selection (**Dark**, **Dim**, **Light**, **Sunlight**, **Auto**).
  3. **Hemisphere**: Northern vs Southern (inverts moon waxing/waning visual angle).
  4. **Voice & Audio**: Model selection, voice selection (Nicole / Fable), playback speed.
  5. **Encryption**: Passphrase setup, verify token, reset.
  6. **Data & Privacy**: JSON export, local cache purge.
  7. **Natal Chart**: Date, time, and birthplace coordinates for cosmic resonance.
