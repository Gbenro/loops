# Luna Component References & Design System Inventory

This catalog analyzes all existing UI components in the codebase, assessing their maturity, reusability, and role in the upcoming Astra redesign.

---

## 1. Component Maturity Tiers

| Component | File Path | Status | Reusability / Recommendation |
| :--- | :--- | :--- | :--- |
| **EchoEntry** | `src/components/EchoEntry.jsx` | **New / Prototype** | Highly refined entrance card created by Codex. 48px touch targets, accessibility roles, debounced recording start, responsive 1-column stack. |
| **MoonFace & MiniMoon** | `src/components/MoonFace.jsx` | **Mature** | Core visual anchor. Uses SVG clip-path polygons with `moon-texture.jpg` and dynamic illumination masking. Symmetrical waxing/waning geometry. |
| **StarField** | `src/components/StarField.jsx` | **Mature** | 50-point animated canvas starfield with gentle twinkling opacity. Atmospheric background. |
| **PhaseTideBar** | `src/components/PhaseTideBar.jsx` | **Mature** | Horizontal progress bar displaying phase progress (0–100%) and tide energy state (`opening`, `flowing`, `completing`, `closing`). |
| **Ring** | `src/components/Ring.jsx` | **Mature** | SVG circular completion ring for Loops with animated stroke-dashoffset transitions. |
| **ThemeToggle** | `src/components/ThemeToggle.jsx` | **Mature** | Theme switcher supporting dark, dim, light, sunlight, and auto. Sets CSS variables on `:root`. |
| **DeepCosmicSheet** | `src/components/DeepCosmicSheet.jsx` | **Transitional** | Sliding bottom drawer for deep astronomical data. Rich data display, but markup is heavily inline; ripe for visual streamlining. |
| **ProfileMenu** | `src/components/ProfileMenu.jsx` | **Transitional** | 78KB monolithic drawer containing account, themes, voice, AI model, encryption, and data export. Functions well, but needs UI tab/section cleanup. |
| **LoopCreationSheet** | `src/components/LoopCreationSheet.jsx` | **Mature** | Clean bottom modal for setting loop title, type (Cycle vs Phase), color, subtasks, and notes. |
| **PhaseTransitionCard**| `src/components/PhaseTransitionCard.jsx`| **Mature** | Banner appearing at phase boundaries to announce the shift in lunar energy. Dismissable. |
| **NewMoonRitual** | `src/components/NewMoonRitual.jsx` | **Transitional** | Ceremonial modal for planting intentions at New Moon. Meaningful concept; currently modal-heavy. |
| **RhythmCard & Detail** | `src/components/RhythmCard.jsx` | **Experimental** | Practice tracking cards for Rhythm tab. Functional observation logging. |
| **Tutorial / Onboarding**| `src/components/Tutorial.jsx` | **Legacy** | 71KB step-by-step tour overlay with static PNG screenshots. Useful historical reference, but visually dated. |
| **ErrorBoundary** | `src/components/ErrorBoundary.jsx` | **Mature** | Catches rendering exceptions with fallback UI and retry action. |

---

## 2. Design System Tokens (Extracted from Code)

### Colors & Themes (`src/lib/ThemeContext.jsx`)
Luna defines four semantic themes applied as CSS custom variables to `:root` and reflected in `data-theme`:

1. **Dark** (Default Celestial Night):
   - Background: `#040810` (Deep midnight navy)
   - Surface: `#080d1a` (Dark slate navy)
   - Text: `#ffffff` (High contrast white)
   - Muted Text: `rgba(255, 255, 255, 0.72)`
   - Border: `rgba(245, 230, 200, 0.20)` (Warm celestial gold-tinted)
   - Accent: `#c4b5fd` (Soft lavender/violet)
   - Accent Background: `rgba(167, 139, 250, 0.25)`
   - Input Background: `rgba(245, 230, 200, 0.08)`

2. **Dim** (Soft Night / Low Contrast):
   - Background: `#1a1f2e`
   - Surface: `#222840`
   - Text: `#ffffff`
   - Border: `rgba(240, 230, 208, 0.22)`
   - Accent: `#b4a0ff`

3. **Light** (Paper World / Editorial):
   - Background: `#ffffff`
   - Surface: `#f8f4ee` (Warm parchment cream)
   - Text: `#000000`
   - Border: `rgba(0, 0, 0, 0.20)`
   - Accent: `#4c1d95` (Deep plum/indigo)

4. **Sunlight** (High-Contrast Outdoor Mode):
   - Background: `#ffffff`
   - Surface: `#f1f5f9`
   - Text: `#000000`
   - Border: `rgba(0, 0, 0, 0.40)` (Bold outline)
   - Accent: `#312e81`

5. **Auto**:
   - Resolves dynamically via `window.matchMedia('(prefers-color-scheme: dark)')`.

### Typography
* **Serif Headings & Poetic Prompts**:
  - `font-family: 'Cormorant Garamond', Georgia, serif;`
  - Used for screen titles, moon phase names, philosophical asks, and echo titles.
  - Sizes: 30px (Hero h2), 26px (Section h3), 20px (Card title).
* **Sans-serif Body & Controls**:
  - `font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;`
  - Used for buttons, inputs, transcript text, messages, and settings.
  - Sizes: 16px (Body/inputs), 14px (Secondary/buttons), 12px (Meta).
* **Monospace Metadata & Badges**:
  - `font-family: monospace;`
  - Used for timestamps, uppercase category labels, synchronization status, and astronomical tokens.
  - Letter-spacing: `0.08em` to `0.12em`.
  - Sizes: 10px to 11px.

### Breakpoints & Layout
* **Max Mobile Container**: `460px` to `520px` centered with `margin: 0 auto`.
* **Tablet / Desktop Expand**: `@media (min-width: 768px)` and `@media (min-width: 1024px)`.
* **Minimum Touch Target**: `48px` minimum button height on all interactive controls.
* **Safe Area Insets**: `padding-bottom: env(safe-area-inset-bottom, 0px)` on mobile bottom bar and sheets.
