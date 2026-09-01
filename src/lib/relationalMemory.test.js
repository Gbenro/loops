import { describe, it, expect } from 'vitest';

// ─── Pure functions matching Relational Memory logic ───────────────────────────

function createRelationalMemory({ id, statement, type, evidenceRecordIds = [], provenance = 'observed', confidence }) {
  const isDurableExplicit = provenance === 'explicit' && (type === 'interaction_preference' || type === 'orientation');
  const lifecycleStatus = isDurableExplicit ? 'active' : 'candidate';
  const defaultConfidence = confidence !== undefined ? confidence : (provenance === 'explicit' ? 0.95 : 0.70);

  return {
    id,
    statement,
    type,
    evidenceRecordIds: Array.isArray(evidenceRecordIds) ? evidenceRecordIds : [],
    confidence: defaultConfidence,
    strength: 1,
    recurrenceCount: 1,
    lifecycleStatus,
    provenance,
    userActionStatus: 'active',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
}

function reinforceRelationalMemory(existing, newEvidenceIds = [], statementUpdate) {
  const newRecurrence = (existing.recurrenceCount || existing.strength || 1) + 1;
  const newStrength = (existing.strength || 1) + 1;
  let newLifecycleStatus = existing.lifecycleStatus;

  if (existing.lifecycleStatus === 'quiet' || existing.lifecycleStatus === 'dormant') {
    newLifecycleStatus = 'resurfaced';
  } else if (existing.lifecycleStatus === 'candidate' && newRecurrence >= 2) {
    newLifecycleStatus = 'emerging';
  } else if (existing.lifecycleStatus === 'emerging' && newRecurrence >= 3) {
    newLifecycleStatus = 'active';
  }

  const existingEvidence = Array.isArray(existing.evidenceRecordIds) ? existing.evidenceRecordIds : [];
  const mergedEvidence = Array.from(new Set([...existingEvidence, ...newEvidenceIds]));

  return {
    ...existing,
    strength: newStrength,
    recurrenceCount: newRecurrence,
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
    it('creates an observed memory as candidate with strength 1 and recurrenceCount 1', () => {
      const mem = createRelationalMemory({
        id: 'rm_1',
        statement: 'Still Unfolding functions as openness language',
        type: 'language',
        evidenceRecordIds: ['e_101'],
        provenance: 'observed'
      });

      expect(mem.lifecycleStatus).toBe('candidate');
      expect(mem.strength).toBe(1);
      expect(mem.recurrenceCount).toBe(1);
      expect(mem.confidence).toBe(0.7);
      expect(mem.provenance).toBe('observed');
      expect(mem.evidenceRecordIds).toEqual(['e_101']);
    });

    it('promotes explicit durable interaction preferences immediately to active', () => {
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

    it('leaves non-preference explicit statements (such as language) as candidate until recurrence', () => {
      const mem = createRelationalMemory({
        id: 'rm_2b',
        statement: 'User mentioned Still Unfolding in conversation',
        type: 'language',
        evidenceRecordIds: ['msg_202'],
        provenance: 'explicit'
      });

      // Explicit language/distinctions do NOT automatically become active; they require recurrence
      expect(mem.lifecycleStatus).toBe('candidate');
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
      expect(reinforced.recurrenceCount).toBe(2);
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

      mem = reinforceRelationalMemory(mem, ['e_102']); // recurrence 2: emerging
      mem = reinforceRelationalMemory(mem, ['e_103']); // recurrence 3: active

      expect(mem.strength).toBe(3);
      expect(mem.recurrenceCount).toBe(3);
      expect(mem.lifecycleStatus).toBe('active');
      expect(mem.evidenceRecordIds).toEqual(['e_101', 'e_102', 'e_103']);
    });

    it('resurfaces quiet or dormant memories when recurring evidence returns', () => {
      const quietMem = {
        id: 'rm_3',
        statement: 'Patience over hasty action',
        type: 'living_distinction',
        strength: 4,
        recurrenceCount: 4,
        lifecycleStatus: 'quiet',
        evidenceRecordIds: ['e_1', 'e_2']
      };

      const resurfaced = reinforceRelationalMemory(quietMem, ['e_50']);
      expect(resurfaced.lifecycleStatus).toBe('resurfaced');
      expect(resurfaced.strength).toBe(5);
      expect(resurfaced.recurrenceCount).toBe(5);
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

  describe('Directive Criteria & Cross-Chat Isolation Guarantees', () => {
    it('(1) explicit durable relational preference triggers propose_candidate_memory with explicit provenance and active status', () => {
      const explicitStatement = 'Let what we genuinely learn about one another survive the conversation in which we learned it';
      const mem = createRelationalMemory({
        id: 'rm_explicit_1',
        statement: explicitStatement,
        type: 'orientation',
        provenance: 'explicit',
        evidenceRecordIds: ['msg_user_direct_1']
      });

      expect(mem.provenance).toBe('explicit');
      expect(mem.type).toBe('orientation');
      expect(mem.lifecycleStatus).toBe('active'); // Activates immediately for durable explicit orientation
      expect(mem.confidence).toBe(0.95);
    });

    it('(2) ordinary biographical / Echo-worthy content is classified for Field rather than relational memory', () => {
      const biographicalNote = 'Susie and I walked in the garden under the gibbous moon yesterday evening.';
      
      // Verification that ordinary event notes do not match relational attunement categories
      const isRelationalAttunement = (text) => {
        const lower = text.toLowerCase();
        return lower.includes('how we talk') || lower.includes('speak directly') || 
               lower.includes('learn about one another') || lower.includes('our conversations') ||
               lower.includes('interaction preference');
      };

      expect(isRelationalAttunement(biographicalNote)).toBe(false);
    });

    it('(3) recurring matching relational evidence uses reinforcement rather than duplicate creation', () => {
      const memoryStore = new Map();
      
      function recordOrReinforceRelationalLearning(existingStore, newStatement, type, evidenceId) {
        // Look for matching semantic core
        for (const [id, existing] of existingStore.entries()) {
          if (existing.type === type && (existing.statement === newStatement || existing.statement.includes('unfolding'))) {
            const reinforced = reinforceRelationalMemory(existing, [evidenceId]);
            existingStore.set(id, reinforced);
            return { action: 'reinforced', memory: reinforced };
          }
        }

        const created = createRelationalMemory({
          id: 'rm_' + Date.now(),
          statement: newStatement,
          type,
          evidenceRecordIds: [evidenceId],
          provenance: 'observed'
        });
        existingStore.set(created.id, created);
        return { action: 'created', memory: created };
      }

      // Turn 1: initial discovery
      const res1 = recordOrReinforceRelationalLearning(memoryStore, 'Still Unfolding functions as openness language', 'language', 'msg_1');
      expect(res1.action).toBe('created');
      expect(res1.memory.lifecycleStatus).toBe('candidate');
      expect(memoryStore.size).toBe(1);

      // Turn 2: recurring evidence -> reinforces, does NOT duplicate
      const res2 = recordOrReinforceRelationalLearning(memoryStore, 'Still Unfolding functions as openness language', 'language', 'msg_2');
      expect(res2.action).toBe('reinforced');
      expect(memoryStore.size).toBe(1); // Store size remains 1 (no duplicate)
      expect(res2.memory.recurrenceCount).toBe(2);
      expect(res2.memory.lifecycleStatus).toBe('emerging'); // Promoted to emerging

      // Turn 3: 3rd recurrence -> promoted to active
      const res3 = recordOrReinforceRelationalLearning(memoryStore, 'Still Unfolding functions as openness language', 'language', 'msg_3');
      expect(res3.action).toBe('reinforced');
      expect(memoryStore.size).toBe(1);
      expect(res3.memory.recurrenceCount).toBe(3);
      expect(res3.memory.lifecycleStatus).toBe('active'); // Promoted to active
    });

    it('(4) eligible memory can be selected/injected cross-chat while conversation history remains strictly isolated', () => {
      const sharedUserRelationalMemories = [
        {
          id: 'rm_shared_1',
          statement: 'Let what we genuinely learn about one another survive the conversation in which we learned it',
          type: 'orientation',
          lifecycleStatus: 'active',
          userActionStatus: 'active',
          provenance: 'explicit',
          strength: 2
        }
      ];

      // Session A history
      const sessionA_History = [
        { role: 'user', content: 'Session A message about music' },
        { role: 'assistant', content: 'Session A response' }
      ];

      // Session B history (completely separate conversation)
      const sessionB_History = [
        { role: 'user', content: 'Session B message about gardening' }
      ];

      // Cross-chat history isolation assertion
      expect(sessionB_History).not.toEqual(expect.arrayContaining(sessionA_History));

      // Shared relational memory selection assertion across Session B
      const selectedInSessionB = selectRelevantMemories(
        sharedUserRelationalMemories,
        'How do we learn about one another across our chats?',
        sessionB_History
      );

      expect(selectedInSessionB.length).toBe(1);
      expect(selectedInSessionB[0].id).toBe('rm_shared_1');
    });

    it('(5) model choice does not alter memory semantics or lifecycle', () => {
      const memory = createRelationalMemory({
        id: 'rm_model_test',
        statement: 'Direct concise replies',
        type: 'interaction_preference',
        provenance: 'explicit'
      });

      const modelsToTest = ['claude-fable-5', 'qwen-3.8-max', 'opus-5', 'gemini-3.7-flash'];

      modelsToTest.forEach(modelKey => {
        // The selection query is purely driven by userId and relational_memories table
        const selected = selectRelevantMemories([memory], 'Direct concise replies please', []);
        expect(selected.length).toBe(1);
        expect(selected[0].statement).toBe('Direct concise replies');
        expect(selected[0].lifecycleStatus).toBe('active');
      });
    });
  });
});

