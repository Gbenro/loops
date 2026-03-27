# Testing Standards for Luna Loops

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
