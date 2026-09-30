import { describe, it, expect, beforeEach } from 'vitest';
import {
  AttentionEngineV1,
  AttentionIndex,
  MOCK_LUNA_FIELD_FIXTURES
} from '../../mcp-server/src/attentionLab.ts';
import { TOOL_DEFINITIONS_COMPAT } from '../../mcp-server/src/tools.ts';

describe('Order 107 — Attention V1 Production Bounded Retrieval Layer', () => {
  let index;
  let engine;

  beforeEach(() => {
    index = new AttentionIndex();
    index.rebuild({
      snapshotId: 'snap_test_prod_v1',
      snapshotHash: 'hash_test_prod_v1',
      mode: 'fixture_benchmark',
      loops: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'loop'),
      echoes: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'echo'),
      relationalMemories: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'relational_memory'),
      chatMessages: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'chat_message'),
      lunarCycles: MOCK_LUNA_FIELD_FIXTURES.filter(i => i.sourceType === 'lunar_cycle'),
      items: MOCK_LUNA_FIELD_FIXTURES,
      created_at: new Date().toISOString()
    });
    engine = new AttentionEngineV1(index);
  });

  it('exposes retrieve_bounded_attention tool in MCP tool catalog', () => {
    const tool = TOOL_DEFINITIONS_COMPAT.find(t => t.name === 'retrieve_bounded_attention');
    expect(tool).toBeDefined();
    expect(tool.description).toContain('Production Attention V1 Bounded Retrieval Engine');
    expect(tool.inputSchema.required).toContain('question');
  });

  it('generates an inspectable AttentionPlan and ContextPacket under controlled token budget', async () => {
    const { plan, contextPacket } = await engine.planAndAssemble(
      'How has my relationship to rest and evening rituals shifted over the cycles?',
      { tokenBudget: 3000 }
    );

    expect(plan).toBeDefined();
    expect(plan.tokenBudget).toBe(3000);
    expect(plan.coverageStrategy).toBe('longitudinal_span');
    expect(contextPacket).toBeDefined();
    expect(contextPacket.formattedPromptContext).toBeDefined();
    expect(contextPacket.evidenceItems.length).toBeGreaterThan(0);
    expect(contextPacket.totalTokensUsed).toBeLessThanOrEqual(3500);
  });

  it('supports recurrence deepening strategy for repeating patterns', async () => {
    const { plan } = await engine.planAndAssemble(
      'What recurring patterns keep surfacing in my studio work?',
      { coverageStrategy: 'recurrence_deepening', tokenBudget: 6000 }
    );

    expect(plan.coverageStrategy).toBe('recurrence_deepening');
    expect(plan.candidates.length).toBeGreaterThan(0);
  });

  it('supports entity clustering for specific projects or collaborators', async () => {
    const { plan } = await engine.planAndAssemble(
      'What have I reflected on regarding Alex and studio editorial?',
      { coverageStrategy: 'entity_cluster', tokenBudget: 3000 }
    );

    expect(plan.candidates.length).toBeGreaterThan(0);
    expect(plan.coverageStrategy).toBe('entity_cluster');
  });
});
