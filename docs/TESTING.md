# Testing Standards for Luna Loops

## Demo Mode — Using Test Data to Explore the App

Load realistic sample data to see how the app works across a full lunar cycle. This is useful for demos, onboarding new team members, or QA testing.

### Loading Test Data

**Option A — URL parameter (works anywhere)**
Add `?seed=true` to the URL:
```
http://localhost:5173/?seed=true       # dev
https://v2.lunaloop.app/?seed=true     # production
```
Refresh after the URL cleans itself to see the data.

**Option B — In-app Settings panel**
1. Open Settings (gear icon, top-right)
2. In dev mode the **DEV TOOLS** section is visible at the bottom of the Account tab
3. In production: tap the "Settings" title **5 times** to unlock DEV TOOLS
4. Tap **Load Test Data (3 cycles)** — or **Clear All Data** to reset

**Option C — Browser console**
```js
window.seedData.seedAll()    // generate 3 cycles of data
window.seedData.clearAll()   // wipe everything
```

### What Gets Generated

| Data type   | Count per run | Description |
|-------------|---------------|-------------|
| Loops       | 9–12          | Mix of cycle-long and phase-scoped intentions with subtasks and tags |
| Echoes      | 24–45         | Reflections spread across moon phases with phase-appropriate text |
| Rhythms     | 2–4           | Named practices (e.g. "Morning meditation") with ongoing/cycle scope |
| Instances   | 4–8           | Per-cycle rhythm tracking with whole or per-phase intentions |
| Observations| 14–40         | Daily check-ins at various engagement levels |

### Walkthrough: Exploring Each Tab

After loading test data, here's what to look at in each tab:

#### Sky Tab
- The **moon face** shows the current real-time lunar phase with photorealistic texture
- **Phase name** and **lunar month** displayed below
- Swipe or scroll to see the **phase timeline** showing all 8 phases of the current cycle
- **Zodiac transit** info shows which sign the moon is currently in

#### Loops Tab
- **Active loops** appear at the top — these are in-progress intentions
- Tap a loop to see its **subtasks**, **tags**, and **phase context** (when it was opened)
- **Closed/released loops** from past cycles are visible via the filter toggles
- Try the **filter modes** at the top to switch between active, closed, and all views
- Each loop shows the **moon phase** it was created in and its color tag

#### Echoes Tab
- Reflections are **grouped by moon phase** — notice how the text matches the phase energy
- **New Moon** echoes talk about planting seeds; **Full Moon** echoes talk about illumination
- Use the **filter buttons** to view by phase type (waxing/waning) or tag
- Tap an echo to see its full lunar context (phase, zodiac, day of cycle, illumination %)

#### Rhythm Tab
- **Active rhythms** show named practices with their scope (ongoing or this-cycle)
- Tap a rhythm to see its **cycle instance** — the intention set for this lunar cycle
- The **observation grid** shows daily check-ins across phases
- Engagement levels range from "none" to "ceremonial" — the colors indicate depth of practice
- Past cycle instances show completed observation patterns

### Tips for Demo Presentations

1. **Start fresh**: Use "Clear All Data" first, then load test data for a clean demo
2. **Show the onboarding**: Clear `localStorage` completely (`localStorage.clear()`) to trigger the welcome modal and guided tours
3. **Combine with seed**: Load test data first, then clear only onboarding state to show the tours with populated content:
   ```js
   window.seedData.seedAll()
   localStorage.removeItem('onboardingCompleted')
   localStorage.removeItem('toursCompleted')
   ```
4. **Ceremony prompts**: These appear at New Moon and Waning Crescent phases based on real lunar timing — you may or may not see them depending on the current date

---

This document outlines the testing standards and practices for the Luna Loops application.

## Testing Stack

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, native ES modules support
- **Component Testing**: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **DOM Assertions**: [@testing-library/jest-dom](https://github.com/testing-library/jest-dom)
- **Environment**: jsdom

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test File Organization

### Naming Convention

- Test files should be co-located with their source files
- Use `.test.js` or `.test.jsx` suffix for test files
- Example: `lunar.js` → `lunar.test.js`

### Directory Structure

```
src/
├── lib/
│   ├── lunar.js
│   ├── lunar.test.js
│   ├── solar.js
│   ├── solar.test.js
│   ├── storage.js
│   └── storage.test.js
├── components/
│   ├── MoonFace.jsx
│   └── MoonFace.test.jsx
└── test/
    ├── setup.js        # Global test setup
    └── example.test.jsx # Example/smoke tests
```

## Writing Tests

### Utility/Library Tests

For pure functions in `src/lib/`:

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule.js';

describe('myModule.js', () => {
  describe('myFunction', () => {
    it('does something specific', () => {
      const result = myFunction(input);
      expect(result).toBe(expectedOutput);
    });
  });
});
```

### Component Tests

For React components:

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent.jsx';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Testing Best Practices

1. **Test behavior, not implementation**: Focus on what the component/function does, not how it does it.

2. **Use descriptive test names**: Test names should describe the expected behavior.
   ```javascript
   // Good
   it('returns 0% illumination at new moon')

   // Bad
   it('test illumination')
   ```

3. **Arrange-Act-Assert pattern**:
   ```javascript
   it('calculates moon age correctly', () => {
     // Arrange
     const testDate = new Date(2023, 5, 15);

     // Act
     const age = getMoonAge(testDate);

     // Assert
     expect(age).toBeGreaterThanOrEqual(0);
     expect(age).toBeLessThan(29.53);
   });
   ```

4. **Use appropriate matchers**:
   - `toBe()` for primitives
   - `toEqual()` for objects/arrays
   - `toBeCloseTo()` for floating point numbers
   - `toContain()` for array/string membership
   - `toHaveLength()` for array/string length
   - `toBeInTheDocument()` for DOM elements

5. **Mock external dependencies**:
   ```javascript
   import { vi } from 'vitest';

   // Mock localStorage
   const localStorageMock = {
     getItem: vi.fn(),
     setItem: vi.fn(),
   };
   Object.defineProperty(window, 'localStorage', { value: localStorageMock });
   ```

## Test Categories

### Unit Tests

Test individual functions in isolation:
- `lunar.js`: Moon phase calculations, Julian dates, illumination
- `solar.js`: Season calculations, sun signs, day of year
- `storage.js`: Local storage operations, data serialization

### Component Tests

Test React components:
- Verify rendering with different props
- Test user interactions (clicks, input)
- Verify correct state changes

### Integration Tests

Test component interactions:
- Data flow between components
- Context providers
- API integrations (with mocked responses)

## Coverage Goals

- **Utility functions**: 90%+ coverage
- **Components**: 80%+ coverage
- **Overall**: 80%+ coverage

## Global Test Setup

The test setup file (`src/test/setup.js`) provides:

1. **jest-dom matchers**: Extended DOM assertions
2. **matchMedia mock**: For responsive design testing
3. **localStorage mock**: For storage operations

## Tips for Debugging Tests

1. Use `it.only()` to run a single test
2. Use `describe.only()` to run a single test suite
3. Add `console.log()` for debugging (remove before committing)
4. Use `screen.debug()` to print the DOM
5. Use `--reporter=verbose` for detailed output

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Pushes to `main` and `beta` branches

The CI pipeline is configured in `.github/workflows/ci.yml`.
