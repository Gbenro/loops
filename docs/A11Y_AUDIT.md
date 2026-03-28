# Luna Loops Accessibility Audit Report
**Date:** 2026-03-28
**Tool:** eslint-plugin-jsx-a11y (static analysis)
**Target:** WCAG 2.1 Level AA
**Status:** Audit Complete

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **Serious** | 30 | Click handlers without keyboard support |
| **Serious** | 30 | Non-interactive elements with handlers (needs role) |
| **Moderate** | 7 | autoFocus usage reducing accessibility |
| **Serious** | 4 | Labels not associated with controls |
| **Serious** | 1 | Media without captions |
| **Total** | **72** | Across 13 files |

### Files by Issue Count
| File | Issues |
|------|--------|
| `src/tabs/Loops.jsx` | 21 |
| `src/tabs/Echoes.jsx` | 10 |
| `src/components/ProfileMenu.jsx` | 8 |
| `src/tabs/Rhythm.jsx` | 5 |
| `src/tabs/Sky.jsx` | 2 |
| Others (8 files) | 26 |

## Violations by Category

### 1. Click Events Without Keyboard Support (30 instances) - SERIOUS

**Rule:** `jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions`

Non-interactive elements (`div`, `span`) with `onClick` handlers lack keyboard support, making them inaccessible to:
- Keyboard-only users
- Screen reader users
- Switch device users

**Affected Files:**
| File | Lines |
|------|-------|
| `src/components/AdminDashboard.jsx` | 82, 98 |
| `src/components/CheckInSheet.jsx` | 47, 55 |
| `src/components/DeepCosmicSheet.jsx` | 54, 81 |
| `src/components/LoopCreationSheet.jsx` | 88 |
| `src/components/PhaseLoopSheet.jsx` | 53 |
| `src/components/ProfileMenu.jsx` | 217, 244 |
| `src/components/RhythmDetail.jsx` | 57, 61 |
| `src/components/Tutorial.jsx` | 940 |
| `src/tabs/Echoes.jsx` | 1128, 1333, 1615, 1635 |
| `src/tabs/Loops.jsx` | 1079, 1160, 1253, 1484, 1551, 1616, 1626, 1714, 1784, 1788 |
| `src/tabs/Rhythm.jsx` | 48, 52 |
| `src/tabs/Sky.jsx` | 370 |

**Fix Pattern:**
```jsx
// Before (inaccessible):
<div onClick={handleClick}>...</div>

// After (accessible):
<button onClick={handleClick}>...</button>

// Or if div must be used:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>...</div>
```

### 2. Improper autoFocus Usage (7 issues) - MODERATE

**Rule:** `jsx-a11y/no-autofocus`

Using `autoFocus` can:
- Disorient users with cognitive disabilities
- Skip important content for screen reader users
- Cause unexpected scrolling

**Affected Files:**
| File | Lines |
|------|-------|
| `src/components/LoopCreationSheet.jsx` | 297, 397 |
| `src/components/NewMoonRitual.jsx` | 116 |
| `src/components/PhaseLoopSheet.jsx` | 129 |
| `src/tabs/Echoes.jsx` | 862, 1559 |
| `src/tabs/Rhythm.jsx` | 69 |

**Fix Pattern:**
```jsx
// Use ref + useEffect for controlled focus management
const inputRef = useRef();
useEffect(() => {
  // Focus after render, only when appropriate
  if (shouldFocus) {
    inputRef.current?.focus();
  }
}, [shouldFocus]);

<input ref={inputRef} /> // No autoFocus
```

### 3. Labels Not Associated with Controls (4 issues) - SERIOUS

**Rule:** `jsx-a11y/label-has-associated-control`

Form labels not programmatically linked to their inputs make forms unusable for screen reader users.

**Affected Files:**
| File | Lines |
|------|-------|
| `src/components/ProfileMenu.jsx` | 513, 544, 575, 616 |

**Fix Pattern:**
```jsx
// Before (inaccessible):
<label>Name</label>
<input name="name" />

// After - Option 1 (htmlFor):
<label htmlFor="name-input">Name</label>
<input id="name-input" name="name" />

// After - Option 2 (wrapping):
<label>
  Name
  <input name="name" />
</label>
```

### 4. Media Without Captions (1 issue) - SERIOUS

**Rule:** `jsx-a11y/media-has-caption`

Media elements (audio/video) without captions are inaccessible to deaf and hard-of-hearing users.

**Affected Files:**
| File | Lines |
|------|-------|
| `src/tabs/Loops.jsx` | 1804 |

**Fix Pattern:**
```jsx
<video>
  <track kind="captions" src="captions.vtt" srcLang="en" label="English" />
</video>
```

## Priority Matrix

| Priority | Issues | Impact | Effort |
|----------|--------|--------|--------|
| **P0** | Labels not associated (4) | High | Low |
| **P0** | Media without captions (1) | High | Medium |
| **P1** | Click handlers (30) | High | Medium |
| **P2** | autoFocus removal (7) | Medium | Low |

## Recommended Fix Order

### Phase 1 - Quick Wins (1-2 hours)
1. Fix `ProfileMenu.jsx` label associations (4 fixes)
2. Add captions track to video in `Loops.jsx` (1 fix)
3. Remove/refactor autoFocus usage (7 fixes)

### Phase 2 - Interactive Elements (4-6 hours)
4. Convert clickable divs to buttons or add keyboard handlers
   - Start with high-traffic components: `Loops.jsx`, `Echoes.jsx`
   - Then `Sky.jsx`, `Rhythm.jsx`
   - Finally remaining components

### Phase 3 - Verification
5. Run axe-core runtime audit (requires Playwright deps)
6. Manual keyboard navigation testing
7. Screen reader testing (VoiceOver/NVDA)

## Test Script Ready

A comprehensive Playwright visual testing script has been prepared at:
`/tmp/playwright-test-luna-visual.js`

**Blocked by:** Missing Playwright system dependencies (libnspr4.so)

To unblock, run:
```bash
sudo npx playwright install-deps chromium
```

## Compliance Status

| WCAG Criterion | Status | Notes |
|----------------|--------|-------|
| 1.1.1 Non-text Content | Needs Review | Requires runtime audit |
| 2.1.1 Keyboard | **FAIL** | 46 elements lack keyboard access |
| 2.4.7 Focus Visible | Needs Review | Requires runtime audit |
| 3.3.2 Labels/Instructions | **FAIL** | 4 labels unassociated |
| 4.1.2 Name, Role, Value | **FAIL** | Interactive elements lack proper roles |

---

*Generated by UX Designer Agent*
*Co-Authored-By: Paperclip <noreply@paperclip.ing>*
