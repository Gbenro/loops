import { describe, it, expect } from 'vitest';

// ─── Pure functions matching Relational Memory logic ───────────────────────────

function createRelationalMemory({ id, statement, type, evidenceRecordIds = [], provenance = 'observed', confidence }) {
  const lifecycleStatus = provenance === 'explicit' ? 'active' : 'candidate';
  const defaultConfidence = confidence !== undefined ? confidence : (provenance === 'explicit' ? 0.95 : 0.70);

  return {
    id,
    statement,
    type,
    evidenceRecordIds: Array.isArray(evidenceRecordIds) ? evidenceRecordIds : [],
    confidence: defaultConfidence,
    strength: 1,
    lifecycleStatus,
    provenance,
    userActionStatus: 'active',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
}

function reinforceRelationalMemory(existing, newEvidenceIds = [], statementUpdate) {
  const newStrength = (existing.strength || 1) + 1;
  let newLifecycleStatus = existing.lifecycleStatus;

  if (existing.lifecycleStatus === 'quiet' || existing.lifecycleStatus === 'dormant') {
    newLifecycleStatus = 'resurfaced';
  } else if (existing.lifecycleStatus === 'candidate' && newStrength >= 2) {
    newLifecycleStatus = 'emerging';
  } else if (existing.lifecycleStatus === 'emerging' && newStrength >= 3) {
    newLifecycleStatus = 'active';
  }

  const existingEvidence = Array.isArray(existing.evidenceRecordIds) ? existing.evidenceRecordIds : [];
  const mergedEvidence = Array.from(new Set([...existingEvidence, ...newEvidenceIds]));

  return {
    ...existing,
    strength: newStrength,
    lifecycleStatus: newLifecycleStatus,
    evidenceRecordIds: mergedEvidence,
    statement: statementUpdate || existing.statement,
    lastSeenAt: new Date().toISOString()
  };
}

function selectRelevantMemories(memories, currentMessage, history = [], maxTop = 3) {
  const activeMemories = memories.filter(
    m => ['active', 'emerging', 'resurfaced'].includes(m.lifecycleStatus) && m.userActionStatus === 'active'
  );

  const contextText = (currentMessage + ' ' + (history.slice(-2).map(h => h.content || '').join(' '))).toLowerCase();
  const words = Array.from(new Set(contextText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)));

  const scored = [];

  for (const m of activeMemories) {
    let keywordScore = 0;
    const stmt = (m.statement || '').toLowerCase();
    
    for (const w of words) {
      if (stmt.includes(w)) keywordScore += 3;
    }

    let generalScore = 0;
    if (m.type === 'interaction_preference' && m.provenance === 'explicit') generalScore += 2;
    if (m.lifecycleStatus === 'active' || m.lifecycleStatus === 'resurfaced') generalScore += 0.5;
    generalScore += Math.min(m.strength || 1, 5) * 0.1;

    const totalScore = keywordScore > 0 ? (keywordScore + generalScore) : (m.type === 'interaction_preference' && m.provenance === 'explicit' ? generalScore : 0);

    if (totalScore >= 2) {
      scored.push({ ...m, score: totalScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxTop);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Luna Relational Memory V1', () => {
  describe('Creation & Initial Lifecycle', () => {
    it('creates an observed memory as candidate with strength 1', () => {
      const mem = createRelationalMemory({
        id: 'rm_1',
        statement: 'Still Unfolding functions as openness language',
        type: 'language',
        evidenceRecordIds: ['e_101'],
        provenance: 'observed'
      });

      expect(mem.lifecycleStatus).toBe('candidate');
      expect(mem.strength).toBe(1);
      expect(mem.confidence).toBe(0.7);
      expect(mem.provenance).toBe('observed');
      expect(mem.evidenceRecordIds).toEqual(['e_101']);
    });

    it('promotes explicit user statements immediately to active', () => {
      const mem = createRelationalMemory({
        id: 'rm_2',
        statement: 'User prefers concise summaries without extra lunar decoration',
        type: 'interaction_preference',
        evidenceRecordIds: ['msg_201'],
        provenance: 'explicit'
      });

      expect(mem.lifecycleStatus).toBe('active');
      expect(mem.confidence).toBe(0.95);
      expect(mem.provenance).toBe('explicit');
    });
  });

  describe('Lifecycle Promotion through Recurrence', () => {
    it('promotes candidate -> emerging on 2nd occurrence', () => {
      const candidate = createRelationalMemory({
        id: 'rm_1',
        statement: 'Still Unfolding',
        type: 'language',
        evidenceRecordIds: ['e_101'],
        provenance: 'observed'
      });

      const reinforced = reinforceRelationalMemory(candidate, ['e_102']);
      expect(reinforced.strength).toBe(2);
      expect(reinforced.lifecycleStatus).toBe('emerging');
      expect(reinforced.evidenceRecordIds).toEqual(['e_101', 'e_102']);
    });

    it('promotes emerging -> active on 3rd occurrence', () => {
      let mem = createRelationalMemory({
        id: 'rm_1',
        statement: 'Still Unfolding',
        type: 'language',
        evidenceRecordIds: ['e_101']
      });

      mem = reinforceRelationalMemory(mem, ['e_102']); // strength 2: emerging
      mem = reinforceRelationalMemory(mem, ['e_103']); // strength 3: active

      expect(mem.strength).toBe(3);
      expect(mem.lifecycleStatus).toBe('active');
      expect(mem.evidenceRecordIds).toEqual(['e_101', 'e_102', 'e_103']);
    });

    it('resurfaces quiet or dormant memories when recurring evidence returns', () => {
      const quietMem = {
        id: 'rm_3',
        statement: 'Patience over hasty action',
        type: 'living_distinction',
        strength: 4,
        lifecycleStatus: 'quiet',
        evidenceRecordIds: ['e_1', 'e_2']
      };

      const resurfaced = reinforceRelationalMemory(quietMem, ['e_50']);
      expect(resurfaced.lifecycleStatus).toBe('resurfaced');
      expect(resurfaced.strength).toBe(5);
      expect(resurfaced.evidenceRecordIds).toContain('e_50');
    });
  });

  describe('Evidence Deduplication & Statement Refinement', () => {
    it('deduplicates overlapping evidence IDs', () => {
      const mem = createRelationalMemory({
        id: 'rm_4',
        statement: 'Test',
        type: 'orientation',
        evidenceRecordIds: ['e_1', 'e_2']
      });

      const updated = reinforceRelationalMemory(mem, ['e_2', 'e_3']);
      expect(updated.evidenceRecordIds).toEqual(['e_1', 'e_2', 'e_3']);
    });

    it('updates statement when provided on reinforcement', () => {
      const mem = createRelationalMemory({
        id: 'rm_5',
        statement: 'Initial nuance',
        type: 'language',
        evidenceRecordIds: ['e_1']
      });

      const refined = reinforceRelationalMemory(mem, ['e_2'], 'Deepened nuance reflecting new context');
      expect(refined.statement).toBe('Deepened nuance reflecting new context');
    });
  });

  describe('Selective Retrieval & Context Scoring', () => {
    const memoryPool = [
      {
        id: 'rm_1',
        statement: 'Still Unfolding currently functions as meaningful language for openness without premature closure',
        type: 'language',
        lifecycleStatus: 'active',
        userActionStatus: 'active',
        provenance: 'observed',
        strength: 3
      },
      {
        id: 'rm_2',
        statement: 'Prefers direct astronomical orientation without unnecessary decoration',
        type: 'interaction_preference',
        lifecycleStatus: 'active',
        userActionStatus: 'active',
        provenance: 'explicit',
        strength: 2
      },
      {
        id: 'rm_3',
        statement: 'Chauffeur license preparation details',
        type: 'orientation',
        lifecycleStatus: 'active',
        userActionStatus: 'active',
        provenance: 'observed',
        strength: 1
      },
      {
        id: 'rm_4',
        statement: 'Dismissed memory about previous hobby',
        type: 'orientation',
        lifecycleStatus: 'active',
        userActionStatus: 'dismissed',
        provenance: 'observed',
        strength: 5
      },
      {
        id: 'rm_5',
        statement: 'Unsettled experience and unfolding journey',
        type: 'candidate',
        lifecycleStatus: 'candidate',
        userActionStatus: 'active',
        provenance: 'observed',
        strength: 1
      }
    ];

    it('selects relevant language memory when conversation touches unfolding experience', () => {
      const selected = selectRelevantMemories(
        memoryPool,
        'I have an experience from yesterday that feels still unfolding.'
      );

      const ids = selected.map(m => m.id);
      expect(ids).toContain('rm_1');
      expect(ids).not.toContain('rm_3'); // chauffeur not relevant
      expect(ids).not.toContain('rm_4'); // dismissed
      expect(ids).not.toContain('rm_5'); // candidate not in active pool
    });

    it('does not select domain-specific memories when turn is unrelated', () => {
      const selected = selectRelevantMemories(
        memoryPool,
        'Can you remind me what day of the cycle it is?'
      );

      const ids = selected.map(m => m.id);
      expect(ids).not.toContain('rm_1');
      expect(ids).not.toContain('rm_3');
    });

    it('caps total selected memories to maxTop (0 to 3)', () => {
      const selected = selectRelevantMemories(
        memoryPool,
        'Still unfolding orientation without decoration and license',
        [],
        3
      );

      expect(selected.length).toBeLessThanOrEqual(3);
    });
  });
});
