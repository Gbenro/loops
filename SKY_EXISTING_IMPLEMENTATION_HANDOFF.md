# Luna Sky — Existing Implementation Handoff & Technical Audit

> **Target Audience**: Astra / Codex Frontend Redesign Team  
> **Repository Context**: Luna Shared Checkout (`loops-app`)  
> **Status**: Verified Production Implementation Baseline  
> **Scope**: Astronomical Parity & Frontend Presentation Handoff (Zero New Astronomy Features)

---

## Executive Summary

The **Sky** tab is Luna's primary astronomical and energetic anchor. It grounds the user's contemplative experience in real-time celestial mechanics (Moon phase, illumination, synodic age, zodiac transit, solar season, and personal natal resonance).

This document audits and specifies the **working production implementation** of the Sky section in the main Luna codebase. Astra's redesign task for the isolated beta is strictly a **presentation and UX elevation** of these capabilities; no astronomical formulas, calculation engines, or backend contracts should be altered or lost.

---

## Visual Inventory & Reference Screenshots

All captured screenshots are privacy-safe (generated from synthetic/clean local environment) and located in [`luna-design-context/screenshots/`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots):

| Viewport | Component / State | Screenshot File |
| :--- | :--- | :--- |
| Mobile (390×844) | Header, Realistic MoonFace, Phase Title, Energy Card | [`sky_01_mobile_overview.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_01_mobile_overview.png) |
| Mobile (390×844) | 8-Phase Timeline, Phase Tide Bar, Transit Card, Go Deeper CTA | [`sky_02_mobile_tide_and_phases.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_02_mobile_tide_and_phases.png) |
| Mobile (390×844) | Deep Cosmic Sheet — Phase Tab | [`sky_03_deep_sheet_phase.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_03_deep_sheet_phase.png) |
| Mobile (390×844) | Deep Cosmic Sheet — Moon Tab | [`sky_04_deep_sheet_moon.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_04_deep_sheet_moon.png) |
| Mobile (390×844) | Deep Cosmic Sheet — Sign Tab | [`sky_05_deep_sheet_sign.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_05_deep_sheet_sign.png) |
| Mobile (390×844) | Deep Cosmic Sheet — Season Tab | [`sky_06_deep_sheet_season.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_06_deep_sheet_season.png) |
| Mobile (390×844) | Deep Cosmic Sheet — Weave Tab | [`sky_08_deep_sheet_weave.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_08_deep_sheet_weave.png) |
| Desktop (1280×800)| Desktop Overview (Centered 520px Cosmic Canvas) | [`sky_07_desktop_overview.png`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/loops-app/luna-design-context/screenshots/sky_07_desktop_overview.png) |

---

## 1. What the Sky Section Currently Displays

The Sky section presents a layered hierarchy of celestial data:

1. **Header Row**:
   - Monospace formatted time and date (`HH:MM · DAY, MON DD`).
   - `✨ Beta ↗` badge linking to `/beta/` prototype.
   - Profile / Auth trigger: displays `● MENU` (green indicator when authenticated) or `SIGN IN`.
2. **Realistic Photographic Moon Visualization (`MoonFace`)**:
   - 200px photographic Moon disc based on Clementine lunar texture maps (`/moon-texture.jpg`).
   - Dynamic terminator shadow calculated from geometric elongation (waxing vs. waning curvature).
   - Atmospheric glow pulse (`moonGlowPulse`) and surface highlights.
   - Animated tap invitation: `"TAP TO GO DEEPER"` or AI-generated phrase (`tapDeeperInvitation`).
3. **Phase Identity & Ephemeris Meta**:
   - Phase Title: Cormorant Garamond serif heading (e.g. `Waxing Crescent`, `Full Moon`).
   - Stats Line: Illumination percentage (`0% - 100%`), Traditional Lunar Month Name (e.g. `HUNTER'S`, `COLD`), and current Zodiac Sign transit (`MOON IN GEMINI`).
   - Day Counter: `DAY X OF 29.5` (or 30) along with countdown to key cardinal event: `XD TO FULL` (if waxing) or `XD TO NEW` (if waning) or `AT FULL`.
4. **Cosmic Energy Card**:
   - Energetic archetype label (e.g. `SURGE`, `EXPANSION`, `RELEASE`, `ATTUNEMENT`).
   - Phase classification pill: `THRESHOLD` (1.85-day pivotal shift) vs. `FLOW` (5.55-day sustained integration).
   - Dynamic phase guidance quote (e.g. `"The ground is fertile. Take the first outward action."`).
5. **Cosmic Synthesis Line**:
   - Poetic one-line synthesis weaving together the Moon phase and the current Solar Season.
6. **8-Phase Synodic Timeline**:
   - Horizontal progression showing all 8 canonical synodic phases with `MiniMoon` renderings:
     `New Moon` (0) → `Waxing Crescent` (1) → `First Quarter` (2) → `Waxing Gibbous` (3) → `Full Moon` (4) → `Waning Gibbous` (5) → `Last Quarter` (6) → `Waning Crescent` (7).
   - Active phase is highlighted with scale enlargement (1.15x) and full opacity; inactive phases sit at 30% opacity.
7. **Phase Tide Bar**:
   - Real-time gauge tracking progress within the current phase window (elapsed days vs. total phase window).
   - Tide State label: `OPENING` (<20%), `FLOWING` (20-62%), `COMPLETING` (62-88%), `CLOSING` (>88%).
   - Dynamic observational sub-label describing the momentum (e.g. *"Time to move with what is already moving"*).
8. **Synodic Cycle Progress Line**:
   - Slim 3px horizontal bar showing full cycle completion from Day 0 to Day 29.53.
9. **Phase Transition Card (Dynamic Guard)**:
   - Conditionally renders when the next phase boundary is within `< 24 hours` (`lunarData.isApproaching`).
   - Displays closing phase reflection summary, activity summary (echoes and loops created during this phase), arriving phase preview, and CTA button: `◎ OPEN ECHOES — CAPTURE THIS MOMENT`.
10. **Natal Transit Resonance Card (Conditional)**:
    - Renders if user profile has natal chart data (`userProfile.sun_sign`, `moon_sign`, or `rising_sign`) and active transits exist.
    - Shows transit status (`ACTIVE TRANSIT` / `TRANSIT`), aspect type, and tailored reflection invitation.
11. **"GO DEEPER ↓" Action**:
    - Full-width tactile button triggering the `DeepCosmicSheet` bottom drawer.
12. **Waning Contemplation Notice**:
    - Subtle red/amber notice rendered during waning phases: *"The moon is waning. A time for releasing, not starting."*

---

## 2. All Existing Interactions and Controls

| UI Control / Target | Trigger Event | Resulting Action |
| :--- | :--- | :--- |
| **Header `✨ Beta` Link** | Click / Tap | Navigates to `/beta/` isolated prototype URL. |
| **Header `SIGN IN` / `● MENU`** | Click / Tap | If anonymous: calls `onSignIn()`. If authenticated: opens `ProfileMenu` modal. |
| **Photographic Moon (`MoonFace`)** | Click / Tap | Opens `DeepCosmicSheet` with default `'phase'` tab active. |
| **8-Phase Timeline Nodes** | Visual / Tour | Currently highlights the active phase. Serves as visual benchmark. |
| **Phase Transition Card Dismiss `(×)`**| Click / Tap | Sets local state `transitionDismissed = true`, hiding the card for current session. |
| **Phase Transition CTA** | Click / Tap | Calls `onSwitchToEchoes()`, transitioning user directly to the Echoes tab to record thoughts. |
| **Natal Transit Card** | Click / Tap | Opens `DeepCosmicSheet` directly to inspect resonance lore. |
| **`GO DEEPER ↓` Button** | Click / Tap | Opens `DeepCosmicSheet` modal. |
| **Deep Sheet Drag Handle / Backdrop**| Click / Tap | Calls `onClose()`, closing the bottom sheet modal. |
| **Deep Sheet Navigation Tabs** | Click / Tap | Switches active view between: `Phase`, `Moon`, `Sign`, `Season`, `Weave`, `Your Sky`. |

---

## 3. Which Components Implement It

All source files are located in `src/`:

```
src/
├── tabs/
│   └── Sky.jsx                       # Master orchestrator for Sky tab (593 lines)
├── components/
│   ├── MoonFace.jsx                  # Photographic NASA texture moon + MiniMoon SVG (575 lines)
│   ├── DeepCosmicSheet.jsx           # 6-tab modal bottom sheet (1362 lines)
│   ├── PhaseTideBar.jsx              # Sub-phase progress bar & tide tracker (247 lines)
│   ├── PhaseTransitionCard.jsx       # Approaching phase warning & closing summary (424 lines)
│   ├── StarField.jsx                 # Ambient twinkling background canvas/SVG (75 lines)
│   └── ProfileMenu.jsx               # Account, natal chart config, and app settings (2150 lines)
├── lib/
│   ├── lunar.js                      # Jean Meeus astronomical algorithms & phase engine (396 lines)
│   ├── solar.js                      # Solar year, 8 thresholds & season engine (285 lines)
│   ├── natal.js                      # Natal chart aspects & transit resonance engine (241 lines)
│   ├── language.js                   # Generative phrases client & fallback pools (185 lines)
│   └── storage.js                    # Local persistence for phase summaries (450 lines)
└── data/
    ├── phaseContent.js               # Phase energies, symbols, prompts & deep lore (250 lines)
    ├── zodiacMeanings.js             # 12 zodiac archetypes, elements & polarities (320 lines)
    ├── lunarMonths.js                # Traditional 12 named moons lore & folklore (180 lines)
    └── natal.js                      # Default natal coordinates fallback
```

### Component Hierarchy Diagram

```
Sky (tabs/Sky.jsx)
├── StarField (components/StarField.jsx)
├── Header Row [Time, Date, Beta Link, ProfileMenu button]
├── MoonFace [Interactive 200px NASA Texture] (components/MoonFace.jsx)
│   └── Tap Hint [Breathe Animation]
├── Phase Meta [Title, Illumination, Lunar Month, Zodiac Transit, Day of Cycle]
├── Cosmic Energy Card [Energy archetype, Threshold/Flow badge, Type Opening, Guidance]
├── Cosmic Synthesis Line
├── 8-Phase Timeline [8 × MiniMoon]
├── PhaseTideBar (components/PhaseTideBar.jsx) [Gauge, Status, Remaining, SubLabel]
├── Synodic Cycle Progress Bar
├── PhaseTransitionCard (components/PhaseTransitionCard.jsx) [Conditional: <24h]
│   ├── Part 1: Phase Closing Summary + Activity Stats (echoes, loops)
│   ├── Part 2: Arriving Phase Preview + MiniMoon
│   └── CTA: "OPEN ECHOES — CAPTURE THIS MOMENT"
├── Natal Transit Card [Conditional: userProfile.natal_chart]
├── "GO DEEPER ↓" Action Button
├── Waning Notice [Conditional: isWaning]
├── DeepCosmicSheet (components/DeepCosmicSheet.jsx) [Bottom Sheet Drawer]
│   ├── Tab Bar: [Phase | Moon | Sign | Season | Weave | Your Sky]
│   ├── PhaseSection
│   ├── MoonSection
│   ├── SignSection
│   ├── SeasonSection
│   ├── WeaveSection
│   └── YourSkySection
└── ProfileMenu (components/ProfileMenu.jsx) [Slide-over Settings & Natal Config]
```

---

## 4. Where Its Data Comes From

```
[System Clock Date]
        │
        ├──► src/lib/lunar.js (getLunarData) ───────► lunarData prop
        │
        ├──► src/lib/solar.js (getSolarData) ───────► solarData prop
        │
        ├──► src/lib/language.js (getSessionPhrases) ─► phrases prop
        │         ▲
        │         │ (HTTP Cache: 4hr)
        │         └── Supabase Edge Function: generate-phrases
        │
        └──► src/lib/natal.js (getNatalResonance) ──► resonances memo
                  ▲
                  └── Supabase profiles table ──────► userProfile prop
```

1. **`lunarData`**: Calculated client-side deterministically from the current JavaScript `Date()` object using astronomical algorithms in `src/lib/lunar.js`.
2. **`solarData`**: Calculated client-side in `src/lib/solar.js` based on day-of-year and user hemisphere (`'north'` vs `'south'`).
3. **`phrases` & `phrasesLoading`**:
   - Initialized in `src/App.jsx` by invoking `getSessionPhrases(lunarData, solarData)`.
   - Checks `localStorage` cache for key `luna_phrases_${dateStr}_${phaseKey}_${sign}`.
   - If stale/missing, issues HTTPS POST to Supabase edge function:
     `https://eyxvsbqyzeodsjajfqsj.supabase.co/functions/v1/generate-phrases`.
   - On error or offline, seamlessly falls back to static content libraries in `src/data/phaseContent.js` and `src/lib/language.js`.
4. **`userProfile` & `user`**:
   - Managed by Supabase Auth (`supabase.auth.onAuthStateChange`).
   - Profile record queried from PostgreSQL `public.profiles` table containing `sun_sign`, `moon_sign`, and `rising_sign`.
5. **`loops` & `echoes`**:
   - Main application state array passed into `Sky.jsx` and `PhaseTransitionCard.jsx` to tally active loops opened, loops closed, and reflections recorded during the completing phase.

---

## 5. How It Connects to Existing Lunar Calculations

All astronomical calculations in `src/lib/lunar.js` derive from **Jean Meeus' *Astronomical Algorithms***:

### 1. Canonical Astronomical Epoch & Constants
- **Synodic Month Duration**: `SYNODIC = 29.53058867` days.
- **Reference Known New Moon**: Julian Date `2451550.259` (January 6, 2000, 18:14 UTC).
- **J2000.0 Epoch Reference**: Julian Date `2451545.0`.

### 2. Geometric Elongation Angle (`getMoonElongation`)
The core algorithm calculates the true ecliptic longitudes of the Sun ($\lambda_\odot$) and Moon ($\lambda_{\text{Moon}}$) taking into account 5 key orbital perturbation terms:
$$\text{Elongation } D = (\lambda_{\text{Moon}} - \lambda_\odot + 360^\circ) \pmod{360^\circ}$$
- Moon Age: $\text{Age} = \left(\frac{D}{360^\circ}\right) \times 29.53058867$ days.
- Illumination Fraction: $k = \frac{1 - \cos(D)}{2} \times 100\%$.

### 3. Symmetrical Phase Windows & Classification
Luna structures the synodic cycle into **8 symmetrical windows** centered around cardinal events, dividing phases into two fundamental energetic modes:
- **Threshold Phases (1.85 days total, $\pm 0.925$ days)**: Brief, high-leverage turning points (`New Moon`, `First Quarter`, `Full Moon`, `Last Quarter`).
- **Flow Phases (5.55 days total)**: Extended integration periods (`Waxing Crescent`, `Waxing Gibbous`, `Waning Gibbous`, `Waning Crescent`).

### 4. Dynamic Approaching Thresholds
The app warns users before a phase shift occurs:
- Approaching New Moon (new cycle): **24 hours** in advance.
- Approaching Flow Phase: **8 hours** in advance.
- Approaching Threshold Phase: **4 hours** in advance.
- An `isImminent` flag triggers at **$1/4$ of the approach threshold** (e.g. within 1 hour of a threshold shift or 6 hours of a new cycle), switching badge colors to urgent amber (`#FCB450`).

### 5. Pre-Conjunction New Moon Cycle Alignment
When the Moon age reaches $\ge 28.605$ days ($29.53 - 0.925$), the calculation seamlessly advances `dayOfCycle` to **Day 1** and anchors `cycleStart` to the arriving conjunction rather than stranding user intentions at the end of the previous cycle.

---

## 6. Existing API & Backend Dependencies

| Service / Endpoint | Method / Path | Authentication | Purpose | Offline Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase Edge Function** | `POST .../functions/v1/generate-phrases` | Supabase Anon Key | Generates poetic phase guidance, invitations, and deep sheet texts | 100% deterministic local fallback from `src/data/` |
| **Supabase DB (`profiles`)** | `SELECT ... FROM profiles WHERE id = user.id` | User JWT (Bearer) | Fetches user's natal chart signs (`sun_sign`, `moon_sign`, `rising_sign`) | Falls back to default natal baseline in `src/data/natal.js` |
| **NASA Photographic Map** | Static Asset `GET /moon-texture.jpg` | Public asset | Provides Clementine photographic surface for `MoonFace.jsx` | Bundled in Vite `public/` directory |
| **Local Storage** | Browser `localStorage` | Client-only | Caches generated phrases for 4 hours; stores phase summaries via `savePhaseSummary` | Memory-only session state |

---

## 7. Responsive Layouts and Visual States

### 1. Viewport Adaptation
- **Mobile (< 768px)**:
  - Width: 100% full-bleed with `padding: 0 20px` to `0 24px`.
  - Realistic `MoonFace`: Fixed 200px diameter with breathing tap prompt.
  - Scroll container: Single unified vertical scroll with `WebkitOverflowScrolling: 'touch'`.
- **Desktop ($\ge 768px$)**:
  - Centered Cosmic Canvas: Fixed `max-w-[520px]` centered horizontally in the browser viewport.
  - Ambient `StarField`: Expands to cover full browser background width and height (tested cleanly at 1280px).

### 2. Core Visual Styling Tokens
- **Theme Background**: Deep obsidian slate (`--color-bg`, `#0B0E17`).
- **Surface Elevation**: Glassmorphic panels with subtle borders (`--color-input-bg`, `rgba(255, 255, 255, 0.04)` with `border: 1px solid rgba(255, 255, 255, 0.08)`).
- **Accents**:
  - Cosmic Amber (Flow): `#C9A84C` / `rgba(201, 168, 76, 0.5)`.
  - Pivotal Cream (Threshold): `#F5E6C8`.
  - Imminent Warning: `#FCB450` / `#FCC878`.
  - Natal Transit Violet: `#A78BFA` / `rgba(167, 139, 250, 0.2)`.
- **Typography Pairing**:
  - Headings & Poetic Quotes: `'Cormorant Garamond', serif` (font weights 400, 600, italic).
  - Astronomical Data & Metadata: `monospace` (letter spacing `0.08em` to `0.15em`, uppercase).

---

## 8. What Must Be Preserved for Functional Parity

When Astra redesigns the Sky frontend for the isolated beta, the following **must remain intact**:

1. **Exact Astronomical Outputs**:
   - Every value in `lunarData` (age, illumination, synodic day, zodiac sign, degrees, days to full, days to new) must remain identical.
2. **Threshold vs. Flow Architectural Distinction**:
   - The UI must distinguish between 1.85-day Threshold events and 5.55-day Flow windows.
3. **Four Tide States**:
   - `OPENING` (<20%), `FLOWING` (20-62%), `COMPLETING` (62-88%), `CLOSING` (>88%).
4. **Interactive Deep Cosmic Sheet Access**:
   - Tapping the Moon or "GO DEEPER" must open the sheet modal containing all 6 content areas (`Phase`, `Moon`, `Sign`, `Season`, `Weave`, `Your Sky`).
5. **Phase Shift Warning Mechanism**:
   - When `lunarData.isApproaching` is true (<24h), the app must alert the user to the impending transition.
6. **Cross-Tab Deep Linking to Echoes**:
   - The CTA `◎ OPEN ECHOES — CAPTURE THIS MOMENT` on the transition card must trigger `onSwitchToEchoes()` to preserve the contemplative recording workflow.
7. **Phase Summary Persistence**:
   - The transition card's call to `savePhaseSummary(summary)` in `src/lib/storage.js` must be preserved so that end-of-cycle summaries are not broken.
8. **Offline Resilience**:
   - If AI phrase generation is unreachable, all phase content, tide summaries, and season descriptions must seamlessly fall back to local data tables without rendering blank or broken text.

---

## 9. Known Limitations & Unfinished Features

During our source inspection, we identified the following limitations and stubbed features in the existing main branch:

1. **Zodiac Ingress Calculation Stub**:
   - In `src/tabs/Sky.jsx` (line 59), `const _zodiacInfo = getZodiacInfo(lunarData.zodiac.sign);` is imported and assigned with an underscore prefix (`_zodiacInfo`), marked with the comment `// For future zodiac details`. The main Sky card displays the sign name, but the extended zodiac ingress hours are only surfaced inside the Deep Cosmic Sheet's Sign tab.
2. **Simplified Natal Longitude Projection**:
   - In `src/lib/natal.js`, `getCurrentMoonLongitude` computes Moon longitude using a simplified mean linear progression: `(age / SYNODIC) * 360`. While sufficient for transit orb detection ($\pm 8^\circ$), it is a mean approximation rather than a full planetary ephemeris.
3. **Static Solar Threshold Dates**:
   - In `src/lib/solar.js`, the 8 solar threshold dates (Solstices, Equinoxes, cross-quarter days) use fixed calendar day approximations rather than dynamic second-order solar ingress calculations.
4. **Transition Card State is In-Memory Only**:
   - In `src/tabs/Sky.jsx`, `transitionDismissed` is stored in React component state (`useState(false)`). Refreshing the browser resets the dismissal state and re-displays the card if still within the `< 24h` window.

---

## Verification & Parity Checklist for Astra

- [ ] **Visual**: Realistic NASA MoonFace renders with correct terminator shadow for current phase fraction.
- [ ] **Calculations**: Age, illumination percentage, and day of cycle match `src/lib/lunar.js`.
- [ ] **Tide Gauge**: Phase Tide Bar displays current tide stage (`OPENING`, `FLOWING`, `COMPLETING`, `CLOSING`).
- [ ] **Transition Alert**: Phase Transition Card renders when within `< 24h` of next phase.
- [ ] **Sheet Modal**: Deep Cosmic Sheet opens with working navigation across all 6 tabs.
- [ ] **Personalization**: Natal Transit card displays when user profile has natal chart signs.
- [ ] **Echo Navigation**: "Open Echoes" transitions the user directly to the Echoes tab.
- [ ] **Zero Regressions**: No existing calculation functions in `src/lib/lunar.js` or `src/lib/solar.js` are altered.
