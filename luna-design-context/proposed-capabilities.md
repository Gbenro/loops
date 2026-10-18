# Luna Proposed Capabilities (Design Explorations)

The capabilities below represent **product vision and long-term design explorations**. Astra is invited to explore them visually and conceptually, but must NOT assume backend or database support currently exists.

---

## 1. Visual World & Environmental Progression
* **Concept**: Cycle world → Phase variation → Time-of-day atmosphere → Individual Echo.
* **The Idea**:
  - The lunar cycle (e.g., Hunter's Moon) establishes a shared visual environment (e.g. autumn forest, amber tones, long shadows).
  - Each Phase shifts the physical condition of that same world (e.g., clear skies at Full Moon, dense mist at New Moon).
  - Time of day subtly alters the lighting (dawn mist, afternoon radiance, twilight indigo, midnight stillness).
* **Design Constraint**:
  - Visual themes must be derived strictly from astronomical/environmental context (season, phase, time of day).
  - **NEVER** infer or assign visual mood based on the psychological sentiment of a person's private Echo text.

---

## 2. Living Phase & Cycle Reflections
* **Concept**: An accumulating, breathing synthesis of what has transpired across an ongoing phase or cycle.
* **Current Status**: `generatePhaseSummary()` in `storage.js` aggregates basic numerical counts. A rich narrative "Living Reflection" that evolves as new Echoes enter is **proposed**.
* **Design Exploration**:
  - How does a person see their thoughts gathering over 29 days without feeling like an analytics dashboard?
  - How can synthesis feel like witnessing rather than grading?

---

## 3. Returns Across Time (Longitudinal Resurfacing)
* **Concept**: In an ordinary app, the past is buried under an endless scroll. In Luna, time is cyclical: a full moon in Hunter's cycle calls back to the full moon of Harvest or Sturgeon.
* **Design Exploration**:
  - "On this day in the cycle" instead of "On this day in the calendar year".
  - Resurfacing an Echo from 3 cycles ago when the Moon returns to the same phase and zodiac sign.

---

## 4. Self-Organizing Threads
* **Concept**: Flexible relational trajectories that connect Echoes across cycles without requiring rigid folders or tags.
* **Current Status**: Basic `threads` array and manual `tags` exist. Natural thread emergence is **proposed**.
