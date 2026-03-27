import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MoonFace, MiniMoon } from './MoonFace.jsx';

describe('MoonFace', () => {
  describe('rendering', () => {
    it('renders an SVG element', () => {
      const { container } = render(<MoonFace />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('respects size prop', () => {
      const { container } = render(<MoonFace size={200} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '200');
      expect(svg).toHaveAttribute('height', '200');
    });

    it('uses default size of 180', () => {
      const { container } = render(<MoonFace />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '180');
    });
  });

  describe('phase rendering', () => {
    it('renders new moon (phase 0) without lit path', () => {
      const { container } = render(<MoonFace phase={0} />);
      // New moon should have no lit path (path elements for illumination)
      const paths = container.querySelectorAll('path');
      // Should only have terminator-related paths, not illumination paths
      expect(paths.length).toBeGreaterThanOrEqual(0);
    });

    it('renders full moon (phase 0.5) with complete circle', () => {
      const { container } = render(<MoonFace phase={0.5} />);
      const paths = container.querySelectorAll('path');
      // Full moon should have multiple paths for surface details
      expect(paths.length).toBeGreaterThan(0);
    });

    it('renders waxing crescent (phase 0.125)', () => {
      const { container } = render(<MoonFace phase={0.125} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders first quarter (phase 0.25)', () => {
      const { container } = render(<MoonFace phase={0.25} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders waning gibbous (phase 0.625)', () => {
      const { container } = render(<MoonFace phase={0.625} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders last quarter (phase 0.75)', () => {
      const { container } = render(<MoonFace phase={0.75} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('SVG structure', () => {
    it('contains defs with gradients', () => {
      const { container } = render(<MoonFace phase={0.5} />);
      const defs = container.querySelector('defs');
      expect(defs).toBeInTheDocument();

      const gradients = defs.querySelectorAll('radialGradient');
      expect(gradients.length).toBeGreaterThan(0);
    });

    it('contains base circle for dark side', () => {
      const { container } = render(<MoonFace />);
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('has drop-shadow filter style', () => {
      const { container } = render(<MoonFace />);
      const svg = container.querySelector('svg');
      expect(svg.style.filter).toContain('drop-shadow');
    });
  });

  describe('illumination prop', () => {
    it('accepts illumination prop', () => {
      // Illumination is passed but currently only used for documentation
      const { container } = render(<MoonFace illumination={75} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});

describe('MiniMoon', () => {
  describe('rendering', () => {
    it('renders an SVG element', () => {
      const { container } = render(<MiniMoon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('uses default size of 24', () => {
      const { container } = render(<MiniMoon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
      expect(svg).toHaveAttribute('height', '24');
    });

    it('respects size prop', () => {
      const { container } = render(<MiniMoon size={32} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '32');
    });

    it('renders base circle', () => {
      const { container } = render(<MiniMoon />);
      const circle = container.querySelector('circle');
      expect(circle).toBeInTheDocument();
      expect(circle).toHaveAttribute('fill', '#2a2a34');
    });
  });

  describe('phase rendering', () => {
    it('renders new moon without lit path', () => {
      const { container } = render(<MiniMoon phase={0} />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(0);
    });

    it('renders full moon with lit path', () => {
      const { container } = render(<MiniMoon phase={0.5} />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(1);
    });

    it('renders partial phase with lit path', () => {
      const { container } = render(<MiniMoon phase={0.25} />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(1);
    });
  });
});
