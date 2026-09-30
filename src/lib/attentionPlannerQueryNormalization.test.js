import { describe, it, expect, beforeEach } from 'vitest';
import {
  AttentionEngineV1,
  AttentionIndex,
  MOCK_LUNA_FIELD_FIXTURES
} from '../../mcp-server/src/attentionLab.ts';
import { TOOL_DEFINITIONS_COMPAT } from '../../mcp-server/src/tools.ts';

describe('Orders 99 & 100 — Attention Lab Planner Query Normalization Suite', () => {
  let index;
  let engine;

  beforeEach(() => {
    index = new AttentionIndex();
    index.rebuild({
      snapshotId: 'snap_norm_test',
      snapshotHash: 'hash_norm_test',
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

  it('safely handles undefined, null, or non-string inputs in planAndAssemble without throwing', async () => {
    const resNull = await engine.planAndAssemble(null, { tokenBudget: 6000 });
    expect(resNull.plan).toBeDefined();
    expect(resNull.plan.coverageStrategy).toBe('balanced');

    const resUndef = await engine.planAndAssemble(undefined, { tokenBudget: 6000 });
    expect(resUndef.plan).toBeDefined();

    const resEmpty = await engine.planAndAssemble('', { tokenBudget: 6000 });
    expect(resEmpty.plan).toBeDefined();
  });

  it('supports query alias payload parameter passed by Luna Lab GPT', async () => {
    const rawQuery = 'How has my relationship to rest shifted?';
    const { plan, contextPacket } = await engine.planAndAssemble(rawQuery, { tokenBudget: 6000 });

    expect(plan.tokenBudget).toBe(6000);
    expect(plan.coverageStrategy).toBe('longitudinal_span');
    expect(contextPacket).toBeDefined();
    expect(contextPacket.evidenceItems.length).toBeGreaterThan(0);
  });

  it('registers lunar_lab_attention_plan in tool definitions', () => {
    const tool = TOOL_DEFINITIONS_COMPAT.find(t => t.name === 'lunar_lab_attention_plan');
    expect(tool).toBeDefined();
  });
});
