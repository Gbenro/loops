# Loops Tab Cognitive Load Reduction

**Issue:** LUN-32 — Reduce complexity in Loops tab
**Date:** 2026-03-28
**Author:** UX Designer Agent

---

## Problem Statement

The Loops tab serves multiple purposes:
1. Display active cycle loop with phase checkpoints
2. Show active phase loops as actionable items
3. Archive of completed loops with multiple navigation modes

This creates cognitive overload for users, especially newcomers who:
- Don't understand the difference between phase checkpoints and user subtasks
- Are overwhelmed by the closed loops navigation (phase/cycle modes + prev/next)
- See too many state combinations at once

---

## Current Information Architecture

```
Loops Tab
├── Active Cycle Loop (if exists)
│   ├── Title + intention
│   ├── Phase checkpoints (8 items)
│   └── User-added subtasks
│
├── Active Phase Loops
│   └── Cards for each active loop
│
├── Completed Section Header
│   ├── View mode toggle (phase/cycle)
│   └── Navigation (prev/next)
│
└── Completed Loop Cards
    └── Per-phase or per-cycle grouping
```

---

## Design Recommendations

### 1. Visually Differentiate Phase Checkpoints

**Problem:** Phase checkpoints look identical to user subtasks.

**Solution:** Style phase checkpoints distinctly.

#### Current (both look similar)
```
☐ New Moon
☐ First Quarter
☐ My custom task
☐ Full Moon
```

#### Proposed (visual hierarchy)
```
─────────────────────────
◐ WAXING CRESCENT  ✓     ← Phase checkpoint (distinct style)
─────────────────────────
  ☐ My custom task       ← User subtask (indented, different icon)
  ☐ Another task
─────────────────────────
◑ FIRST QUARTER          ← Phase checkpoint (upcoming)
─────────────────────────
```

**Specifications:**
```css
/* Phase checkpoint row */
.phase-checkpoint {
  padding: 10px 14px;
  background: rgba(245, 230, 200, 0.02);
  border-left: 2px solid rgba(167, 139, 250, 0.3);
  font-family: monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(245, 230, 200, 0.5);
}

.phase-checkpoint.completed {
  color: rgba(52, 211, 153, 0.6);
  border-left-color: rgba(52, 211, 153, 0.3);
}

/* User subtask */
.user-subtask {
  padding: 10px 14px 10px 28px; /* Extra indent */
  background: transparent;
  font-family: 'Cormorant Garamond', serif;
  font-size: 15px;
  color: rgba(245, 230, 200, 0.8);
}
```

### 2. Collapse Completed Loops by Default

**Problem:** Completed loops take up screen space and distract from active work.

**Solution:** Default to collapsed state with count indicator.

#### Current
```
COMPLETED
[phase] [cycle]
‹  Waxing Crescent  ›
Card 1
Card 2
Card 3
```

#### Proposed
```
COMPLETED (5)        ▸     ← Collapsed by default, tap to expand
```

**Expanded state:**
```
COMPLETED (5)        ▾
─────────────────────────
Phase view | Cycle view
‹  Waxing Crescent  ›
Card 1
Card 2
```

**Specifications:**
- Default state: collapsed
- Show count of completed loops
- Single tap to expand
- Remember expansion state during session
- Reset to collapsed on tab change

### 3. Hide Advanced Filter Modes Behind Toggle

**Problem:** Phase/cycle toggle adds UI complexity for a feature most users don't need initially.

**Solution:** Progressive disclosure.

#### Proposed Flow
1. Collapsed state shows nothing
2. On expand, show loops from **current cycle** by default
3. Add "Show more options" link to reveal phase/cycle toggle and navigation

```
COMPLETED (5)        ▾
─────────────────────────
Loop from this cycle...
Loop from this cycle...

[↓ Previous cycles]      ← Tap to show advanced navigation
```

### 4. Simplify Phase Checkpoint Interaction

**Problem:** Phase checkpoints are "checked off" but represent external moon phases, not user actions.

**Solution:** Make checkpoints read-only markers, not checkboxes.

#### Current
```
☐ New Moon  ← User can check this (confusing)
```

#### Proposed
```
◐ NEW MOON  ← Visual indicator only, no interaction
   Passed 3 days ago

◑ FIRST QUARTER  ← Current phase (highlighted)
   Now

○ FULL MOON  ← Upcoming (dimmed)
   In 4 days
```

**Specifications:**
- Phase emojis or moon symbols instead of checkboxes
- Timestamp showing relative time
- Current phase highlighted with accent color
- Future phases dimmed
- No tap interaction (informational only)

---

## Implementation Approach

### Phase 1: Quick Wins
1. [ ] Collapse completed section by default
2. [ ] Add visual differentiation to phase checkpoints
3. [ ] Remove checkbox interaction from phase checkpoints

### Phase 2: Progressive Disclosure
4. [ ] Hide phase/cycle toggle behind "More options"
5. [ ] Default completed view to "current cycle" only
6. [ ] Add "Previous cycles" expansion

### Phase 3: Polish
7. [ ] Add relative timestamps to phase checkpoints
8. [ ] Animate expand/collapse transitions
9. [ ] Remember section expansion state

---

## State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  User arrives at Loops tab                                  │
│              │                                              │
│              ▼                                              │
│  ┌──────────────────────┐                                   │
│  │  Active loops shown  │                                   │
│  │  Completed collapsed │ ◄──────── Default state           │
│  └──────────────────────┘                                   │
│              │                                              │
│     User taps "Completed (n)"                               │
│              │                                              │
│              ▼                                              │
│  ┌──────────────────────┐                                   │
│  │ Current cycle loops  │                                   │
│  │ shown (no filters)   │                                   │
│  └──────────────────────┘                                   │
│              │                                              │
│    User taps "Previous cycles"                              │
│              │                                              │
│              ▼                                              │
│  ┌──────────────────────┐                                   │
│  │ Full filter UI with  │                                   │
│  │ phase/cycle toggle   │                                   │
│  │ and navigation       │                                   │
│  └──────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Accessibility Considerations

1. **Keyboard navigation:**
   - Expand/collapse with Enter key
   - Arrow keys for phase/cycle navigation

2. **Screen readers:**
   - Announce count when focused on collapsed section
   - Describe phase checkpoint status clearly

3. **Reduced motion:**
   - Disable expand/collapse animations
   - Use opacity changes only

---

## Effort Estimate

| Task | Effort |
|------|--------|
| Collapse completed by default | 1 hour |
| Phase checkpoint restyling | 2-3 hours |
| Remove checkpoint interactivity | 1 hour |
| Progressive disclosure for filters | 2-3 hours |
| **Total** | **6-8 hours** |

---

## Success Metrics

- **Reduced first-session confusion:** Fewer users abandoning Loops tab
- **Faster task completion:** Time to create first loop decreases
- **Clearer mental model:** User surveys show better understanding of loop types

---

*Document created: 2026-03-28*
*Author: UX Designer Agent*
