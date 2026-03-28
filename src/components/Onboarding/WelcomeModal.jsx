// Luna Loops - Welcome Modal
// First launch modal introducing the app concept

import { useOnboarding } from './OnboardingProvider.jsx';
import { LunaLogo } from '../LunaLogo.jsx';

export function WelcomeModal() {
  const { showWelcome, dismissWelcome, skipOnboarding, startTour } = useOnboarding();

  if (!showWelcome) return null;

  const handleBeginTour = () => {
    dismissWelcome();
    // Start the Sky tour as the first tour
    startTour('sky');
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 8, 16, 0.97)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 20,
        animation: 'welcomeFadeIn 0.4s ease-out',
      }}
    >
      <style>{`
        @keyframes welcomeFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes welcomeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#0a0f18',
          border: '1px solid rgba(245, 230, 200, 0.1)',
          borderRadius: 20,
          padding: '40px 28px 32px',
          textAlign: 'center',
          animation: 'welcomeSlideUp 0.5s ease-out 0.1s both',
        }}
      >
        {/* Luna Logo */}
        <div style={{ marginBottom: 24 }}>
          <LunaLogo variant="icon" width={56} />
        </div>

        {/* Welcome Title */}
        <h1
          id="welcome-title"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26,
            fontWeight: 400,
            color: '#f5e6c8',
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          The moon has been keeping time for you.
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: 'rgba(245, 230, 200, 0.65)',
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          Luna Loops is a way of living with the lunar cycle — not tracking habits or optimizing productivity, but noticing how things move through you as the moon moves through the sky.
        </p>

        <p
          style={{
            fontSize: 13,
            color: 'rgba(245, 230, 200, 0.5)',
            lineHeight: 1.7,
            marginBottom: 32,
          }}
        >
          Four tabs. Eight phases. One cycle at a time.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleBeginTour}
            style={{
              padding: '14px 24px',
              borderRadius: 12,
              background: 'rgba(245, 230, 200, 0.1)',
              border: '1px solid rgba(245, 230, 200, 0.2)',
              color: '#f5e6c8',
              fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Begin
          </button>

          <button
            onClick={handleSkip}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              background: 'transparent',
              border: 'none',
              color: 'rgba(245, 230, 200, 0.4)',
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
        </div>

        {/* Hint */}
        <div
          style={{
            marginTop: 28,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(245, 230, 200, 0.03)',
            border: '1px solid rgba(245, 230, 200, 0.06)',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: '0.15em',
              color: 'rgba(245, 230, 200, 0.3)',
              marginBottom: 6,
            }}
          >
            FIND THIS AGAIN
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(245, 230, 200, 0.4)',
            }}
          >
            Menu → About → How to use
          </div>
        </div>
      </div>
    </div>
  );
}
