import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MoonFace, MiniMoon } from './MoonFace.jsx';

describe('MoonFace', () => {
  describe('rendering', () => {
    it('renders a div container with role="img"', () => {
      const { container } = render(<MoonFace />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
    });

    it('respects size prop', () => {
      const { container } = render(<MoonFace size={200} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveStyle({ width: '200px', height: '200px' });
    });

    it('uses default size of 180', () => {
      const { container } = render(<MoonFace />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveStyle({ width: '180px', height: '180px' });
    });
  });

  describe('phase rendering', () => {
    it('renders new moon (phase 0) with minimal illumination', () => {
      const { container } = render(<MoonFace phase={0} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      expect(moonDiv.getAttribute('aria-label')).toContain('New Moon');
    });

    it('renders full moon (phase 0.5) with full illumination', () => {
      const { container } = render(<MoonFace phase={0.5} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      expect(moonDiv.getAttribute('aria-label')).toContain('Full Moon');
    });

    it('renders waxing crescent (phase 0.125)', () => {
      const { container } = render(<MoonFace phase={0.125} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      expect(moonDiv.getAttribute('aria-label')).toContain('Waxing Crescent');
    });

    it('renders first quarter (phase 0.25)', () => {
      const { container } = render(<MoonFace phase={0.25} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      expect(moonDiv.getAttribute('aria-label')).toContain('First Quarter');
    });

    it('renders waning gibbous (phase 0.625)', () => {
      const { container } = render(<MoonFace phase={0.625} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      expect(moonDiv.getAttribute('aria-label')).toContain('Waning Gibbous');
    });

    it('renders last quarter (phase 0.75)', () => {
      const { container } = render(<MoonFace phase={0.75} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      expect(moonDiv.getAttribute('aria-label')).toContain('Last Quarter');
    });
  });

  describe('accessibility', () => {
    it('has role="img" for screen readers', () => {
      const { container } = render(<MoonFace phase={0.5} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveAttribute('role', 'img');
    });

    it('has aria-label describing the phase', () => {
      const { container } = render(<MoonFace phase={0.5} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveAttribute('aria-label');
      expect(moonDiv.getAttribute('aria-label')).toContain('illuminated');
    });

    it('uses custom phaseName when provided', () => {
      const { container } = render(<MoonFace phase={0.25} phaseName="Custom Phase" />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv.getAttribute('aria-label')).toBe('Moon phase: Custom Phase');
    });
  });

  describe('illumination prop', () => {
    it('accepts illumination prop without error', () => {
      const { container } = render(<MoonFace illumination={75} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
    });
  });

  describe('CSS structure', () => {
    it('has moon glow element', () => {
      const { container } = render(<MoonFace phase={0.5} />);
      const glow = container.querySelector('.moon-glow');
      expect(glow).toBeInTheDocument();
    });

    it('has circular shape with border-radius', () => {
      const { container } = render(<MoonFace />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveStyle({ borderRadius: '50%' });
    });
  });
});

describe('MiniMoon', () => {
  describe('rendering', () => {
    it('renders a div container with role="img"', () => {
      const { container } = render(<MiniMoon />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
    });

    it('uses default size of 24', () => {
      const { container } = render(<MiniMoon />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveStyle({ width: '24px', height: '24px' });
    });

    it('respects size prop', () => {
      const { container } = render(<MiniMoon size={32} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveStyle({ width: '32px', height: '32px' });
    });

    it('has circular shape', () => {
      const { container } = render(<MiniMoon />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveStyle({ borderRadius: '50%' });
    });
  });

  describe('phase rendering', () => {
    it('renders full moon with lit portion', () => {
      const { container } = render(<MiniMoon phase={0.5} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
      // Full moon should have child divs for dark base and lit portion
      expect(moonDiv.children.length).toBeGreaterThan(0);
    });

    it('renders partial phase', () => {
      const { container } = render(<MiniMoon phase={0.25} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
    });

    it('renders new moon with minimal elements', () => {
      const { container } = render(<MiniMoon phase={0} />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-label', () => {
      const { container } = render(<MiniMoon />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv).toHaveAttribute('aria-label', 'Moon phase indicator');
    });

    it('uses custom phaseName when provided', () => {
      const { container } = render(<MiniMoon phaseName="Waxing Crescent" />);
      const moonDiv = container.querySelector('[role="img"]');
      expect(moonDiv.getAttribute('aria-label')).toBe('Moon: Waxing Crescent');
    });
  });
});
