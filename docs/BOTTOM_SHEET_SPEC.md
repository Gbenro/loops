# Bottom Sheet Design Specification

**Issue:** LUN-30 — Standardize bottom sheet interaction patterns
**Date:** 2026-03-28
**Author:** UX Designer Agent

---

## Overview

This document specifies a consistent bottom sheet pattern for Luna Loops. Currently, sheets support backdrop-click dismissal only. This spec adds swipe-to-dismiss and standardizes visual elements.

---

## Affected Components

| Component | Location |
|-----------|----------|
| LoopCreationSheet | `src/components/LoopCreationSheet.jsx` |
| CheckInSheet | `src/components/CheckInSheet.jsx` |
| DeepCosmicSheet | `src/components/DeepCosmicSheet.jsx` |
| CreateSheet (Rhythm) | Inline in `src/tabs/Rhythm.jsx` |
| DetailPanel (Loops) | Inline in `src/tabs/Loops.jsx` |
| RhythmDetail | `src/components/RhythmDetail.jsx` |
| Tutorial | `src/components/Tutorial.jsx` |

---

## Design Specifications

### 1. Visual Handle Bar

Every bottom sheet should have a visible drag handle at the top.

```
Dimensions:
- Width: 36px
- Height: 4px
- Border radius: 2px (fully rounded)
- Color: rgba(245, 230, 200, 0.2)
- Margin: 0 auto 20px (centered, 20px below top padding)
```

**Active state (during drag):**
- Color: rgba(245, 230, 200, 0.4)

### 2. Swipe-to-Dismiss Behavior

#### Gesture Recognition
- **Trigger zone:** Entire sheet surface, but handle bar provides visual affordance
- **Direction:** Vertical swipe downward only
- **Minimum drag distance:** 50px to start animation
- **Velocity threshold:** 500px/s triggers dismiss regardless of distance

#### Animation
- **Spring physics:** Use CSS spring or React spring for natural feel
- **Duration:** 200-300ms for dismiss, 150ms for snap-back
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-style spring)

#### Feedback During Drag
```
As user drags down:
1. Sheet follows finger position
2. Backdrop opacity fades proportionally:
   opacity = 0.7 * (1 - dragDistance/sheetHeight)
3. Sheet scales slightly: scale = 1 - (dragDistance * 0.0005)
```

#### Dismiss Thresholds
| Condition | Action |
|-----------|--------|
| Drag > 30% of sheet height | Dismiss |
| Drag velocity > 500px/s downward | Dismiss |
| Drag < 30% AND velocity < 500px/s | Snap back |

### 3. Dismissal Patterns (Multiple Methods)

Users should be able to dismiss via:

1. **Swipe down** — Primary (new)
2. **Backdrop tap** — Secondary (existing)
3. **Handle tap** — Tertiary (new, optional)
4. **Escape key** — Keyboard accessibility (new)

### 4. Entry Animation

Sheets should enter from bottom with spring animation:

```css
@keyframes sheet-enter {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.sheet {
  animation: sheet-enter 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
```

### 5. Exit Animation

```css
@keyframes sheet-exit {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}
```

---

## Implementation Approach

### Option A: Shared Hook (Recommended)

Create a custom hook `useSwipeSheet` that encapsulates:
- Touch event handlers
- Drag state management
- Animation triggers
- Dismiss callbacks

```jsx
// Usage example
function MySheet({ onClose }) {
  const { sheetRef, handleStyle, backdropStyle, handlers } = useSwipeSheet({
    onDismiss: onClose,
    threshold: 0.3,
  });

  return (
    <div style={backdropStyle}>
      <div ref={sheetRef} style={handleStyle} {...handlers}>
        {/* Sheet content */}
      </div>
    </div>
  );
}
```

### Option B: Wrapper Component

Create a `<SwipeableSheet>` component that wraps content:

```jsx
<SwipeableSheet onClose={handleClose}>
  {/* Sheet content */}
</SwipeableSheet>
```

**Recommendation:** Option A (hook) is more flexible and allows gradual adoption without refactoring existing sheet structures.

---

## Accessibility Considerations

1. **Keyboard support:**
   - Escape key dismisses sheet
   - Focus trapped within sheet while open
   - First focusable element receives focus on open

2. **Screen readers:**
   - `role="dialog"`
   - `aria-modal="true"`
   - `aria-labelledby` pointing to sheet title

3. **Reduced motion:**
   - Respect `prefers-reduced-motion`
   - Disable spring animations, use simple opacity fade

```css
@media (prefers-reduced-motion: reduce) {
  .sheet {
    animation: none;
    transition: opacity 0.15s ease;
  }
}
```

---

## Touch Target Requirements

Per UX audit findings, ensure:
- Handle bar tappable area: 44px height (even if visual is 4px)
- Close buttons (if present): 44x44px minimum

```jsx
// Handle bar with expanded touch target
<div
  style={{
    width: '100%',
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
  }}
>
  <div style={{
    width: 36,
    height: 4,
    borderRadius: 2,
    background: 'rgba(245, 230, 200, 0.2)',
  }} />
</div>
```

---

## Interaction States

### Resting
- Handle: `rgba(245, 230, 200, 0.2)`
- Sheet: Full opacity, no transform

### Dragging
- Handle: `rgba(245, 230, 200, 0.4)`
- Sheet: Follows touch, slight scale reduction
- Backdrop: Fading proportionally

### Releasing (Dismissing)
- Sheet animates out downward
- Backdrop fades to transparent
- `onClose` callback fires

### Releasing (Snapping Back)
- Sheet springs back to resting position
- Handle returns to resting color

---

## Testing Checklist

- [ ] Swipe dismiss works on iOS Safari
- [ ] Swipe dismiss works on Android Chrome
- [ ] Backdrop tap still dismisses
- [ ] Escape key dismisses (desktop)
- [ ] Reduced motion disables animations
- [ ] No scroll interference when sheet content is scrollable
- [ ] Handle tap/drag distinguishing works correctly

---

## Priority & Effort

**Priority:** P1 (High)
**Estimated effort:** 4-6 hours for hook + component updates

---

*Document created: 2026-03-28*
*Author: UX Designer Agent*
