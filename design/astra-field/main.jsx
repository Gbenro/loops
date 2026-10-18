import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CYCLES, PHASES, INITIAL_ECHOES, createPreviewEcho, cycleFor, secondsLabel } from './fixtures.js';
import { Dialog, Icon, Mark, Moon, Waveform } from './primitives.jsx';
import { Landscape } from './Landscape.jsx';
import { Capture } from './Capture.jsx';
import { PlayerDock, VoicePlayer, useSamplePlayer } from './audio.jsx';
import './tokens.css';
import './styles.css';

function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || 'field');
  useEffect(() => {
    const onChange = () => { setRoute(location.hash.slice(1) || 'field'); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  useEffect(() => { const frame = requestAnimationFrame(() => document.getElementById('view-title')?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); }, [route]);
  return route.split('/');
}

function EchoRow({ echo, player, showCycle = false }) {
  const playing = player.active?.id === echo.id && player.playing;
  return <article className={`echo-row ${playing ? 'is-playing' : ''}`}>
    <div className="echo-date"><strong>{echo.shortDate.split(' ')[0]}</strong><span>{echo.shortDate.split(' ')[1]}</span></div>
    <div className="echo-row-main">
      <div className="echo-kicker"><span className={echo.source === 'voice' ? 'voice-signature' : ''}>{echo.source === 'voice' ? 'Original Voice' : 'Written Echo'}</span><span className="meta-divider">·</span><span>{showCycle ? `${cycleFor(echo.cycle).name} cycle` : echo.time}</span></div>
      <a className="echo-title" href={`#echo/${echo.id}`}>{echo.label}<Icon name="arrow" size={19} /></a>
      <p className="echo-excerpt">{echo.text}</p>
      <div className="echo-row-context"><Moon phase={echo.phase} size={15} /><a href={`#cycle/${echo.cycle}/${echo.phase}`}>{PHASES[echo.phase]}</a>{echo.connected.length > 0 && <><span>·</span><span>{echo.connected.length} connections</span></>}</div>
    </div>
    {echo.source === 'voice' ? <div className="echo-row-audio"><div className="row-wave"><Waveform peaks={echo.peaks.filter((_, i) => i % 3 === 0)} progress={player.active?.id === echo.id ? player.time / echo.duration : 0} compact /></div><button className="round-button" aria-label={`${playing ? 'Pause' : 'Play'} ${echo.label}`} onClick={() => player.toggle(echo)}><Icon name={playing ? 'pause' : 'play'} size={17} /></button><span>{secondsLabel(echo.duration)}</span></div> : <a className="row-text-icon" href={`#echo/${echo.id}`} aria-label={`Open ${echo.label}`}><Icon name="write" /></a>}
  </article>;
}

function CycleDial({ phase, onPhase, compact = false }) {
  return <div className={`cycle-dial ${compact ? 'compact' : ''}`}>
    <svg viewBox="0 0 300 300" fill="none" aria-hidden="true"><circle cx="150" cy="150" r="110" stroke="var(--line)" /><circle cx="150" cy="150" r="93" stroke="var(--line)" strokeDasharray="1 7" /><path d="M150 40A110 110 0 0 1 260 150" stroke="var(--voice)" strokeWidth="1.5" opacity=".6" /></svg>
    <div className="dial-center"><span className="eyebrow">{compact ? 'This phase' : 'A cycle of return'}</span><Moon phase={phase} size={compact ? 35 : 48} /><strong>{PHASES[phase]}</strong>{!compact && <span>Choose a phase to explore</span>}</div>
    {PHASES.map((name, i) => {
      const angle = i / 8 * Math.PI * 2 - Math.PI / 2;
      return <button key={name} className={`phase-point ${i === phase ? 'selected' : ''}`} style={{ left: `${50 + Math.cos(angle) * 36.667}%`, top: `${50 + Math.sin(angle) * 36.667}%` }} title={name} aria-label={`Explore ${name}`} aria-pressed={i === phase} onClick={() => onPhase(i)}><Moon phase={i} size={compact ? 20 : 25} /></button>;
    })}
  </div>;
}

function ContextAside({ cycle, phase, echoes, onAtmosphere }) {
  const earlier = echoes.find(echo => echo.cycle !== cycle.id && echo.phase === phase);
  return <aside className="context-aside" aria-label="Around this moment">
    <section className="cycle-context">
      <div className="section-label"><span>Around this moment</span><Icon name="cycle" size={17} /></div>
      <a href={`#cycle/${cycle.id}/${phase}`} className="context-cycle-name">{cycle.name} cycle <Icon name="arrow" size={18} /></a>
      <p className="muted">{cycle.month} · sample cycle</p>
      <CycleDial phase={phase} compact onPhase={value => { location.hash = `cycle/${cycle.id}/${value}`; }} />
      <button className="text-button atmosphere-link" onClick={onAtmosphere}><Icon name="tune" size={17} />Explore the atmosphere</button>
    </section>
    {earlier && <section className="return-invitation">
      <div className="section-label"><span>A moment returns</span><span className="concept-badge">Proposed</span></div>
      <p>The same phase.<br /><em>Another moment in your life.</em></p>
      <a href={`#echo/${earlier.id}`}><span>{earlier.label}</span><Icon name="arrow" size={18} /></a>
      <span className="muted">{earlier.shortDate} · {cycleFor(earlier.cycle).name} cycle</span>
    </section>}
  </aside>;
}

function Field({ echoes, player, cycle, phase, time, onCapture, onAtmosphere, draft, onResume }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => echoes.filter(echo => (filter === 'all' || echo.source === filter) && `${echo.label} ${echo.text} ${echo.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [echoes, filter, query]);
  return <>
    <section className="field-hero">
      <Landscape world={cycle.world} phase={phase} time={time} />
      <div className="hero-shade" />
      <div className="hero-copy"><p className="eyebrow">One Field. Many ways of seeing.</p><h1 id="view-title" tabIndex="-1">Your life,<br /><em>still unfolding.</em></h1><p>A place to speak. A place to return.</p><div className="hero-actions"><button className="primary-button" onClick={() => onCapture('voice')}><Icon name="mic" />Record an Echo</button><button className="hero-write" onClick={() => onCapture('write')}><Icon name="write" size={17} />Write instead</button></div></div>
      <a className="hero-context" href={`#cycle/${cycle.id}/${phase}`}><Moon phase={phase} size={30} /><span><strong>{PHASES[phase]}</strong><span>{cycle.name} cycle · sample context</span></span><Icon name="chevron" size={17} /></a>
      <span className="landscape-caption">{cycle.world === 'ridge' ? 'Quiet ridge' : 'Open coast'} <span>—</span> {time}</span>
    </section>
    {draft && <div className="draft-strip" role="status"><Icon name="mic" /><span><strong>A demo draft is still here.</strong> Continue where you paused.</span><button className="text-button" onClick={onResume}>Resume draft <Icon name="arrow" size={16} /></button></div>}
    <div className="field-grid">
      <section className="echo-stream" aria-labelledby="echoes-title">
        <div className="stream-heading"><div><p className="eyebrow">The ongoing thread</p><h2 id="echoes-title">Your Echoes <span>{echoes.length}</span></h2></div><span className="stream-caption">Moments, held in time.</span></div>
        <div className="stream-tools"><div className="segmented" aria-label="Echo format">{[['all', 'All'], ['voice', 'Voice'], ['text', 'Written']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><label className="search-field"><Icon name="search" size={17} /><input aria-label="Search sample Echoes" placeholder="Find an Echo" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" size={15} /></button>}</label></div>
        <div className="echo-list">{shown.length ? shown.map(echo => <EchoRow key={echo.id} echo={echo} player={player} showCycle={echo.cycle !== cycle.id} />) : <div className="empty-state"><Icon name="search" size={28} /><h3>No Echoes in this view.</h3><p>Try a different word, or return to all moments.</p><button className="secondary-button" onClick={() => { setFilter('all'); setQuery(''); }}>Show all Echoes</button></div>}</div>
        <p className="stream-end"><span />Every return begins somewhere.<span /></p>
      </section>
      <ContextAside {...{ cycle, phase, echoes, onAtmosphere }} />
    </div>
  </>;
}

function EchoDetail({ echo, echoes, player, reflections, onReflect, onLoop }) {
  const cycle = cycleFor(echo.cycle);
  const additions = reflections[echo.id] || [];
  const [showTranscript, setShowTranscript] = useState(true);
  return <div className="detail-view">
    <a className="back-link" href="#field"><Icon name="back" size={18} />Back to your Field</a>
    <div className="detail-grid">
      <article className="detail-main">
        <p className="eyebrow">{echo.source === 'voice' ? 'An Echo, in your own voice' : 'An Echo, in your own words'}</p>
        <h1 id="view-title" tabIndex="-1">{echo.label}</h1>
        <p className="detail-timestamp">{echo.date}<span>·</span>{echo.time}</p>
        {echo.source === 'voice' && <VoicePlayer echo={echo} player={player} />}
        <section className="transcript-section"><div className="section-label"><h2>{echo.source === 'voice' ? 'Your words, as they arrived' : 'Original words'}</h2>{echo.source === 'voice' && <button className="text-button" aria-expanded={showTranscript} onClick={() => setShowTranscript(value => !value)}>{showTranscript ? 'Hide transcript' : 'Show transcript'}</button>}</div>{(echo.source === 'text' || showTranscript) && <blockquote>{echo.text}</blockquote>}</section>
        <div className="echo-tags">{echo.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <section className="reflection-section"><div className="section-label"><h2>From where you are now</h2><span>{additions.length + (echo.reflection ? 1 : 0)} reflections</span></div><p className="reflection-invitation">The Echo stays as it was. What do you notice on returning?</p>{echo.reflection && <div className="personal-reflection"><span>Your reflection · {echo.reflectionDate}</span><p>{echo.reflection}</p></div>}{additions.map((reflection, i) => <div className="personal-reflection" key={i}><span>Your reflection · just added in this preview</span><p>{reflection}</p></div>)}<button className="secondary-button" onClick={() => onReflect(echo)}><Icon name="plus" size={18} />Add a reflection</button><p className="small-note">Proposed linked reflection composer · kept only in this preview</p></section>
      </article>
      <aside className="detail-context" aria-label="Echo context and connections">
        <div className="detail-landscape"><Landscape world={cycle.world} phase={echo.phase} time={echo.time.includes('am') ? 'dawn' : 'dusk'} /><Moon phase={echo.phase} size={42} /><span>{cycle.world === 'ridge' ? 'Quiet ridge' : 'Open coast'}</span></div>
        <div className="context-block"><p className="eyebrow">The moment around it</p><a className="context-cycle-name" href={`#cycle/${cycle.id}/${echo.phase}`}>{PHASES[echo.phase]}<Icon name="arrow" size={18} /></a><p>{cycle.name} cycle · Day {echo.day}</p><a className="subtle-link" href={`#cycle/${cycle.id}/all`}>See this cycle</a></div>
        <div className="context-block"><div className="section-label"><h2>Connected moments</h2><Icon name="link" size={16} /></div><p className="small-note">Explicit links in the sample Field</p>{echo.connected.length ? echo.connected.map(id => { const item = echoes.find(e => e.id === id); return item && <a className="connected-echo" key={id} href={`#echo/${id}`}><Moon phase={item.phase} size={21} /><span><strong>{item.label}</strong><span>{item.shortDate} · {cycleFor(item.cycle).name}</span></span><Icon name="chevron" size={16} /></a>; }) : <p className="muted">This moment has room to stand on its own.</p>}</div>
        {echo.loop && <div className="context-block"><p className="eyebrow">A Loop it belongs to</p><button className="loop-link" onClick={() => onLoop(echo.loop)}><Icon name="cycle" /><span>{echo.loop}</span><Icon name="arrow" size={17} /></button></div>}
        <a className="return-link" href={`#returns/${echo.phase}`}><Icon name="returns" /><span>Meet this phase again<small>Explore Returns · proposed</small></span><Icon name="arrow" size={17} /></a>
      </aside>
    </div>
  </div>;
}

function CycleView({ echoes, player, cycle, phase, selected, time, onCycle, onPhase, onAtmosphere }) {
  const matching = echoes.filter(echo => echo.cycle === cycle.id && (selected === 'all' || echo.phase === phase));
  return <div className="cycle-view">
    <div className="view-heading"><div><p className="eyebrow">A circle you can return to</p><h1 id="view-title" tabIndex="-1">{cycle.name} cycle</h1><p>{cycle.month} <span>·</span> {cycle.range} <span className="small-note">· sample dates</span></p></div><label className="cycle-select"><span>Explore a cycle</span><select value={cycle.id} onChange={event => onCycle(event.target.value)}>{CYCLES.map(item => <option value={item.id} key={item.id}>{item.name} · {item.month.split(' ')[0]}</option>)}</select></label></div>
    <section className="cycle-observatory"><Landscape world={cycle.world} phase={phase} time={time} /><div className="observatory-copy"><p className="eyebrow">One world, changing light</p><h2>{PHASES[phase]}</h2><p>{cycle.description}<br />A place in time for what you choose to keep.</p><button className="glassless-button" onClick={onAtmosphere}><Icon name="tune" size={18} />Change the light</button><span className="small-note">Atmosphere concept · independent of Echo content</span></div><CycleDial phase={phase} onPhase={onPhase} /></section>
    <div className="phase-strip" aria-label="Phase navigation">{PHASES.map((name, i) => <button key={name} className={selected !== 'all' && phase === i ? 'selected' : ''} aria-pressed={selected !== 'all' && phase === i} onClick={() => onPhase(i)}><Moon phase={i} size={25} /><span>{name}</span><span className="phase-count">{echoes.filter(echo => echo.cycle === cycle.id && echo.phase === i).length} Echoes</span></button>)}</div>
    <div className="cycle-lower"><section><div className="section-label"><h2>{selected === 'all' ? 'Echoes in this cycle' : `Echoes in ${PHASES[phase]}`}</h2><button className="text-button" onClick={() => { location.hash = `cycle/${cycle.id}/all`; }}>Whole cycle</button></div>{matching.length ? matching.map(echo => <EchoRow key={echo.id} echo={echo} player={player} />) : <div className="empty-state"><Moon phase={phase} size={38} /><h3>Space, for now.</h3><p>No sample Echoes sit in this phase.<br />Try First Quarter or explore the whole cycle.</p></div>}</section><aside className="living-note"><div className="section-label"><span>Living cycle reflection</span><span className="concept-badge">Proposed</span></div><h3>Room for a<br /><em>larger view.</em></h3><p>A future reflection could gather moments from this cycle, with every observation linked back to your words.</p><p className="small-note">A design placeholder. No synthesis has been generated.</p></aside></div>
  </div>;
}

function Returns({ echoes, player, phase, onReflect }) {
  const [mode, setMode] = useState('phase');
  const [selectedPhase, setSelectedPhase] = useState(phase);
  const shown = echoes.filter(echo => mode === 'phase' ? echo.phase === selectedPhase : echo.connected.length > 0);
  return <div className="returns-view"><div className="returns-intro"><div><p className="eyebrow">The spiral of return <span className="concept-badge">Proposed experience</span></p><h1 id="view-title" tabIndex="-1">An earlier moment.<br /><em>A different vantage point.</em></h1><p>Return to what you chose to keep.<br />Let the relationship between then and now remain yours.</p></div><svg className="return-orbits" viewBox="0 0 300 260" fill="none" aria-hidden="true"><ellipse cx="150" cy="135" rx="120" ry="95" stroke="var(--line)" /><ellipse cx="150" cy="135" rx="85" ry="64" stroke="var(--line)" /><ellipse cx="150" cy="135" rx="48" ry="34" stroke="var(--line)" /><path d="M150 40Q278 53 258 149T114 194 101 109 182 107 175 155 143 141" stroke="var(--voice)" strokeWidth="1.2" opacity=".7" /><circle cx="150" cy="40" r="5" fill="var(--voice)" /><circle cx="101" cy="109" r="4" fill="var(--voice)" /><circle cx="143" cy="141" r="3" fill="var(--voice)" /></svg></div>
    <div className="returns-tools"><div className="segmented" aria-label="Return lens"><button aria-pressed={mode === 'phase'} onClick={() => setMode('phase')}>Same phase</button><button aria-pressed={mode === 'links'} onClick={() => setMode('links')}>Connected moments</button></div>{mode === 'phase' && <label className="return-phase-select"><span className="sr-only">Phase to revisit</span><select value={selectedPhase} onChange={event => setSelectedPhase(Number(event.target.value))}>{PHASES.map((name, i) => <option value={i} key={name}>{name}</option>)}</select></label>}</div>
    <p className="returns-explanation">{mode === 'phase' ? `Sample Echoes from ${PHASES[selectedPhase]}, across different cycles.` : 'Connections supplied in this sample Field. No similarity or sentiment analysis.'}</p>
    <div className="return-timeline">{CYCLES.map(cycle => { const items = shown.filter(echo => echo.cycle === cycle.id); return items.length > 0 && <section key={cycle.id}><div className="return-cycle-stamp"><span className="timeline-dot" /><div><h2>{cycle.name}</h2><span>{cycle.month}</span></div><a href={`#cycle/${cycle.id}/all`} aria-label={`Explore ${cycle.name} cycle`}><Icon name="arrow" size={18} /></a></div><div>{items.map(echo => <EchoRow key={echo.id} echo={echo} player={player} />)}</div></section>; })}{!shown.length && <div className="empty-state"><h3>No sample returns in this phase.</h3><p>First Quarter has three moments to explore.</p></div>}</div>
    {shown.length > 0 && <div className="return-reflect"><p>What do you notice<br /><em>from here?</em></p><button className="secondary-button" onClick={() => onReflect(shown[0])}><Icon name="write" size={18} />Reflect on this return</button></div>}
  </div>;
}

function ReflectionDialog({ echo, onClose, onSave }) {
  const [text, setText] = useState('');
  return <Dialog title="A reflection on returning" onClose={onClose} className="reflection-dialog"><div className="dialog-content"><p className="eyebrow">Connected to “{echo.label}”</p><h2>What do you notice now?</h2><p className="muted">A new layer, with its own moment in time.</p><label className="field-label" htmlFor="reflection-text">Your reflection</label><textarea id="reflection-text" autoFocus rows="6" value={text} onChange={event => setText(event.target.value)} placeholder="Coming back to this, I notice…" /><button className="primary-button" disabled={!text.trim()} onClick={() => onSave(text.trim())}>Keep reflection in preview<Icon name="arrow" size={18} /></button><p className="simulation-note">Proposed composer · your words stay in this tab until reload.</p></div></Dialog>;
}

function App() {
  const [view, item, lens] = useRoute();
  const [theme, setTheme] = useState('dark');
  const [time, setTime] = useState('dusk');
  const [cycleId, setCycleId] = useState('hunter');
  const [phase, setPhase] = useState(2);
  const [echoes, setEchoes] = useState(INITIAL_ECHOES);
  const [reflections, setReflections] = useState({});
  const [overlay, setOverlay] = useState(null);
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState('');
  const player = useSamplePlayer();
  const cycle = cycleFor(view === 'cycle' && item ? item : cycleId);
  const contextPhase = view === 'cycle' && lens !== 'all' && lens !== undefined ? Math.max(0, Math.min(7, Number(lens) || 0)) : phase;
  const selectedEcho = echoes.find(echo => echo.id === item);
  useEffect(() => { document.documentElement.dataset.appearance = theme; }, [theme]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  const capture = mode => { player.pause(); setOverlay({ type: 'capture', mode }); };
  const reflect = echo => setOverlay({ type: 'reflection', echo });
  const saveEcho = data => { const echo = createPreviewEcho(data); setEchoes(current => [echo, ...current]); setDraft(null); return echo.id; };
  const selectCycle = id => { setCycleId(id); if (view === 'cycle') location.hash = `cycle/${id}/all`; };
  const selectPhase = value => { setPhase(value); location.hash = `cycle/${cycle.id}/${value}`; };
  const nav = [{ id: 'field', label: 'Your Field', icon: 'field' }, { id: 'cycle', label: 'Cycles', icon: 'cycle' }, { id: 'returns', label: 'Returns', icon: 'returns' }];
  return <div className="astra-app">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('view-title')?.focus(); }}>Skip to content</a>
    <aside className="sidebar"><a className="brand" href="#field" aria-label="Luna, your Field"><Mark /><span>luna</span></a><p className="brand-note">A field for your life.</p><nav aria-label="Main navigation">{nav.map(link => <a key={link.id} className={view === link.id || (view === 'echo' && link.id === 'field') ? 'active' : ''} aria-current={view === link.id ? 'page' : undefined} href={`#${link.id}${link.id === 'cycle' ? `/${cycleId}/all` : ''}`}><Icon name={link.icon} /><span>{link.label}</span>{link.id === 'returns' && <span className="nav-proposal" aria-label="Proposed experience" />}</a>)}</nav><button className="sidebar-record" onClick={() => capture('voice')}><Icon name="mic" size={18} />Make an Echo<Icon name="plus" size={16} /></button><div className="sidebar-foot"><p>LINE <span>→</span> CIRCLE <span>→</span> SPIRAL</p><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</button><button onClick={() => setOverlay({ type: 'about' })}><Icon name="info" size={18} />About this study</button><span className="study-version">QUIET HORIZON / 01</span></div></aside>
    <div className="main-shell"><header className="topbar"><a className="mobile-brand brand" href="#field" aria-label="Luna, your Field"><Mark /><span>luna</span></a><span className="topbar-location">{view === 'echo' ? 'Your Field / Echo' : view === 'cycle' ? 'Your Field / Cycles' : view === 'returns' ? 'Your Field / Returns' : 'Your personal Field'}</span><div className="topbar-tools"><button className="study-chip" onClick={() => setOverlay({ type: 'about' })}><span />Design study · sample Field</button><button className="icon-button" aria-label="Explore atmosphere" title="Explore atmosphere" onClick={() => setOverlay({ type: 'atmosphere' })}><Icon name="tune" /></button><button className="icon-button mobile-theme" aria-label={theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button></div></header>
      <main id="main-content">
        {view === 'echo' && selectedEcho ? (
          <EchoDetail key={selectedEcho.id} echo={selectedEcho} {...{ echoes, player, reflections }} onReflect={reflect} onLoop={title => setOverlay({ type: 'loop', title })} />
        ) : view === 'cycle' ? (
          <CycleView {...{ echoes, player, cycle, time }} phase={contextPhase} selected={lens || 'all'} onCycle={selectCycle} onPhase={selectPhase} onAtmosphere={() => setOverlay({ type: 'atmosphere' })} />
        ) : view === 'returns' ? (
          <Returns key={item || 'current'} {...{ echoes, player }} phase={item === undefined ? phase : Math.max(0, Math.min(7, Number(item) || 0))} onReflect={reflect} />
        ) : (
          <Field {...{ echoes, player, cycle, phase, time, draft }} onCapture={capture} onAtmosphere={() => setOverlay({ type: 'atmosphere' })} onResume={() => setOverlay({ type: 'capture', mode: draft.source, resume: true })} />
        )}
      </main>
      <footer className="page-footer"><span>luna <span>·</span> Quiet Horizon</span><span>Independent design exploration · synthetic content</span><button className="text-button" onClick={() => setOverlay({ type: 'about' })}>Study notes <Icon name="arrow" size={15} /></button></footer>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#field" aria-current={view === 'field' || view === 'echo' ? 'page' : undefined}><Icon name="field" /><span>Field</span></a><a href={`#cycle/${cycleId}/all`} aria-current={view === 'cycle' ? 'page' : undefined}><Icon name="cycle" /><span>Cycle</span></a><button className="mobile-record" onClick={() => capture('voice')}><Icon name="mic" /><span>Record</span></button><a href="#returns" aria-current={view === 'returns' ? 'page' : undefined}><Icon name="returns" /><span>Returns</span></a></nav>
    {player.active && !(view === 'echo' && player.active.id === item) && <PlayerDock player={player} />}
    {toast && <div className="toast" role="status"><Icon name="check" size={18} />{toast}</div>}
    {overlay?.type === 'capture' && <Capture mode={overlay.mode} draft={overlay.resume ? draft : null} phase={contextPhase} cycle={cycle} onClose={value => { if (value) setDraft(value); setOverlay(null); }} onSave={saveEcho} />}
    {overlay?.type === 'reflection' && <ReflectionDialog echo={overlay.echo} onClose={() => setOverlay(null)} onSave={text => { const id = overlay.echo.id; setReflections(current => ({ ...current, [id]: [...(current[id] || []), text] })); setOverlay(null); setToast('Reflection added to this preview.'); location.hash = `echo/${id}`; }} />}
    {overlay?.type === 'atmosphere' && <Dialog title="Explore the atmosphere" onClose={() => setOverlay(null)} className="atmosphere-dialog"><div className="atmosphere-preview"><Landscape world={cycle.world} phase={contextPhase} time={time} /><Moon phase={contextPhase} size={40} /></div><div className="dialog-content"><p className="eyebrow">Cycle → Phase → Time of day</p><h2>The same world.<br /><em>Another light.</em></h2><p className="muted">Try the study’s shared environments. These choices never use the words inside an Echo.</p><label className="field-label" htmlFor="world-select">Cycle world · proposed mapping</label><select id="world-select" value={cycle.id} onChange={event => selectCycle(event.target.value)}>{CYCLES.map(item => <option key={item.id} value={item.id}>{item.name} — {item.world === 'ridge' ? 'Quiet ridge' : 'Open coast'}</option>)}</select><fieldset className="light-choices"><legend>Time of day</legend>{['dawn', 'day', 'dusk', 'night'].map(value => <button key={value} aria-pressed={time === value} onClick={() => setTime(value)}>{value}</button>)}</fieldset><label className="field-label" htmlFor="phase-select">Phase condition</label><select id="phase-select" value={contextPhase} onChange={event => { const value = Number(event.target.value); setPhase(value); if (view === 'cycle') location.hash = `cycle/${cycle.id}/${value}`; }}>{PHASES.map((name, i) => <option key={name} value={i}>{name}</option>)}</select><p className="small-note">Fixed sample date. This changes the design preview, not Luna’s lunar calculations.</p><button className="primary-button" onClick={() => setOverlay(null)}>Return to the Field<Icon name="arrow" size={18} /></button></div></Dialog>}
    {overlay?.type === 'about' && <Dialog title="Quiet Horizon · Study 01" onClose={() => setOverlay(null)} className="about-dialog"><div className="dialog-content"><p className="eyebrow">A new expression of the same Field</p><h2>One Field.<br /><em>Many ways of seeing.</em></h2><p>This study explores how voice, a moment in time, and the act of returning can belong to one continuous experience.</p><dl className="study-facts"><div><dt>You can explore</dt><dd>Echo browsing, audio playback, capture states, linked reflections, phases, cycles, and Returns.</dd></div><div><dt>All content is invented</dt><dd>Playback uses locally generated synthetic speech. Recording and permission states are simulations. There is no microphone capture, account connection, or cloud save.</dd></div><div><dt>Changes are temporary</dt><dd>Written Echoes, reflections, and demo drafts live in memory and reset when this page reloads.</dd></div><div><dt>Proposed capabilities</dt><dd>Cycle environments, automatic Returns, living cycle reflections, and the linked reflection composer need separate product and implementation review.</dd></div><div><dt>What comes later</dt><dd>Loops, Threads, Chat, welcome, and registration can inherit this language after we review the core Echoes experience.</dd></div></dl><button className="primary-button" onClick={() => setOverlay(null)}>Explore the study<Icon name="arrow" size={18} /></button></div></Dialog>}
    {overlay?.type === 'loop' && <Dialog title="A connected Loop" onClose={() => setOverlay(null)}><div className="dialog-content"><p className="eyebrow">Sample connection</p><h2>{overlay.title}</h2><p>A cycle intention, with Echoes attached along the way. This study shows the relationship; the full Loop experience is reserved for a later iteration.</p><button className="primary-button" onClick={() => setOverlay(null)}>Back to the Echo</button></div></Dialog>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
