import { useEffect, useId, useRef, useState } from 'react';
import './EchoEntry.css';

// Presentation only: the Echoes tab still owns recording, transcription, and saving.
export function EchoEntry({ onRecord, onWrite }) {
  const headingId = useId();
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const beginRecording = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    try {
      await onRecord();
    } catch {
      if (mountedRef.current) setError('Recording could not start. Please try again.');
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  };

  return (
    <section className="echo-entry" aria-labelledby={headingId}>
      <div className="echo-entry__invitation">
        <p className="echo-entry__eyebrow">A moment of your own</p>
        <h2 id={headingId}>You can begin anywhere.</h2>
        <p className="echo-entry__description">A thought, a feeling, an unfinished story.</p>
      </div>
      <div className="echo-entry__actions">
        <button
          type="button"
          className="echo-entry__record"
          data-tutorial="echoes-voice-orb"
          data-tour="echoes-voice-orb"
          onClick={beginRecording}
          disabled={starting}
          aria-busy={starting}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" />
          </svg>
          {starting ? 'Opening microphone…' : 'Begin speaking'}
        </button>
        <button type="button" className="echo-entry__write" onClick={onWrite} disabled={starting}>
          Write instead
        </button>
      </div>
      {error && <p className="echo-entry__error" role="alert">{error}</p>}
      <span className="echo-entry__status" role="status">
        {starting ? 'Waiting for microphone access.' : ''}
      </span>
    </section>
  );
}
