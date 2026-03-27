import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LunaLogo } from './LunaLogo.jsx';

describe('LunaLogo', () => {
  describe('icon variant', () => {
    it('renders an SVG element', () => {
      const { container } = render(<LunaLogo variant="icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('uses default width of 100 for icon variant', () => {
      const { container } = render(<LunaLogo variant="icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '100');
      expect(svg).toHaveAttribute('height', '100');
    });

    it('respects custom width prop', () => {
      const { container } = render(<LunaLogo variant="icon" width={150} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '150');
      expect(svg).toHaveAttribute('height', '150');
    });

    it('has correct viewBox for icon variant', () => {
      const { container } = render(<LunaLogo variant="icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '-95 -95 190 190');
    });

    it('does not render text elements', () => {
      const { container } = render(<LunaLogo variant="icon" />);
      const textElements = container.querySelectorAll('text');
      expect(textElements).toHaveLength(0);
    });
  });

  describe('wordmark variant', () => {
    it('renders an SVG element', () => {
      const { container } = render(<LunaLogo variant="wordmark" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('uses default width of 240 for wordmark variant', () => {
      const { container } = render(<LunaLogo variant="wordmark" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '240');
    });

    it('calculates height based on aspect ratio', () => {
      const { container } = render(<LunaLogo variant="wordmark" width={240} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('height', '144');
    });

    it('has correct viewBox for wordmark variant', () => {
      const { container } = render(<LunaLogo variant="wordmark" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '-120 -110 240 144');
    });

    it('renders LUNA LOOPS text', () => {
      const { container } = render(<LunaLogo variant="wordmark" />);
      const textElements = container.querySelectorAll('text');
      expect(textElements).toHaveLength(2);

      const texts = Array.from(textElements).map((el) => el.textContent);
      expect(texts).toContain('LUNA LOOPS');
    });

    it('renders tagline text', () => {
      const { container } = render(<LunaLogo variant="wordmark" />);
      const textElements = container.querySelectorAll('text');
      const tagline = textElements[1];
      expect(tagline.textContent).toBe('entrain with the cycle');
    });
  });

  describe('default variant', () => {
    it('defaults to icon variant when no variant specified', () => {
      const { container } = render(<LunaLogo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '-95 -95 190 190');
    });
  });

  describe('SVG structure', () => {
    it('contains defs with gradients', () => {
      const { container } = render(<LunaLogo />);
      const defs = container.querySelector('defs');
      expect(defs).toBeInTheDocument();
    });

    it('contains linearGradient for ring', () => {
      const { container } = render(<LunaLogo />);
      const linearGradients = container.querySelectorAll('linearGradient');
      expect(linearGradients.length).toBeGreaterThan(0);
    });

    it('contains radialGradient for moon', () => {
      const { container } = render(<LunaLogo />);
      const radialGradients = container.querySelectorAll('radialGradient');
      expect(radialGradients.length).toBeGreaterThan(0);
    });

    it('contains ellipses for orbital rings', () => {
      const { container } = render(<LunaLogo />);
      const ellipses = container.querySelectorAll('ellipse');
      expect(ellipses.length).toBeGreaterThanOrEqual(3);
    });

    it('contains circles for moon and nodes', () => {
      const { container } = render(<LunaLogo />);
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(4);
    });

    it('contains path for crescent shadow', () => {
      const { container } = render(<LunaLogo />);
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe('gradient IDs', () => {
    it('uses unique gradient IDs to avoid conflicts', () => {
      const { container: container1 } = render(<LunaLogo />);
      const { container: container2 } = render(<LunaLogo />);

      const gradients1 = container1.querySelectorAll('[id^="ll-"]');
      const gradients2 = container2.querySelectorAll('[id^="ll-"]');

      // IDs should be different due to random uid
      const ids1 = Array.from(gradients1).map((el) => el.id);
      const ids2 = Array.from(gradients2).map((el) => el.id);

      // At least one ID should differ
      expect(ids1.some((id, i) => id !== ids2[i])).toBe(true);
    });
  });

  describe('styling props', () => {
    it('applies className prop', () => {
      const { container } = render(<LunaLogo className="custom-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom-class');
    });

    it('applies style prop', () => {
      const { container } = render(<LunaLogo style={{ opacity: 0.5 }} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveStyle({ opacity: '0.5' });
    });
  });

  describe('xmlns attribute', () => {
    it('includes xmlns attribute for SVG namespace', () => {
      const { container } = render(<LunaLogo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
    });
  });
});
