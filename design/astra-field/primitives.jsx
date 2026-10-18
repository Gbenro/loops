import { useEffect, useId, useRef } from 'react';

const paths = {
  field: <><path d="M4 7h16M4 12h12M4 17h16" /><circle cx="19" cy="12" r="1" /></>,
  cycle: <><path d="M19.5 7a8 8 0 1 0 .4 9" /><path d="M20 3v5h-5" /></>,
  returns: <><path d="M6 8a7 7 0 1 1-1 7" /><path d="M3 6l3 3 3-3M9 12a3 3 0 1 1 0 4" /></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" /></>,
  write: <><path d="m4 16-1 5 5-1L20 8l-4-4L4 16ZM13 7l4 4" /><path d="M14 21h7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20 14.2A8.5 8.5 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />,
  tune: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="2" fill="var(--surface)" /><circle cx="16" cy="17" r="2" fill="var(--surface)" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  link: <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.9)" /></>,
  check: <path d="m5 12 4 4L20 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  headset: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
};
export function Icon({ name, size = 20, ...rest }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>{paths[name] || paths.field}</svg>;
}
export function Mark() {
  return <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="1.2" /><path d="M20 5c-10 9-10 21 0 30M20 5c16 12 16 18 0 30" stroke="currentColor" strokeWidth="1.2" /><circle cx="20" cy="20" r="3" fill="currentColor" /></svg>;
}
export function Moon({ phase = 2, size = 26, label }) {
  const radius = Math.abs(Math.cos(phase / 8 * Math.PI * 2)) * 17;
  const outerSweep = phase < 4 ? 1 : 0;
  const innerSweep = phase < 2 ? 0 : phase < 4 ? 1 : phase < 6 ? 0 : 1;
  const terminator = radius < .01 ? 'L20 3' : `A${radius} 17 0 0 ${innerSweep} 20 3`;
  return <svg width={size} height={size} viewBox="0 0 40 40" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <circle cx="20" cy="20" r="17" fill="currentColor" opacity=".12" />
    {phase === 4 ? <circle cx="20" cy="20" r="17" fill="currentColor" /> : phase !== 0 && <path d={`M20 3A17 17 0 0 ${outerSweep} 20 37${terminator}Z`} fill="currentColor" />}
    <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".45" />
  </svg>;
}
export function Waveform({ peaks, progress = 0, active = false, compact = false }) {
  const values = peaks || Array.from({ length: compact ? 42 : 110 }, (_, i) => .15 + Math.abs(Math.sin(i * .69) * Math.cos(i * .21)) * .8);
  return <svg className={`voice-wave ${active ? 'is-moving' : ''}`} viewBox={`0 0 ${values.length * 5} 90`} preserveAspectRatio="none" aria-hidden="true">
    {values.map((value, i) => <line key={i} x1={i * 5 + 2} x2={i * 5 + 2} y1={45 - Math.max(3, value * 39)} y2={45 + Math.max(3, value * 39)} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity={i / values.length < progress ? 1 : .42} style={active ? { animationDelay: `${(i % 11) * -0.13}s` } : undefined} />)}
  </svg>;
}
export function Dialog({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; dialog.close(); previous?.focus?.(); };
  }, []);
  const containFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]')].filter(node => node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <dialog ref={ref} className={`study-dialog ${className}`} aria-labelledby={titleId} onKeyDown={containFocus} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) { const box = ref.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header className="dialog-head"><span id={titleId}>{title}</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></header>
    {children}
  </dialog>;
}
