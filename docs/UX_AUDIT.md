# Luna Loops UX Audit & Improvement Plan

**Issue:** LUN-24
**Date:** 2026-03-28
**Auditor:** UX Designer Agent

---

## Executive Summary

Luna Loops presents a cohesive, atmospheric lunar-cycle-based journaling and intention-setting app. The dark cosmic theme (#040810 background, #f5e6c8 cream text) is well-executed and creates an immersive experience. However, several usability, accessibility, and consistency issues should be addressed to improve the mobile-first experience.

**Overall Assessment:** Good foundation with strong visual identity. Priority improvements focus on accessibility, touch ergonomics, and reducing cognitive load.

---

## 1. Accessibility Issues (Critical)

### 1.1 Insufficient Color Contrast
**Priority:** P0
**Impact:** Users with low vision cannot read text

| Location | Current | Issue |
|----------|---------|-------|
| Stats lines | `rgba(245,230,200,0.35)` on `#040810` | ~2.5:1 contrast (fails WCAG AA 4.5:1) |
| Monospace labels | `rgba(245,230,200,0.3)` | ~2.1:1 contrast (fails WCAG AA) |
| Disabled states | `rgba(245,230,200,0.25)` | ~1.8:1 contrast |
| Phase type badges | `rgba(245,230,200,0.5)` | ~3.2:1 contrast |

**Files affected:**
- `src/tabs/Sky.jsx:175-193` (stats lines)
- `src/tabs/Loops.jsx` (loop metadata)
- `src/tabs/Echoes.jsx` (filter labels, echo stamps)
- `src/tabs/Rhythm.jsx:86,103,242` (scope descriptions, labels)
- `src/components/RhythmReport.jsx:201-215` (stats text)

**Recommendation:**
```css
/* Replace low-opacity text colors: */
--text-secondary: rgba(245,230,200,0.55);  /* was 0.35, now 4.5:1 */
--text-tertiary: rgba(245,230,200,0.45);   /* was 0.3, now 3.8:1 */
--text-disabled: rgba(245,230,200,0.38);   /* was 0.25, now 3.0:1 */
```

**Implementation task for engineers:**
- [ ] Create CSS variables for text opacity levels in `App.jsx` global styles
- [ ] Update all files using `rgba(245,230,200,0.35)` or lower to use semantic variables
- [ ] Audit all text against WCAG AA contrast requirements

---

### 1.2 Missing ARIA Labels
**Priority:** P0
**Impact:** Screen reader users cannot navigate

| Component | Issue |
|-----------|-------|
| Tab navigation | Icons only, no `aria-label` |
| Moon display | No accessible description of phase |
| Voice record button | No `aria-label` for state |
| Phase ring visualization | No accessible alternative |

**Files affected:**
- `src/App.jsx` (tab buttons ~line 800+)
- `src/tabs/Sky.jsx:125-154` (moon display)
- `src/tabs/Echoes.jsx` (voice orb button)
- `src/components/PhaseRing.jsx`

**Implementation task for engineers:**
- [ ] Add `aria-label` to all tab buttons: `aria-label="Sky tab"`, etc.
- [ ] Add `role="img"` and `aria-label` to MoonFace describing current phase
- [ ] Add `aria-pressed` and `aria-label` to recording button
- [ ] Add screen-reader-only text description for PhaseRing

---

### 1.3 Focus Indicators Missing
**Priority:** P1
**Impact:** Keyboard users cannot see focus state

All buttons use `outline: 'none'` without visible focus alternatives.

**Files affected:** Nearly all components with buttons

**Recommendation:**
```css
/* Add to global styles */
:focus-visible {
  outline: 2px solid rgba(245,230,200,0.5);
  outline-offset: 2px;
}
```

**Implementation task for engineers:**
- [ ] Remove `outline: 'none'` from inline styles
- [ ] Add `:focus-visible` styles to global CSS
- [ ] Ensure all interactive elements have visible focus states

---

## 2. Touch Target & Mobile Ergonomics Issues

### 2.1 Undersized Touch Targets
**Priority:** P1
**Impact:** Difficult to tap on mobile devices

| Component | Current Size | Required |
|-----------|-------------|----------|
| Filter mode buttons (Echoes) | ~40px | 44px min |
| Phase timeline emojis | 20px font | 44px target |
| Subtask checkboxes | Variable | 44px min |
| Tag chips | ~24px height | 44px min |

**Files affected:**
- `src/tabs/Echoes.jsx` (filter buttons, tag chips)
- `src/tabs/Sky.jsx:297-315` (phase emoji timeline)
- `src/tabs/Loops.jsx` (subtask toggles)

**Implementation task for engineers:**
- [ ] Increase filter button height to 44px with additional padding
- [ ] Wrap phase emojis in larger tappable containers
- [ ] Add hitSlop or padding to checkbox toggle areas
- [ ] Ensure all tappable elements meet 44x44px minimum

---

### 2.2 Bottom Sheet Close Targets
**Priority:** P2
**Impact:** Difficult to dismiss sheets

Bottom sheets rely on:
1. Tapping backdrop (works well)
2. Swiping down (not implemented)
3. Explicit X button (small target)

**Files affected:**
- `src/components/LoopCreationSheet.jsx`
- `src/components/CheckInSheet.jsx`
- `src/components/DeepCosmicSheet.jsx`
- `src/tabs/Rhythm.jsx:47-127` (CreateSheet)

**Implementation task for engineers:**
- [ ] Add swipe-to-dismiss gesture to all bottom sheets
- [ ] Increase X button hit area to 44x44px
- [ ] Consider adding "Done" button at sheet bottom

---

### 2.3 Fixed Button Positioning
**Priority:** P2
**Impact:** Buttons obscured by keyboard or tab bar

| Location | Issue |
|----------|-------|
| Rhythm "New rhythm" button | `bottom: 88px` may overlap on small screens |
| Echoes voice orb | Fixed positioning conflicts with keyboard |

**Files affected:**
- `src/tabs/Rhythm.jsx:334-356`
- `src/tabs/Echoes.jsx` (voice orb positioning)

**Implementation task for engineers:**
- [ ] Test on small devices (iPhone SE, 375x667)
- [ ] Use `env(safe-area-inset-bottom)` consistently
- [ ] Hide or reposition floating buttons when keyboard is open

---

## 3. Visual Consistency Issues

### 3.1 Inconsistent Border Radius
**Priority:** P2
**Impact:** Visual polish

| Component | Radius |
|-----------|--------|
| Cards | 14px, 12px, 10px (varies) |
| Buttons | 14px, 12px, 10px, 8px (varies) |
| Input fields | 10px |
| Tags | 4px |

**Recommendation:** Standardize to:
```css
--radius-sm: 6px;   /* tags, small elements */
--radius-md: 10px;  /* inputs, small cards */
--radius-lg: 14px;  /* cards, buttons */
--radius-xl: 20px;  /* sheets, modals */
```

**Implementation task for engineers:**
- [ ] Define border-radius CSS variables in App.jsx
- [ ] Update all components to use semantic radius variables

---

### 3.2 Inconsistent Spacing
**Priority:** P2
**Impact:** Visual rhythm feels uneven

| Pattern | Values Found |
|---------|--------------|
| Section gaps | 16px, 18px, 20px, 24px |
| Card padding | 14px, 16px, 18px, 20px |
| Button padding | 9px, 12px, 13px, 14px, 16px |

**Recommendation:** Standardize to 4px grid:
```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 20px;
--space-2xl: 24px;
```

**Implementation task for engineers:**
- [ ] Define spacing CSS variables in App.jsx
- [ ] Audit and update padding/margin values across components

---

### 3.3 Font Size Inconsistency
**Priority:** P3
**Impact:** Minor visual inconsistency

CSS variables are defined (`--font-xs` through `--font-3xl`) but some components use hardcoded values:
- `fontSize: 13` instead of `var(--font-sm)`
- `fontSize: '13px'` (string vs number inconsistency)

**Files affected:**
- `src/components/RhythmReport.jsx:251,256,266,271`
- `src/tabs/Sky.jsx:276-286` (cosmicSynthesis)
- Various inline style definitions

**Implementation task for engineers:**
- [ ] Replace all hardcoded font sizes with CSS variables
- [ ] Ensure consistent use of number vs string for fontSize

---

## 4. Usability Improvements

### 4.1 Empty States Need Better Guidance
**Priority:** P1
**Impact:** New users don't know what to do

| Tab | Current Empty State | Issue |
|-----|---------------------|-------|
| Loops | "No active loops" | No clear CTA |
| Echoes | List is empty | No guidance text |
| Rhythm | Phase-specific message | Good, but could link to tutorial |

**Implementation task for engineers:**
- [ ] Add illustrated empty states with clear CTAs
- [ ] Include "Tap + to create your first loop" guidance
- [ ] Consider auto-showing tutorial for new users

---

### 4.2 Tutorial Discoverability
**Priority:** P1
**Impact:** Users miss educational content

Tutorial is only accessible from Profile Menu. New users may not discover:
- Phase education cards
- Loop vs Echo distinction
- Waxing/waning behavior differences

**Recommendation:**
1. Show tutorial on first launch (already implemented)
2. Add "Learn about phases" link in Sky tab
3. Add contextual hints in empty states

**Implementation task for engineers:**
- [ ] Add "Learn more" link near phase info in Sky tab
- [ ] Link empty states to relevant tutorial sections
- [ ] Track tutorial completion in user profile

---

### 4.3 Cognitive Load in Loops Tab
**Priority:** P2
**Impact:** Complex UI overwhelms users

Issues:
- Phase checkpoints mixed with user subtasks
- Closed loops navigation has multiple modes (all/phase/cycle)
- Too many state combinations visible at once

**Recommendation:**
1. Visually separate phase checkpoints (different style)
2. Default closed loops to collapsed view
3. Progressive disclosure for advanced filters

**Implementation task for engineers:**
- [ ] Style phase checkpoints distinctly from user subtasks
- [ ] Collapse closed loops section by default
- [ ] Hide advanced filter modes behind toggle

---

### 4.4 Voice Recording UX
**Priority:** P2
**Impact:** Users unsure of recording state

Current issues:
- Recording indicator could be more prominent
- No waveform visualization during recording
- No confirmation before discarding recording

**Files affected:**
- `src/tabs/Echoes.jsx:272-397`

**Implementation task for engineers:**
- [ ] Add pulsing animation to recording indicator
- [ ] Consider simple waveform visualization
- [ ] Add "Discard recording?" confirmation

---

## 5. Performance Considerations

### 5.1 Inline Styles Performance
**Priority:** P3
**Impact:** Slight render performance impact

All components use inline styles, creating new objects on each render.

**Recommendation:** For frequently re-rendered components, extract styles to constants or use CSS modules.

**Files to prioritize:**
- `src/components/EchoCard.jsx` (many instances)
- `src/components/LoopCard.jsx` (many instances)
- List items in Echoes/Loops tabs

**Implementation task for engineers:**
- [ ] Extract repeated inline styles to module-level constants
- [ ] Consider CSS modules for complex components
- [ ] Memoize style objects where dynamic

---

## 6. Onboarding Experience

### 6.1 First-Time User Flow
**Priority:** P1
**Impact:** User retention

Current flow:
1. App opens to Sky tab
2. Tutorial auto-shows (good)
3. After tutorial, user is in Sky tab
4. No prompt to create first loop

**Recommendation:**
1. After tutorial, guide user to set cycle intention (if New Moon)
2. If not New Moon, suggest first echo or phase loop
3. Show progress indicator for "getting started" tasks

**Implementation task for engineers:**
- [ ] Add post-tutorial CTA based on current phase
- [ ] Create "Getting Started" checklist (optional)
- [ ] Track first-loop and first-echo milestones

---

### 6.2 Sign-In Timing
**Priority:** P2
**Impact:** Friction before value demonstration

Users are prompted to sign in when trying to record voice echoes. This is appropriate, but consider:
- Allow text echoes without sign-in (local storage)
- Prompt sign-in after demonstrating value

**Implementation task for engineers:**
- [ ] Review which features require sign-in
- [ ] Consider guest mode for text-only features
- [ ] Add sign-in benefits explanation

---

## 7. Prioritized Implementation Roadmap

### Phase 1: Critical Accessibility (1-2 days)
1. [ ] Fix text contrast ratios (1.1)
2. [ ] Add ARIA labels to navigation and key controls (1.2)
3. [ ] Add focus indicators (1.3)

### Phase 2: Touch & Mobile (1-2 days)
4. [ ] Increase touch targets to 44px minimum (2.1)
5. [ ] Add swipe-to-dismiss on bottom sheets (2.2)
6. [ ] Fix fixed-position button overlap (2.3)

### Phase 3: Usability (2-3 days)
7. [ ] Improve empty states with guidance (4.1)
8. [ ] Enhance tutorial discoverability (4.2)
9. [ ] Reduce Loops tab cognitive load (4.3)
10. [ ] Improve voice recording feedback (4.4)

### Phase 4: Polish (1-2 days)
11. [ ] Standardize border-radius values (3.1)
12. [ ] Standardize spacing values (3.2)
13. [ ] Fix font size inconsistencies (3.3)
14. [ ] Improve first-time user flow (6.1)

### Phase 5: Optimization (Optional)
15. [ ] Extract inline styles for performance (5.1)
16. [ ] Review sign-in timing (6.2)

---

## Appendix: Component Inventory

| Component | File | Key Issues |
|-----------|------|------------|
| App Shell | `App.jsx` | Tab ARIA labels needed |
| Sky Tab | `tabs/Sky.jsx` | Contrast, touch targets |
| Loops Tab | `tabs/Loops.jsx` | Cognitive load, subtask toggles |
| Echoes Tab | `tabs/Echoes.jsx` | Filter touch targets, recording UX |
| Rhythm Tab | `tabs/Rhythm.jsx` | Contrast, button positioning |
| RhythmReport | `components/RhythmReport.jsx` | Contrast ratios |
| RhythmCard | `components/RhythmCard.jsx` | Good, minor contrast |
| CheckInSheet | `components/CheckInSheet.jsx` | Swipe dismiss needed |
| LoopCreationSheet | `components/LoopCreationSheet.jsx` | Swipe dismiss needed |
| Tutorial | `components/Tutorial.jsx` | Good coverage, needs discovery |
| ProfileMenu | `components/ProfileMenu.jsx` | Good structure |
| AuthModal | `components/AuthModal.jsx` | Good, clear flow |

---

## 8. Additional Findings from Deep Review

### 8.1 Rhythm Tab Specific Issues
**Priority:** P2
**Impact:** Beta feature usability

| Issue | Location | Recommendation |
|-------|----------|----------------|
| Fixed "New rhythm" button overlaps on small screens | `tabs/Rhythm.jsx:334-356` | Use scroll-aware positioning |
| RhythmDetail sheet lacks swipe-to-dismiss | `components/RhythmDetail.jsx` | Add gesture support |
| IntentionSetter mode buttons too small | `components/RhythmDetail.jsx:78-95` | Increase to 44px touch targets |
| Phase-by-phase intention picker cramped | `components/RhythmDetail.jsx:118-159` | Increase row height |

**Implementation task for engineers:**
- [ ] Add consistent bottom sheet patterns across Rhythm components
- [ ] Increase touch targets in IntentionSetter
- [ ] Review fixed button positioning on small screens

---

### 8.2 Tutorial Component Issues
**Priority:** P2
**Impact:** First-time user experience

| Issue | Recommendation |
|-------|----------------|
| Prev/Next buttons could be larger (44px) | Increase padding on navigation buttons |
| Phase cards have dense information | Consider progressive disclosure |
| No skip option clearly visible | Add "Skip tutorial" in header |
| Mini-moon strip in phases mode has small tap targets | Increase moon button size to 44px |

**Files affected:**
- `src/components/Tutorial.jsx:757-791` (nav buttons)
- `src/components/Tutorial.jsx:873-902` (mini-moon strip)

---

### 8.3 Bottom Sheet Consistency
**Priority:** P2
**Impact:** Interaction patterns

Multiple sheets have inconsistent patterns:

| Sheet | Backdrop Click | Swipe Dismiss | X Button |
|-------|---------------|---------------|----------|
| LoopCreationSheet | Yes | No | No |
| CheckInSheet | Yes | No | No |
| DeepCosmicSheet | Yes | No | No |
| CreateSheet (Rhythm) | Yes | No | No |
| DetailPanel (Loops) | Yes | No | Handle bar |
| Tutorial | Yes | No | X button |

**Recommendation:** Standardize all sheets to support:
1. Backdrop click to close
2. Swipe-down gesture to close
3. Visual handle bar at top
4. Optional X button (44px target)

---

### 8.4 Input Field Consistency
**Priority:** P3
**Impact:** Visual polish

Input field styling varies across components:

| Location | Border Radius | Padding |
|----------|---------------|---------|
| UnlockModal | 8px | 12px 14px |
| Loop creation | 10px | 13px 14px |
| Echo textarea | 0 (none) | 0 |
| Rhythm name input | 10px | 13px 14px |
| Tag custom input | 4px | 4px 8px |

**Recommendation:** Standardize to:
- Border radius: 8px
- Padding: 12px 14px
- Border: `1px solid rgba(245,230,200,0.1)`

---

### 8.5 Loading State Consistency
**Priority:** P3
**Impact:** Perceived performance

Loading indicators vary:

| Tab | Loading State |
|-----|---------------|
| App shell | Logo only |
| Sky | None (immediate) |
| Loops | Symbol "◯" |
| Echoes | Symbol "~" |
| Rhythm | Text "." |

**Recommendation:** Use consistent loading pattern:
- Skeleton loaders for content areas
- Or consistent symbol/animation

---

## 9. CSS Variables Proposal

To implement consistent design tokens, add these CSS variables to `App.jsx`:

```css
:root {
  /* Colors */
  --color-primary: #f5e6c8;
  --color-accent: #A78BFA;
  --color-success: #34D399;
  --color-warning: #FBBF24;
  --color-danger: #FC8181;
  --color-bg: #040810;
  --color-surface: rgba(245, 230, 200, 0.03);

  /* Text opacity levels (WCAG compliant) */
  --text-primary: rgba(245, 230, 200, 0.9);
  --text-secondary: rgba(245, 230, 200, 0.55);  /* 4.5:1 contrast */
  --text-tertiary: rgba(245, 230, 200, 0.45);   /* 3.5:1 contrast */
  --text-disabled: rgba(245, 230, 200, 0.38);   /* 3.0:1 contrast */

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;

  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Touch targets */
  --touch-min: 44px;
}
```

---

## 10. Summary of Engineering Tasks

### Critical (P0) - Do First
1. [ ] Fix text contrast ratios across all tabs
2. [ ] Add ARIA labels to tab navigation
3. [ ] Add ARIA labels to moon display and voice orb
4. [ ] Add `:focus-visible` styles globally

### High Priority (P1) - This Sprint
5. [ ] Increase all touch targets to 44px minimum
6. [ ] Add swipe-to-dismiss to all bottom sheets
7. [ ] Improve empty state guidance with CTAs
8. [ ] Add tutorial discoverability links

### Medium Priority (P2) - Next Sprint
9. [ ] Standardize border-radius values
10. [ ] Standardize spacing values
11. [ ] Fix fixed-button positioning for small screens
12. [ ] Reduce cognitive load in Loops tab

### Lower Priority (P3) - Backlog
13. [ ] Standardize font sizes to CSS variables
14. [ ] Standardize input field styling
15. [ ] Unify loading state patterns
16. [ ] Extract inline styles for performance

---

**Audit Status:** Complete
**Last Updated:** 2026-03-28
**Auditor:** UX Designer Agent (ed6b6a4a-cfbb-4f63-978f-13a8a5ddcea6)

**End of Audit**
