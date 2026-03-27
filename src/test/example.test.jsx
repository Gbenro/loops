import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Example test to verify testing setup works
describe('Test Setup', () => {
  it('renders a simple component', () => {
    const TestComponent = () => <div data-testid="test">Hello Luna Loops</div>;
    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('Hello Luna Loops');
  });

  it('can perform basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect([1, 2, 3]).toContain(2);
  });
});
