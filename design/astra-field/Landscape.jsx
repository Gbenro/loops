import { useId } from 'react';

// Stable vector geography. Only explicit cycle/phase/time inputs affect lighting.
// No Echo content, tags, or sentiment enters this component.
const LIGHT = {
  dawn: ['#263c47', '#9a8b83', '#d9b99a'],
  day: ['#496773', '#8caaa9', '#c8c9b2'],
  dusk: ['#142d38', '#566970', '#a09481'],
  night: ['#081822', '#203b47', '#4a626b'],
};
export function Landscape({ world = 'ridge', phase = 2, time = 'dusk', className = '' }) {
  const id = useId().replace(/:/g, '');
  const colors = LIGHT[time];
  const illumination = (1 - Math.cos((phase / 8) * Math.PI * 2)) / 2;
  return <svg className={`landscape ${className}`} viewBox="0 0 1400 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-world={world} data-phase={phase} data-time={time}>
    <defs>
      <linearGradient id={`${id}s`} x2="0" y2="1"><stop stopColor={colors[0]} /><stop offset=".7" stopColor={colors[1]} /><stop offset="1" stopColor={colors[2]} /></linearGradient>
      <linearGradient id={`${id}f`} x2="0" y2="1"><stop stopColor="#092026" stopOpacity="0" /><stop offset="1" stopColor="#092026" stopOpacity=".75" /></linearGradient>
      <radialGradient id={`${id}g`}><stop stopColor="#f1e1bf" stopOpacity={.12 + illumination * .2} /><stop offset="1" stopColor="#f1e1bf" stopOpacity="0" /></radialGradient>
      <filter id={`${id}n`}><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="7" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope=".045" /></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light" /></filter>
    </defs>
    <g filter={`url(#${id}n)`}>
      <path fill={`url(#${id}s)`} d="M0 0h1400v520H0Z" />
      <ellipse cx="1000" cy="155" rx="390" ry="230" fill={`url(#${id}g)`} />
      {world === 'ridge' ? <>
        <path d="M0 318 105 291 195 320 330 248 420 281 535 210 594 245 693 171 742 199 801 165 879 242 963 191 1058 249 1181 204 1286 249 1400 214V520H0Z" fill="#91a2a3" opacity={.18 + illumination * .15} />
        <path d="M0 372 145 321 246 354 367 297 465 331 583 270 665 299 766 249 853 274 957 242 1072 309 1164 293 1290 340 1400 301V520H0Z" fill="#2d4c56" opacity=".7" />
        <path d="M0 424C159 400 216 446 352 397L567 349 667 365 792 321 951 360 1066 342 1197 386 1400 347V520H0Z" fill="#203e48" />
        <path d="M0 485Q140 443 300 471T612 449 902 446 1156 435 1400 454V520H0Z" fill="#152f36" />
        <path d="m694 171 48 28 59-34-37 52-24-9-40 23 14-37-20 5Z" fill="#cbd4d1" opacity={.08 + illumination * .18} />
      </> : <>
        <path d="M0 342Q290 334 500 341T970 341 1400 335V520H0Z" fill="#587b83" opacity=".6" />
        <path d="M0 339 99 326 204 337 280 302 356 310 398 335 526 339 702 342 826 327 891 330 934 342 1400 339V356H0Z" fill="#2b4a54" />
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${100 + (i % 3) * 150} ${370 + i * 12}q180 -4 290 0t360 0`} stroke="#c7cebd" strokeWidth=".8" opacity={.06 + illumination * .07} fill="none" />)}
        <path d="M0 415q150 12 277 73t385 32H0Z" fill="#18363b" />
      </>}
      <rect width="1400" height="520" fill={`url(#${id}f)`} />
      <rect width="1400" height="520" fill="#07151b" opacity={time === 'night' ? .22 + (1 - illumination) * .18 : (1 - illumination) * .1} />
    </g>
  </svg>;
}
