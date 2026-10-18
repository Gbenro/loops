import { useEffect, useRef, useState } from 'react';
import { Dialog, Icon, Waveform } from './primitives.jsx';
import { DEMO_TEXT, PHASES, secondsLabel } from './fixtures.js';

export function Capture({ mode = 'voice', draft, phase, cycle, onClose, onSave }) {
  const [source, setSource] = useState(draft?.source || mode);
  const [stage, setStage] = useState(draft?.stage || (mode === 'write' ? 'writing' : 'permission'));
  const [text, setText] = useState(draft?.text || '');
  const [elapsed, setElapsed] = useState(draft?.elapsed || 0);
  const [tryFailure, setTryFailure] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const saveTimer = useRef(null);
  useEffect(() => {
    if (stage !== 'recording') return;
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const close = () => {
    if (stage === 'saved') return onClose(null);
    if (text.trim() || ['recording', 'paused', 'review', 'failed', 'saving'].includes(stage)) {
      onClose({ source, text, elapsed, stage: ['recording', 'paused'].includes(stage) ? 'paused' : source === 'write' ? 'writing' : 'review' });
    } else onClose(null);
  };
  const finish = () => { setStage('review'); setText(DEMO_TEXT); };
  const save = () => {
    setStage('saving');
    saveTimer.current = setTimeout(() => {
      if (tryFailure) { setStage('failed'); setTryFailure(false); return; }
      const id = onSave({ text, source: source === 'write' ? 'text' : 'voice', phase, cycle: cycle.id });
      setSavedId(id);
      setStage('saved');
    }, 650);
  };
  const toWriting = () => { setSource('write'); setStage('writing'); };
  return <Dialog title={source === 'write' ? 'A written Echo' : 'An Echo, in your own voice'} onClose={close} className="capture-dialog">
    <div className="capture-body">
      <p className="eyebrow">{cycle.name} cycle <span>·</span> {PHASES[phase]}</p>
      {stage === 'permission' && <>
        <div className="capture-symbol"><Icon name="mic" size={30} /></div>
        <h2>A little space<br />for your voice.</h2>
        <p className="capture-intro">Begin wherever you are.<br />There is nothing you need to prepare.</p>
        <p className="simulation-note">Permission and recording are simulated here. Your microphone stays off.</p>
        <button className="primary-button" onClick={() => setStage('recording')}><Icon name="mic" /> Allow in demo</button>
        <button className="text-button" onClick={toWriting}>I’d rather write</button>
        <button className="state-link" onClick={() => setStage('denied')}>Explore permission denied</button>
      </>}
      {stage === 'denied' && <>
        <div className="capture-symbol"><Icon name="mic" size={30} /></div>
        <h2>There’s another<br />way in.</h2>
        <p className="capture-intro">Microphone access wasn’t allowed.<br />You can try again or make a written Echo.</p>
        <p className="simulation-note">Simulated permission state</p>
        <button className="primary-button" onClick={() => setStage('permission')}>Try again</button>
        <button className="text-button" onClick={toWriting}>Write instead</button>
      </>}
      {['recording', 'paused'].includes(stage) && <>
        <h2>{stage === 'paused' ? 'Take your time.' : 'You have the space.'}</h2>
        <p className="capture-intro">A thought can arrive unfinished.</p>
        <div className="capture-wave"><Waveform active={stage === 'recording'} progress={1} /></div>
        <p className="capture-timer"><span className={stage === 'recording' ? 'recording-dot' : 'paused-dot'} />{secondsLabel(elapsed)}</p>
        <div className="capture-controls"><button className="secondary-button" onClick={() => setStage(stage === 'paused' ? 'recording' : 'paused')}><Icon name={stage === 'paused' ? 'play' : 'pause'} />{stage === 'paused' ? 'Resume' : 'Pause'}</button><button className="primary-button" onClick={finish}><Icon name="stop" />Finish</button></div>
        <p className="simulation-note">Simulated recording · no sound is being captured</p>
        <button className="state-link" onClick={close}>Leave and keep a demo draft</button>
      </>}
      {['writing', 'review', 'saving', 'failed'].includes(stage) && <>
        <h2>{source === 'write' ? 'What would you like to keep?' : 'A moment to keep.'}</h2>
        {source !== 'write' && <><div className="review-wave"><Waveform progress={1} /></div><p className="simulation-note">This review uses the study’s synthetic voice sample.</p></>}
        <label className="field-label" htmlFor="capture-text">{source === 'write' ? 'Your words' : 'Sample transcript'}</label>
        <textarea id="capture-text" autoFocus={source === 'write'} value={text} onChange={event => setText(event.target.value)} readOnly={source !== 'write' || stage === 'saving'} placeholder="There’s no right place to begin…" rows="6" />
        {stage === 'failed' && <div className="save-error" role="alert"><strong>That didn’t go through.</strong><p>Your demo draft is still here. You can try again.</p></div>}
        <button className="primary-button" disabled={!text.trim() || stage === 'saving'} onClick={save}><Icon name={stage === 'failed' ? 'cycle' : 'plus'} />{stage === 'saving' ? 'Adding to preview…' : stage === 'failed' ? 'Retry adding Echo' : 'Keep in preview'}</button>
        <p className="simulation-note">This sample Field resets when you reload.</p>
        <details className="state-explorer"><summary>Explore a save state</summary><label><input type="checkbox" checked={tryFailure} onChange={event => setTryFailure(event.target.checked)} /> Simulate a failed save</label></details>
      </>}
      {stage === 'saved' && <>
        <div className="capture-symbol"><Icon name="check" size={32} /></div>
        <h2>Part of your Field.</h2>
        <p className="capture-intro">Your sample Echo is here.<br />You can return to it while this preview is open.</p>
        <a className="primary-button" href={`#echo/${savedId}`} onClick={() => onClose(null)}>Open this Echo <Icon name="arrow" /></a>
        <button className="text-button" onClick={() => onClose(null)}>Return to the Field</button>
        <p className="simulation-note">Demo saved in this tab · resets on reload</p>
      </>}
    </div>
  </Dialog>;
}
