import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Mobile Layout & Safe-Area Invariants', () => {
  const rhythmPath = path.resolve(__dirname, '../tabs/Rhythm.jsx');
  const tutorialPath = path.resolve(__dirname, '../components/Tutorial.jsx');

  const rhythmCode = fs.readFileSync(rhythmPath, 'utf8');
  const tutorialCode = fs.readFileSync(tutorialPath, 'utf8');

  describe('Rhythm Tab Layout', () => {
    it('does not contain hardcoded fixed positioning for bottom CTA', () => {
      expect(rhythmCode).not.toContain("bottom: 88");
      expect(rhythmCode).not.toMatch(/rhythm-add-btn[\s\S]*?position:\s*'fixed'/);
    });

    it('uses a flex column container with scrollable content area', () => {
      expect(rhythmCode).toContain("display: 'flex'");
      expect(rhythmCode).toContain("flexDirection: 'column'");
      expect(rhythmCode).toContain("overflowY: 'auto'");
    });

    it('places + New rhythm CTA in an in-flow footer above bottom navigation', () => {
      expect(rhythmCode).toContain("/* Add button footer */");
      expect(rhythmCode).toContain("flexShrink: 0");
      expect(rhythmCode).toContain("borderTop: '1px solid var(--color-border-light)'");
    });

    it('CreateSheet respects safe-area-inset-bottom', () => {
      expect(rhythmCode).toContain("env(safe-area-inset-bottom, 0px)");
    });
  });

  describe('Tutorial / Onboarding Phase Tour Layout', () => {
    it('resets scroll position to top when phaseIdx changes', () => {
      expect(tutorialCode).toContain("cardScrollRef = useRef(null)");
      expect(tutorialCode).toContain("cardScrollRef.current.scrollTo({ top: 0, behavior: 'instant' })");
    });

    it('allocates dynamic safe-area bottom clearance for phase cards', () => {
      expect(tutorialCode).toContain("calc(120px + env(safe-area-inset-bottom, 0px))");
    });

    it('provides frosted/opaque backdrop for floating phase controls bar', () => {
      expect(tutorialCode).toContain("rgba(4,8,16,0.98)");
      expect(tutorialCode).toContain("backdropFilter: 'blur(8px)'");
    });

    it('maintains consistent minimum height for 2-column meta grid items', () => {
      expect(tutorialCode).toContain("minHeight: 64");
    });
  });
});
