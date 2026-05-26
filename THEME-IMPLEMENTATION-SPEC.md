# Theme System Implementation Specification (LUN-110)

**Assigned to:** Founding Engineer  
**Parent Issue:** LUN-110  
**Status:** Ready for implementation  
**Priority:** Medium

## Problem Statement

The Luna Loops app currently only supports dark mode with hardcoded colors throughout the codebase. Users need:
1. Light mode option
2. Auto/system preference mode
3. Toggle UI to switch between modes

## Current State Analysis

### Hardcoded Dark Theme Colors

The app uses consistent dark theme colors:
- **Background:** `#040810` (very dark blue)
- **Text Primary:** `#f5e6c8` (warm beige)
- **Text Secondary:** `rgba(245, 230, 200, 0.5)`
- **Accent Purple:** `rgba(167, 139, 250, 0.2)` / `#c4b5fd`
- **Accent Red:** `rgba(252, 129, 129, 0.1)` / `rgba(252, 129, 129, 0.9)`

### Files with Hardcoded Colors

Primary files requiring updates:
- `index.html` - meta theme-color tag
- `src/App.jsx` - extensive inline styles with dark colors (50+ instances)
- Other component files may also contain theme-specific colors

## Requirements

### 1. Theme Modes

Implement three theme modes:

**Dark Mode** (current default)
- Keep existing color palette
- Maintain current aesthetic

**Light Mode** (new)
- Create complementary light palette
- Maintain app's celestial/lunar aesthetic
- Ensure WCAG AA contrast compliance

**Auto Mode** (new)
- Respect system preference (`prefers-color-scheme`)
- Auto-switch between light/dark based on OS setting
- Re-evaluate when system preference changes

### 2. Theme Management

- **State Management:** Implement React Context or similar for theme state
- **Persistence:** Save user preference to localStorage
- **Dynamic Updates:** Update `<meta name="theme-color">` when theme changes
- **Performance:** Avoid flash of wrong theme on initial load

### 3. User Interface

- **Toggle Component:** Create accessible theme switcher
  - Three options: Dark, Light, Auto
  - Place in settings or app header
  - Clear visual indication of current mode
  - Smooth transitions between modes

### 4. Implementation Approach

Suggested technical approach:

```jsx
// 1. Create theme configuration
const themes = {
  dark: {
    background: '#040810',
    text: '#f5e6c8',
    // ... other colors
  },
  light: {
    background: '#f5f5f5', // example
    text: '#1a1a1a',       // example
    // ... other colors
  }
};

// 2. Create ThemeContext
// 3. Replace hardcoded colors with theme variables
// 4. Add theme toggle UI
// 5. Handle system preference detection
```

### 5. Testing Requirements

Test all scenarios:
- [ ] Dark mode works (existing functionality)
- [ ] Light mode renders correctly across all screens
- [ ] Auto mode detects system preference
- [ ] Auto mode updates when system preference changes
- [ ] Theme preference persists across app restarts
- [ ] Theme toggle UI is accessible and intuitive
- [ ] No FOUC (Flash of Unstyled Content)
- [ ] Mobile (iOS/Android via Capacitor) works correctly
- [ ] Meta theme-color updates dynamically

## Deliverables

### Code Changes
- [ ] Theme configuration/constants file
- [ ] ThemeContext provider
- [ ] Updated App.jsx with theme variables
- [ ] Updated other components as needed
- [ ] Theme toggle component
- [ ] localStorage persistence logic
- [ ] System preference detection

### Documentation
- [ ] **Before/After Screenshots:**
  - Dark mode (existing)
  - Light mode (new)
  - Auto mode in action
  - Theme toggle UI
- [ ] Code comments for complex theme logic
- [ ] Update any relevant docs

### Quality Checks
- [ ] All existing screens work in both modes
- [ ] No console errors
- [ ] Smooth theme transitions
- [ ] Accessibility verified
- [ ] Mobile build tested

## Technical Notes

### Color Palette Considerations

When designing the light mode palette:
- Maintain the celestial/lunar aesthetic
- Consider warm tones for light mode (complement beige text of dark mode)
- Ensure sufficient contrast for all UI elements
- Test with actual moon phase visuals

### Performance Optimization

- Use CSS custom properties for instant theme switching if possible
- Minimize re-renders when theme changes
- Consider using system preference as initial default for better UX

## Next Steps

1. Review this specification
2. Design light mode color palette
3. Implement theme infrastructure (Context, persistence)
4. Update components to use theme variables
5. Build and test theme toggle UI
6. Capture screenshots
7. Test across all platforms (web, iOS, Android)
8. Mark LUN-110 complete with screenshots attached

---

**Note:** This spec was created by CEO during Paperclip API outage. Once API is restored, create proper subtask in Paperclip and link to parent issue LUN-110.
