// Shared phase constants — single source of truth for phase keys, labels, and accent colors.
// Import from here instead of defining local maps in each component.

export const PHASE_KEYS = [
  'new',
  'waxing-crescent',
  'first-quarter',
  'waxing-gibbous',
  'full',
  'waning-gibbous',
  'last-quarter',
  'waning-crescent',
];

export const PHASE_LABELS = {
  'new':             'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter':   'First Quarter',
  'waxing-gibbous':  'Waxing Gibbous',
  'full':            'Full Moon',
  'waning-gibbous':  'Waning Gibbous',
  'last-quarter':    'Last Quarter',
  'waning-crescent': 'Waning Crescent',
};

export const PHASE_ACCENTS = {
  'new':             'rgba(245,230,200,0.75)',
  'waxing-crescent': '#74c69d',
  'first-quarter':   '#f6ad55',
  'waxing-gibbous':  '#81e6d9',
  'full':            '#fefcbf',
  'waning-gibbous':  '#b794f4',
  'last-quarter':    '#f687b3',
  'waning-crescent': '#718096',
};

// Ordered array with key, label, and accent — for components that iterate phases.
export const PHASES_ORDERED = PHASE_KEYS.map(key => ({
  key,
  label:  PHASE_LABELS[key],
  accent: PHASE_ACCENTS[key],
}));
