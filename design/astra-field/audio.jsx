import { useEffect, useRef, useState } from 'react';
import { Icon, Waveform } from './primitives.jsx';
import { secondsLabel } from './fixtures.js';

export function useSamplePlayer() {
  const audio = useRef(null);
  const current = useRef(null);
  const [active, setActive] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = new Audio();
    audio.current = element;
    element.preload = 'metadata';
    element.ontimeupdate = () => setTime(element.currentTime);
    element.onplay = () => setPlaying(true);
    element.onpause = () => setPlaying(false);
    element.onended = () => { setPlaying(false); setTime(element.duration || 0); };
    element.onerror = () => { setPlaying(false); setError('The sample audio could not load. Try playing it again.'); };
    return () => { element.pause(); element.removeAttribute('src'); element.load(); audio.current = null; };
  }, []);
  const prepare = echo => {
    const element = audio.current;
    if (!element || !echo.audio) return null;
    if (current.current?.id !== echo.id) {
      element.pause();
      element.src = echo.audio;
      element.playbackRate = rate;
      current.current = echo;
      setActive(echo);
      setTime(0);
    }
    setError('');
    return element;
  };
  const toggle = async echo => {
    const alreadyPlaying = current.current?.id === echo.id && !audio.current.paused;
    const element = prepare(echo);
    if (!element) return;
    if (alreadyPlaying) element.pause();
    else {
      if (element.ended) element.currentTime = 0;
      try { await element.play(); } catch { setError('Playback could not start. Try the play button again.'); }
    }
  };
  const seek = (echo, value) => {
    const element = prepare(echo);
    if (!element) return;
    const update = () => { element.currentTime = Math.max(0, Math.min(value, echo.duration)); setTime(element.currentTime); };
    if (element.readyState >= 1) update();
    else element.addEventListener('loadedmetadata', update, { once: true });
  };
  const changeRate = () => {
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1;
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  const stop = () => { audio.current?.pause(); current.current = null; setActive(null); setTime(0); };
  return { active, playing, time, rate, error, toggle, seek, changeRate, stop, pause: () => audio.current?.pause() };
}

export function VoicePlayer({ echo, player }) {
  const selected = player.active?.id === echo.id;
  const playing = selected && player.playing;
  const time = selected ? player.time : 0;
  return <section className="voice-player" aria-label="Original Voice audio player">
    <div className="voice-player-top"><span className="voice-signature"><Icon name="mic" size={15} /> Original Voice</span><span className="muted">Synthetic sample audio</span></div>
    <div className="wave-scrubber">
      <Waveform peaks={echo.peaks} progress={time / echo.duration} />
      <input aria-label="Audio position" aria-valuetext={`${secondsLabel(time)} of ${secondsLabel(echo.duration)}`} type="range" min="0" max={echo.duration} step="0.1" value={time} onChange={event => player.seek(echo, Number(event.target.value))} />
    </div>
    <div className="audio-times"><span>{secondsLabel(time)}</span><span>{secondsLabel(echo.duration)}</span></div>
    <div className="transport">
      <button className="text-button speed" aria-label={`Playback speed ${player.rate} times`} onClick={player.changeRate}>{player.rate}×</button>
      <div className="transport-center">
        <button className="icon-button jump" aria-label="Back 5 seconds" onClick={() => player.seek(echo, time - 5)}><Icon name="cycle" /><span>5</span></button>
        <button className="play-button large" aria-label={playing ? 'Pause sample audio' : 'Play sample audio'} onClick={() => player.toggle(echo)}><Icon name={playing ? 'pause' : 'play'} size={25} /></button>
        <button className="icon-button jump forward" aria-label="Forward 5 seconds" onClick={() => player.seek(echo, time + 5)}><Icon name="cycle" /><span>5</span></button>
      </div>
      <span className="audio-file-note">Voice sample</span>
    </div>
    {player.error && <p role="alert" className="error-message">{player.error}</p>}
  </section>;
}

export function PlayerDock({ player }) {
  if (!player.active) return null;
  return <aside className="player-dock" aria-label="Continuing playback">
    <button className="play-button small" aria-label={player.playing ? 'Pause continuing audio' : 'Resume continuing audio'} onClick={() => player.toggle(player.active)}><Icon name={player.playing ? 'pause' : 'play'} size={18} /></button>
    <a href={`#echo/${player.active.id}`}><span>Original Voice · sample</span><strong>{player.active.label}</strong></a>
    <div className="dock-wave"><Waveform peaks={player.active.peaks.filter((_, i) => i % 3 === 0)} progress={player.time / player.active.duration} /></div>
    <span className="dock-time">{secondsLabel(player.time)}</span>
    <button className="icon-button" aria-label="Close audio player" onClick={player.stop}><Icon name="close" size={17} /></button>
  </aside>;
}
