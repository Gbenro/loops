import { describe, it, expect, vi } from 'vitest';
import { parseDsmlToolCalls, sanitizeProse, formatFallbackActionReport } from '../../mcp-server/dist/dsmlParser.js';
import { executeTool } from '../../mcp-server/dist/tools.js';

describe('DSML Parser and Fail-Closed Protocol Sanitizer', () => {
  const sampleLeakedDsml = `<\uff5cDSML\uff5ctool_calls><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1789153595723mkhd</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"momentum\", \"stress\", \"weight\", \"action\", \"chauffeur\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788985380921hrp9</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"meeting\", \"luan\", \"anasha\", \"green-mirror\", \"new-moon\", \"gratitude\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788386372300ipoh</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"testing\", \"voice\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788384487693ejw4</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"numbers\", \"111\", \"return\", \"noticing\", \"awareness\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e17883843673464oyt</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"waning-gibbous\", \"release\", \"gratitude\", \"twilight\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788384233781ldv6</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"936\", \"frequency\", \"return\", \"awareness\", \"processing\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e178837986638398ua</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"sharing\", \"processing\", \"articulation\", \"waning-gibbous\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788379779815a9yq</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"tuning\", \"personas\", \"research\", \"ai-village\", \"anasha\", \"return\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788379004146yszz</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"return\", \"remembering\", \"recognition\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke><\uff5cDSML\uff5cinvoke name=\"update_echo\"><\uff5cDSML\uff5cparameter name=\"id\" string=\"true\">e1788439819517bv1y</\uff5cDSML\uff5cparameter><\uff5cDSML\uff5cparameter name=\"tags\">[\"last-quarter\", \"phases\", \"cycle-review\", \"decision\"]</\uff5cDSML\uff5cparameter></\uff5cDSML\uff5cinvoke></\uff5cDSML\uff5ctool_calls>`;

  describe('parseDsmlToolCalls', () => {
    it('extracts all 10 update_echo tool calls from production DSML markup', () => {
      const result = parseDsmlToolCalls(sampleLeakedDsml);

      expect(result.hasDsml).toBe(true);
      expect(result.isMalformed).toBe(false);
      expect(result.toolCalls).toHaveLength(10);
      expect(result.cleanContent).toBe('');

      const call1 = result.toolCalls[0];
      expect(call1.function.name).toBe('update_echo');
      const args1 = JSON.parse(call1.function.arguments);
      expect(args1.id).toBe('e1789153595723mkhd');
      expect(args1.tags).toEqual(['momentum', 'stress', 'weight', 'action', 'chauffeur']);

      const call10 = result.toolCalls[9];
      expect(call10.function.name).toBe('update_echo');
      const args10 = JSON.parse(call10.function.arguments);
      expect(args10.id).toBe('e1788439819517bv1y');
      expect(args10.tags).toEqual(['last-quarter', 'phases', 'cycle-review', 'decision']);
    });

    it('extracts tool calls while cleanly preserving surrounding conversational prose', () => {
      const mixed = `I have analyzed your recent reflections and identified meaningful tags based on their content.\n\n${sampleLeakedDsml}\n\nAll tags have been applied.`;
      const result = parseDsmlToolCalls(mixed);

      expect(result.hasDsml).toBe(true);
      expect(result.toolCalls).toHaveLength(10);
      expect(result.cleanContent).toContain('I have analyzed your recent reflections');
      expect(result.cleanContent).toContain('All tags have been applied.');
      expect(result.cleanContent).not.toContain('DSML');
      expect(result.cleanContent).not.toContain('invoke');
    });

    it('handles compact inline invocation syntax', () => {
      const compact = '<|invoke:search_echoes|>{\"untaggedOnly\":true,\"limit\":10}<|/invoke|>';
      const result = parseDsmlToolCalls(compact);

      expect(result.hasDsml).toBe(true);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].function.name).toBe('search_echoes');
      const args = JSON.parse(result.toolCalls[0].function.arguments);
      expect(args.untaggedOnly).toBe(true);
      expect(args.limit).toBe(10);
    });

    it('passes through standard prose without tool calls', () => {
      const standardText = 'Here is a poetic observation about your lunar journey.';
      const result = parseDsmlToolCalls(standardText);

      expect(result.hasDsml).toBe(false);
      expect(result.toolCalls).toHaveLength(0);
      expect(result.cleanContent).toBe(standardText);
    });
  });

  describe('sanitizeProse (Fail-Closed Protocol Invariant)', () => {
    it('completely strips DSML blocks and delimiters from text', () => {
      const sanitized = sanitizeProse(sampleLeakedDsml);
      expect(sanitized).toBe('');
      expect(sanitized).not.toContain('DSML');
      expect(sanitized).not.toContain('invoke');
    });

    it('strips broken or unclosed internal tags without leaking tokens', () => {
      const broken = 'Hello <\uff5cDSML\uff5cinvoke name=\"update_echo\"> unclosed tag and <|tool_calls|> leftover';
      const sanitized = sanitizeProse(broken);

      expect(sanitized).not.toContain('DSML');
      expect(sanitized).not.toContain('<|tool_calls|>');
      expect(sanitized).toContain('Hello');
    });

    it('strips standard XML tool syntax', () => {
      const xmlTools = '<tool_calls><invoke name=\"search_echoes\"><parameter name=\"limit\">5</parameter></invoke></tool_calls>Processed.';
      const sanitized = sanitizeProse(xmlTools);

      expect(sanitized).toBe('Processed.');
    });
  });

  describe('formatFallbackActionReport', () => {
    it('generates a clean human action report for update_echo operations', () => {
      const executedCalls = [
        { tool: 'update_echo', args: { id: 'e1', tags: ['a'] } },
        { tool: 'update_echo', args: { id: 'e2', tags: ['b'] } }
      ];
      const report = formatFallbackActionReport(executedCalls);
      expect(report).toBe('I have updated the tags for 2 recent echoes.');
    });

    it('generates a clean report for loop updates', () => {
      const executedCalls = [
        { tool: 'update_loop', args: { id: 'l1' } }
      ];
      const report = formatFallbackActionReport(executedCalls);
      expect(report).toBe('I have updated 1 loop item.');
    });

    it('generates a fallback message when no tools were executed', () => {
      const report = formatFallbackActionReport([]);
      expect(report).toBe('Your request has been processed.');
    });
  });

  describe('search_echoes untaggedOnly filter', () => {
    it('filters echoes to return only untagged entries', async () => {
      const sampleEchoes = [
        { id: 'e1', text: 'Reflection 1', tags: [], created_at: '2026-09-10T10:00:00Z' },
        { id: 'e2', text: 'Reflection 2', tags: ['work', 'focus'], created_at: '2026-09-10T11:00:00Z' },
        { id: 'e3', text: 'Reflection 3', tags: ['original-voice-echo'], created_at: '2026-09-10T12:00:00Z' },
        { id: 'e4', text: 'Reflection 4', tags: null, created_at: '2026-09-10T13:00:00Z' },
        { id: 'e5', text: 'Reflection 5', tags: ['creative'], created_at: '2026-09-10T14:00:00Z' }
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: sampleEchoes, error: null })
      };

      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_123' } }, error: null }) },
        from: vi.fn().mockReturnValue(mockQueryBuilder)
      };

      const res = await executeTool(mockSupabase, 'search_echoes', { untaggedOnly: true, limit: 10 }, 'user_123');
      const payload = JSON.parse(res.content[0].text);

      expect(mockQueryBuilder.or).toHaveBeenCalledWith(expect.stringContaining('tags.is.null'));
      const returnedIds = payload.items.map(i => i.id);
      expect(returnedIds).toContain('e1');
      expect(returnedIds).toContain('e3');
      expect(returnedIds).toContain('e4');
      expect(returnedIds).not.toContain('e2');
      expect(returnedIds).not.toContain('e5');
    });
  });
});
