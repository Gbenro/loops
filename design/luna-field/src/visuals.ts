import { envelopePaths } from './audio-geometry.ts';
export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' } as Record<string,string>)[c]);
export function icon(name:string,size=20){
  const paths:Record<string,string>={
    field:'<circle cx="12" cy="12" r="8"/><path d="M5 16c4-5 10-5 14-1M8 5c5 3 7 7 6 14"/>',
    echo:'<path d="M2 12c2 0 2-6 4-6s2 12 4 12 2-15 4-15 2 18 4 18 2-9 4-9"/>',
    cycle:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16" fill="currentColor" opacity=".4"/>',
    loop:'<path d="M8 16a5 5 0 1 1 7-7l-6 6a5 5 0 1 0 7-7"/>',
    thread:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 7v10m2-12c6 0 10 2 10 5M7 19c6 0 10-2 10-5"/>',
    reflect:'<path d="m12 3 8 9-8 9-8-9 8-9Zm0 0v18"/>',
    chat:'<path d="M20 11a8 8 0 0 1-8 8H4l1-5a8 8 0 1 1 15-3Z"/><path d="M8 10h8m-8 4h5"/>',
    mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
    write:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    play:'<path d="m9 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>',
    pause:'<path d="M9 5v14m6-14v14" stroke-width="3"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    moon:'<path d="M19 15a8 8 0 0 1-10-11 8 8 0 1 0 10 11Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    return:'<path d="m4 10 4-4m-4 4 4 4m-4-4h10a6 6 0 1 1 0 12"/>',
    send:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
    volume:'<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    offline:'<path d="m3 3 18 18M8 8a8 8 0 0 0-5 3m8-6a16 16 0 0 1 10 5M7 15a7 7 0 0 1 8-1m-4 5h2"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="15" cy="17" r="3" fill="var(--surface)"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.field}</svg>`;
}
export function moonDisc(index:number,size=32){
  const left='M16 2A14 14 0 0 0 16 30Z',right='M16 2A14 14 0 0 1 16 30Z';
  let lit='';
  if(index===1)lit='<path d="M16 2A14 14 0 0 1 16 30C28 23 28 9 16 2Z"/>';
  if(index===2)lit=`<path d="${right}"/>`;
  if(index===3)lit='<path d="M16 2A14 14 0 0 1 16 30C2 30 2 2 16 2Z"/>';
  if(index===4)lit='<circle cx="16" cy="16" r="14"/>';
  if(index===5)lit='<path d="M16 2A14 14 0 0 0 16 30C30 30 30 2 16 2Z"/>';
  if(index===6)lit=`<path d="${left}"/>`;
  if(index===7)lit='<path d="M16 2A14 14 0 0 0 16 30C4 23 4 9 16 2Z"/>';
  return `<svg class="moon-disc" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#687585" opacity=".25"/><g fill="currentColor">${lit}</g><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width=".6" opacity=".4"/></svg>`;
}
export function waveform(samples:readonly number[]=[],className=''){
  const shape=envelopePaths(samples);
  return `<svg class="waveform organic-wave ${className}" viewBox="0 0 720 100" preserveAspectRatio="none" aria-hidden="true"><path class="wave-wash" d="${shape.area}"/><path class="wave-edge" d="${shape.top}"/><path class="wave-edge lower" d="${shape.bottom}"/></svg>`;
}
export function playbackWave(samples:readonly number[]=[],id='audio-wave'){
  const shape=envelopePaths(samples);const clip=`clip-${id}`;
  return `<svg class="playback-wave" viewBox="0 0 720 100" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="${clip}"><rect data-wave-progress width="0" height="100"/></clipPath></defs><g class="wave-unheard"><path class="wave-wash" d="${shape.area}"/><path class="wave-edge" d="${shape.top}"/><path class="wave-edge lower" d="${shape.bottom}"/></g><g clip-path="url(#${clip})" class="wave-heard"><path class="wave-wash" d="${shape.area}"/><path class="wave-edge" d="${shape.top}"/><path class="wave-edge lower" d="${shape.bottom}"/></g><line class="wave-cursor" data-wave-cursor x1="0" x2="0" y1="3" y2="97"/></svg>`;
}
export function liveWave(){return `<svg class="live-wave" viewBox="0 0 240 100" aria-hidden="true"><path data-live-curve d="M0 50L240 50"/><path data-live-curve class="wave-echo" d="M0 50L240 50"/><path data-live-curve class="wave-echo soft" d="M0 50L240 50"/></svg>`;}
export function orbitRings(progress=0,className=''){
  return `<svg class="orbit-rings ${className}" viewBox="0 0 200 200" aria-hidden="true"><circle class="orbit-halo" cx="100" cy="100" r="94"/><circle class="orbit-track" cx="100" cy="100" r="84"/><circle class="orbit-progress" data-orbit-progress cx="100" cy="100" r="84" pathLength="100" stroke-dasharray="${progress} 100" transform="rotate(-90 100 100)"/><circle class="orbit-inner" cx="100" cy="100" r="72"/></svg>`;
}
export function speakEntrance(){return `<div class="speak-entry"><button class="speak-orb" data-action="capture-voice" aria-label="Begin speaking — create an Echo">${orbitRings(20)}<span class="orb-core">${icon('mic',25)}<span>Speak</span></span></button><div class="speak-entry-copy"><span class="entry-title">Begin speaking</span><span>Your voice enters the field.</span><button class="text-link" data-action="capture-text">${icon('write',14)}Write instead</button></div></div>`;}
export function continuitySymbol(type='spiral',size=32){const line='<path d="M4 20c7 0 8-8 16-8s9 8 16 8"/>';const circle='<path d="M34 21A14 14 0 1 1 25 7m0 0 6-1-1 6"/>';const spiral='<path d="M37 22A17 17 0 1 1 21 3c9 0 15 6 15 14s-6 14-14 14S9 26 9 19s5-11 11-11 10 4 10 10-4 9-9 9-8-3-8-8 3-6 6-6 6 2 6 6-2 4-4 4"/>';return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" aria-hidden="true">${type==='line'?line:type==='circle'?circle:spiral}</svg>`;}
export function oceanScene(index=2,time='night',variant='hero'){
  const uid=`world-${variant}-${index}-${time}`;
  const brightness=[.2,.32,.5,.72,1,.72,.5,.32][index];
  const sky=time==='dawn'?['#121e31','#8e7974','#c6a38a']:time==='day'?['#213c54','#577d91','#a3b1b0']:time==='dusk'?['#111c32','#514b61','#8d6f6b']:['#080e1b','#1c2a40','#62616b'];
  const water=time==='day'?'#1c425a':time==='dawn'?'#243745':'#101e30';
  let waves='';
  for(let i=0;i<45;i++){const y=301+Math.pow(i/44,1.7)*215;const spread=8+i*8;const x=750-spread*.5+Math.sin(i*3.1)*10;const opacity=(.045+brightness*.1)*(1-i/62);waves+=`<path d="M${x} ${y}q${spread*.24} ${Math.sin(i)*2} ${spread*.46} 0t${spread*.54} 1" stroke="#e2d1a9" stroke-opacity="${opacity}" stroke-width="${.5+i*.035}"/>`;}
  for(let i=0;i<25;i++){const y=310+Math.pow(i/24,1.45)*260;waves+=`<path d="M-80 ${y}q130 -${2+i*.3} 260 0t260 0t260 0t260 0t260 0" stroke="#809cae" stroke-opacity="${.08+i*.002}" stroke-width="${.4+i*.035}"/>`;}
  const coast=`<path d="M0 279 65 245 116 264 182 217 228 251 290 231 364 286 450 297H0Z" fill="#253446" opacity=".62"/><path d="M1100 210 1068 222 1028 271 996 258 962 286 910 299H1100Z" fill="#26374a" opacity=".8"/><path d="M0 310 45 293 76 303 117 278 145 290 178 277 214 314 262 334 278 359 314 375 281 390 235 382 177 352 129 362 78 341 0 357Z" fill="#101d2c"/><path d="M1100 217 1079 213 1053 243 1038 297 1011 306 1010 326 973 340 958 378 912 395 885 424 936 434 994 407 1049 429 1100 411Z" fill="#0d1928"/><path d="M1046 262 1038 309 1018 319M1040 313 1060 340 1042 360M149 302 173 318 183 341" fill="none" stroke="#6b7784" stroke-opacity=".18"/><path d="M720 437 738 406 762 397 781 414 791 443 762 455Z" fill="#101d2c"/><path d="M738 406 751 424 781 414" fill="none" stroke="#7b8a98" stroke-opacity=".28"/><path d="M620 496 655 472 691 479 708 507 677 519 634 513Z" fill="#0b1623"/>`;
  const clouds=`<path d="M280 251q130-25 272-13t209-4M520 261q120-15 218-6t140-9M710 220q100 5 200-16" stroke="${time==='night'?'#a39d9c':'#cfac98'}" stroke-width="5" fill="none" opacity=".09"/>`;
  return `<svg class="ocean-scene ${variant}" viewBox="0 0 1100 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="An illustrated ocean horizon, ${escapeHtml(time)} illumination"><defs><linearGradient id="${uid}-sky" x2="0" y2="1"><stop stop-color="${sky[0]}"/><stop offset=".72" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient><linearGradient id="${uid}-sea" x2="0" y2="1"><stop stop-color="${water}"/><stop offset="1" stop-color="#070e19"/></linearGradient><radialGradient id="${uid}-halo"><stop stop-color="#e8e1cc" stop-opacity="${.05+brightness*.12}"/><stop offset="1" stop-color="#d6dce2" stop-opacity="0"/></radialGradient><linearGradient id="${uid}-veil"><stop stop-color="#080e19" stop-opacity=".9"/><stop offset=".52" stop-color="#080e19" stop-opacity=".25"/><stop offset="1" stop-color="#080e19" stop-opacity=".03"/></linearGradient><filter id="${uid}-noise"><feTurbulence baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="1100" height="320" fill="url(#${uid}-sky)"/><ellipse cx="750" cy="150" rx="260" ry="230" fill="url(#${uid}-halo)"/>${clouds}<g transform="translate(724 104)" color="#ede4d0">${moonDisc(index,52)}</g><path d="M0 287 60 285 120 290 190 286 240 289 320 287 390 291 470 288 540 292 650 291 720 294 810 292 900 287 980 290 1100 283V320H0Z" fill="#162635" opacity=".55"/><rect y="300" width="1100" height="260" fill="url(#${uid}-sea)"/><path d="M0 300h1100" stroke="#b9c0c0" stroke-opacity=".2"/>${waves}${coast}<path d="M0 480q100-30 200-7t130 65l-6 22H0Z" fill="#070c13" opacity=".6"/><rect width="1100" height="560" filter="url(#${uid}-noise)" opacity=".027"/><rect width="1100" height="560" fill="url(#${uid}-veil)" class="world-veil"/></svg>`;
}
export function formatMoment(value:string){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'}).format(new Date(value));}
export function formatDay(value:string){return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',timeZone:'America/Chicago'}).format(new Date(value));}
export function timecode(seconds=0){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}

export function photographicMoon(phaseFraction: number, size = 200, illumination = 50, phaseName = 'Moon'): string {
  let p = phaseFraction % 1;
  if (p < 0) p += 1;

  const isNewMoon = p < 0.02 || p > 0.98;
  const isFullMoon = p > 0.47 && p < 0.53;
  const isWaning = p > 0.5;

  let clipPath = '';
  if (isNewMoon) {
    clipPath = 'circle(0% at 50% 50%)';
  } else if (isFullMoon) {
    clipPath = 'circle(50% at 50% 50%)';
  } else {
    const bulge = Math.cos(p * 2 * Math.PI);
    const steps = 32;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = Math.PI * t;
      const y = 50 - 50 * Math.cos(angle);
      const terminatorX = isWaning
        ? 50 - bulge * 50 * Math.sin(angle)
        : 50 + bulge * 50 * Math.sin(angle);
      points.push({ x: terminatorX, y });
    }

    const pathPoints: string[] = [];
    if (isWaning) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = 50 - 50 * Math.sin(angle);
        const y = 50 - 50 * Math.cos(angle);
        pathPoints.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
      }
      for (let i = steps; i >= 0; i--) {
        pathPoints.push(`${points[i].x.toFixed(2)}% ${points[i].y.toFixed(2)}%`);
      }
    } else {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = 50 + 50 * Math.sin(angle);
        const y = 50 - 50 * Math.cos(angle);
        pathPoints.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
      }
      for (let i = steps; i >= 0; i--) {
        pathPoints.push(`${points[i].x.toFixed(2)}% ${points[i].y.toFixed(2)}%`);
      }
    }
    clipPath = `polygon(${pathPoints.join(', ')})`;
  }

  let terminatorGradient = '';
  if (!isNewMoon && !isFullMoon) {
    const direction = isWaning ? 'to left' : 'to right';
    terminatorGradient = `linear-gradient(${direction}, transparent 0%, transparent 30%, rgba(18, 18, 26, 0.15) 40%, rgba(18, 18, 26, 0.35) 50%, transparent 60%, transparent 100%)`;
  }

  const glowBoxShadow = isNewMoon
    ? '0 0 25px rgba(255, 220, 150, 0.1)'
    : '0 0 35px rgba(255, 215, 120, 0.35), 0 0 60px rgba(255, 200, 100, 0.15)';

  return `<div class="photographic-moon" role="img" aria-label="${escapeHtml(phaseName)}, ${illumination}% illuminated" style="position:relative;width:${size}px;height:${size}px;border-radius:50%;margin:0 auto;user-select:none;">
    <div class="moon-glow" style="position:absolute;inset:-4px;border-radius:50%;box-shadow:${glowBoxShadow};pointer-events:none;"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:#12121a;"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(100, 120, 140, 0.04);"></div>
    ${!isNewMoon ? `
      <div class="moon-surface" style="position:absolute;inset:0;border-radius:50%;background-image:url(/moon-texture.jpg);background-size:cover;background-position:center;clip-path:${clipPath};filter:sepia(25%) saturate(1.3) brightness(1.1) contrast(1.05);"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%, rgba(255, 210, 120, 0.12) 0%, rgba(255, 190, 80, 0.08) 60%, transparent 100%);clip-path:${clipPath};pointer-events:none;"></div>
      ${terminatorGradient ? `<div style="position:absolute;inset:0;border-radius:50%;background:${terminatorGradient};clip-path:${clipPath};pointer-events:none;"></div>` : ''}
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 35%, transparent 0%, transparent 60%, rgba(0,0,0,0.2) 100%);clip-path:${clipPath};pointer-events:none;"></div>
    ` : ''}
    <div style="position:absolute;inset:0;border-radius:50%;border:1px solid rgba(255,255,255,0.08);pointer-events:none;"></div>
  </div>`;
}

export function phaseTideGauge(progress: number, isThreshold: boolean, dayInPhase: number, totalDays: number, remainingText: string): string {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const pct = Math.round(clampedProgress * 100);
  const status = clampedProgress < 0.2 ? 'OPENING' : clampedProgress < 0.62 ? 'FLOWING' : clampedProgress < 0.88 ? 'COMPLETING' : 'CLOSING';
  const typeLabel = isThreshold ? 'THRESHOLD' : 'IN FLOW';
  const subLabel = isThreshold
    ? (clampedProgress < 0.2 ? 'A turning point. Brief and potent.' : clampedProgress < 0.62 ? 'Inside the pivot.' : clampedProgress < 0.88 ? 'The decision is resolving.' : 'The threshold is passing.')
    : (clampedProgress < 0.2 ? 'Time to move with what is already moving.' : clampedProgress < 0.62 ? 'In the current.' : clampedProgress < 0.88 ? 'Approaching the close.' : 'Final movement.');
  const accentColor = isThreshold ? '#F5E6C8' : '#C9A84C';

  return `<div class="phase-tide-gauge" style="padding:16px 20px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-family:monospace;font-size:11px;letter-spacing:0.12em;color:${accentColor};">${status}</span>
        <span style="font-family:monospace;font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--color-text-muted);letter-spacing:0.08em;">${typeLabel}</span>
      </div>
      <span style="font-family:monospace;font-size:11px;letter-spacing:0.08em;color:var(--color-text-muted);">${remainingText}</span>
    </div>
    <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;position:relative;margin-bottom:8px;">
      <div style="width:${pct}%;height:100%;background:${accentColor};border-radius:2px;transition:width 0.4s ease;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--color-text-dim);">
      <span style="font-style:italic;">${subLabel}</span>
      <span style="font-family:monospace;font-size:10px;color:var(--color-text-muted);">${dayInPhase.toFixed(1)}d of ${totalDays.toFixed(1)}d</span>
    </div>
  </div>`;
}
