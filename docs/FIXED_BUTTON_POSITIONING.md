# Fixed Button Positioning Specification

**Issue:** LUN-33 — Fix floating buttons on small screens and keyboard open
**Date:** 2026-03-28
**Author:** UX Designer Agent

---

## Problem Statement

Fixed-position floating action buttons (FABs) can be obscured or positioned incorrectly in these scenarios:

1. **Small screens:** iPhone SE (375x667) and similar devices have limited vertical space
2. **Keyboard open:** On-screen keyboard pushes content but FABs may overlap
3. **Safe area insets:** Notched phones need proper bottom padding

---

## Affected Components

| Component | Location | Current Positioning |
|-----------|----------|---------------------|
| "New rhythm" button | `src/tabs/Rhythm.jsx:340` | `bottom: 88px` fixed |
| Voice orb (Echoes) | `src/tabs/Echoes.jsx` | In composition area |
| Loop creation FAB | `src/tabs/Loops.jsx` | In-flow (not fixed) |

---

## Design Specifications

### 1. Use Safe Area Insets

All fixed bottom positioning should use CSS environment variables.

```css
/* Current (problematic) */
bottom: 88px;

/* Proposed */
bottom: calc(var(--tab-bar-height, 64px) + env(safe-area-inset-bottom, 0px) + 16px);
```

### 2. Keyboard-Aware Positioning

When the software keyboard is open, floating buttons should either:
- **Hide** if not relevant to the current input
- **Reposition** above the keyboard

#### Detection Strategy

Use the Visual Viewport API for modern browsers:

```javascript
// Hook: useKeyboardHeight
import { useState, useEffect } from 'react';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return keyboardHeight;
}
```

#### Behavior by Component

| Component | When Keyboard Open |
|-----------|-------------------|
| "New rhythm" button | Hide (not needed while typing) |
| Voice orb (Echoes) | Stay visible (recording control) |

### 3. Small Screen Adjustments

For screens under 700px height, reduce FAB size and positioning.

```css
@media (max-height: 700px) {
  .floating-action-button {
    /* Reduce button size */
    padding: 10px 16px;
    font-size: 11px;

    /* Tighter bottom margin */
    bottom: calc(var(--tab-bar-height, 60px) + env(safe-area-inset-bottom, 0px) + 8px);
  }
}

@media (max-height: 600px) {
  /* iPhone SE in landscape or very small devices */
  .floating-action-button {
    /* Hide FAB, show inline button instead */
    display: none;
  }

  .inline-action-button {
    display: block;
  }
}
```

---

## Rhythm Tab Specific Fix

The "New rhythm" button currently uses a hardcoded `bottom: 88px`.

### Current Implementation
```jsx
<button style={{
  position: 'fixed',
  bottom: 88,  // ← Problematic
  right: '50%',
  transform: 'translateX(50%)',
  ...
}}>
```

### Proposed Implementation
```jsx
const keyboardHeight = useKeyboardHeight();
const isKeyboardOpen = keyboardHeight > 100;

// Hide button when keyboard is open
if (isKeyboardOpen) return null;

<button style={{
  position: 'fixed',
  bottom: `calc(var(--tab-bar-height, 64px) + env(safe-area-inset-bottom, 0px) + 16px)`,
  left: '50%',
  transform: 'translateX(-50%)',
  ...
}}>
```

---

## Echoes Tab Voice Orb

The voice orb is part of the composition UI and should stay visible when the keyboard is open (user may want to record while keyboard is up).

### Current Behavior
- Orb positioned within composition area
- Composition area has fixed height

### Recommendation
- Keep current behavior (orb inside composition area)
- Ensure composition area uses `env(safe-area-inset-bottom)` for bottom padding
- Test that orb remains tappable when keyboard is open

---

## CSS Variables to Define

Add these to App.jsx global styles:

```css
:root {
  --tab-bar-height: 64px;
  --fab-offset-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px) + 16px);
  --fab-offset-bottom-compact: calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px) + 8px);
}
```

---

## Testing Checklist

- [ ] Test on iPhone SE (375x667)
- [ ] Test on iPhone 14 Pro (notch + Dynamic Island)
- [ ] Test on Android with navigation bar
- [ ] Test with software keyboard open
- [ ] Test in landscape orientation
- [ ] Verify touch targets remain 44px minimum

---

## Implementation Priority

**Priority:** P2
**Effort:** 2-3 hours

### Steps
1. [ ] Create `useKeyboardHeight` hook
2. [ ] Add CSS variables for tab bar height and offsets
3. [ ] Update Rhythm.jsx FAB positioning
4. [ ] Test on various screen sizes
5. [ ] Add media query fallbacks for very small screens

---

*Document created: 2026-03-28*
*Author: UX Designer Agent*
