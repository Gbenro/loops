/**
 * Thematic Tagging Pipeline & Audit Utilities (Order 106)
 * Enables reliable thematic evidence signals for Attention V1/V2 without hard-filtering evidence.
 */

// Canonical theme dictionary mapping common variants & synonyms to normalized theme keys
export const THEME_CANONICAL_MAP = {
  // Practice & Grounding
  'rest': 'rest',
  'sleep': 'rest',
  'wind_down': 'rest',
  'stillness': 'stillness',
  'quiet': 'stillness',
  'meditation': 'stillness',
  'intention': 'intention',
  'seed': 'intention',
  'prayer': 'intention',

  // Work & Creation
  'work': 'work',
  'sprint': 'work',
  'building': 'work',
  'craft': 'work',
  'creative_writing': 'creative_writing',
  'creative-writing': 'creative_writing',
  'writing': 'creative_writing',
  'book': 'creative_writing',
  'studio': 'studio',
  'editorial': 'studio',

  // Pattern & Evidence Geometries
  'recurrence': 'recurrence',
  'pattern': 'recurrence',
  'repeating': 'recurrence',
  'longitudinal': 'longitudinal_change',
  'shift': 'longitudinal_change',
  'transition': 'longitudinal_change',
  'breakthrough': 'breakthrough',
  'insight': 'insight',
  'clarity': 'clarity',
  'revelation': 'clarity',

  // Boundaries & Tension
  'boundary': 'boundaries',
  'boundaries': 'boundaries',
  'friction': 'friction',
  'tension': 'friction',
  'fear': 'fear',
  'shadow': 'shadow',
  'grief': 'grief',
  'release': 'release',
  'unresolved': 'unresolved',
  'abandoned': 'unresolved',

  // Connection & Meaning
  'gratitude': 'gratitude',
  'relationship': 'relationship',
  'partnership': 'relationship',
  'joy': 'joy',
  'vision': 'vision'
};

/**
 * Normalizes a tag string into canonical snake_case format.
 */
export function normalizeThemeTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  const clean = tag.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return THEME_CANONICAL_MAP[clean] || clean;
}

/**
 * Infers thematic tags from text content and optional phase metadata.
 * Does not overwrite existing tags; returns recommended additional thematic signals.
 */
export function inferThematicTagsFromText(text, phaseKey = null) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const inferred = new Set();

  // Keyword rules for thematic inference
  if (/\b(rest|sleep|tired|exhausted|unwind|pause|slow down)\b/.test(lower)) inferred.add('rest');
  if (/\b(stillness|quiet|silence|meditat|breathe|presence)\b/.test(lower)) inferred.add('stillness');
  if (/\b(intention|seed|purpose|aim|direct|dedicat)\b/.test(lower)) inferred.add('intention');
  if (/\b(write|writing|draft|manuscript|journal|prose)\b/.test(lower)) inferred.add('creative_writing');
  if (/\b(work|build|code|implement|task|ship|sprint)\b/.test(lower)) inferred.add('work');
  if (/\b(boundary|boundaries|limit|space|protect)\b/.test(lower)) inferred.add('boundaries');
  if (/\b(friction|conflict|block|struggle|stuck|tension)\b/.test(lower)) inferred.add('friction');
  if (/\b(release|let go|surrender|drop|forgive|grief)\b/.test(lower)) inferred.add('release');
  if (/\b(breakthrough|clarity|realiz|insight|understand|saw|revelation)\b/.test(lower)) inferred.add('clarity');
  if (/\b(again|repeat|recur|pattern|cycle|always|keeps happening)\b/.test(lower)) inferred.add('recurrence');

  return Array.from(inferred);
}

/**
 * Audit diagnostic reporter for thematic tagging health across a collection of records.
 */
export function auditThematicTagging(records = []) {
  const totalRecords = records.length;
  let untaggedCount = 0;
  let systemOnlyCount = 0;
  let hasThematicCount = 0;

  const tagFrequencies = {};
  const normalizedFrequencies = {};
  const inconsistentNaming = [];
  const systemTagSet = new Set(['original-voice-echo', 'chat-reflection', 'conversation-reflection']);

  for (const r of records) {
    const rawTags = Array.isArray(r.tags) ? r.tags : [];
    if (rawTags.length === 0) {
      untaggedCount++;
      continue;
    }

    const nonSystemTags = rawTags.filter(t => !systemTagSet.has(t));
    if (nonSystemTags.length === 0) {
      systemOnlyCount++;
    } else {
      hasThematicCount++;
    }

    for (const t of rawTags) {
      const strTag = String(t).trim();
      tagFrequencies[strTag] = (tagFrequencies[strTag] || 0) + 1;

      const norm = normalizeThemeTag(strTag);
      normalizedFrequencies[norm] = (normalizedFrequencies[norm] || 0) + 1;

      if (norm !== strTag.toLowerCase() && !systemTagSet.has(strTag)) {
        inconsistentNaming.push({ raw: strTag, normalized: norm, recordId: r.id });
      }
    }
  }

  const untaggedRatio = totalRecords > 0 ? Number((untaggedCount / totalRecords).toFixed(3)) : 0;
  const coverageRatio = totalRecords > 0 ? Number((hasThematicCount / totalRecords).toFixed(3)) : 0;

  return {
    totalRecords,
    untaggedCount,
    systemOnlyCount,
    hasThematicCount,
    untaggedRatio,
    coverageRatio,
    tagFrequencies,
    normalizedFrequencies,
    inconsistentNamingCount: inconsistentNaming.length,
    inconsistentNamingSample: inconsistentNaming.slice(0, 10),
    healthStatus: coverageRatio >= 0.6 ? 'healthy' : (coverageRatio >= 0.3 ? 'moderate_gaps' : 'needs_enrichment')
  };
}
