/**
 * DSML and Tool-Call Protocol Parser & Fail-Closed Sanitizer
 * 
 * Specifically handles DeepSeek DSML tool calling markup (<｜DSML｜tool_calls>,
 * <invoke name="...">, etc.) and ensures raw internal protocol tokens never leak
 * to user-facing prose.
 */

export interface ParsedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string of arguments
  };
}

export interface DsmlParseResult {
  toolCalls: ParsedToolCall[];
  cleanContent: string;
  hasDsml: boolean;
  isMalformed: boolean;
}

/**
 * Normalizes full-width and alternative pipe characters to standard ASCII pipe
 * for reliable pattern matching.
 */
function normalizeDelimiters(text: string): string {
  if (!text) return '';
  // Replace Unicode full-width vertical bar \uff5c (｜) with standard |
  return text.replace(/\uff5c/g, '|');
}

/**
 * Detects and extracts tool calls embedded in model output text (e.g. DeepSeek DSML).
 */
export function parseDsmlToolCalls(rawContent: string): DsmlParseResult {
  if (!rawContent || typeof rawContent !== 'string') {
    return { toolCalls: [], cleanContent: '', hasDsml: false, isMalformed: false };
  }

  const normalized = normalizeDelimiters(rawContent);

  // Check for presence of DSML or XML-like tool-call blocks
  const hasDsmlIndicator = 
    /<\|DSML\|tool_calls>|<tool_calls>|<\|tool_calls\|>/i.test(normalized) ||
    /<\|DSML\|invoke|<invoke\s+name=|<\|invoke:/i.test(normalized);

  if (!hasDsmlIndicator) {
    return {
      toolCalls: [],
      cleanContent: rawContent,
      hasDsml: false,
      isMalformed: false
    };
  }

  const toolCalls: ParsedToolCall[] = [];
  let isMalformed = false;
  let callIndex = 1;

  // 1. Match <invoke name="..."> or <|DSML|invoke name="..."> blocks
  const invokeRegex = /<(?:\|DSML\|)?invoke\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/(?:\|DSML\|)?invoke>/gi;
  let match: RegExpExecArray | null;

  while ((match = invokeRegex.exec(normalized)) !== null) {
    const toolName = match[1].trim();
    const body = match[2];

    const args: Record<string, any> = {};

    // Pattern A: <parameter name="..." string="...">value</parameter>
    const paramRegex = /<(?:\|DSML\|)?parameter\s+name=["']([^"']+)["'](?:\s+string=["']([^"']+)["'])?\s*>([\s\S]*?)<\/(?:\|DSML\|)?parameter>/gi;
    let paramMatch: RegExpExecArray | null;
    let foundParams = false;

    while ((paramMatch = paramRegex.exec(body)) !== null) {
      foundParams = true;
      const paramName = paramMatch[1].trim();
      const isExplicitString = paramMatch[2]?.toLowerCase() === 'true';
      const rawVal = paramMatch[3].trim();

      if (isExplicitString) {
        args[paramName] = rawVal;
      } else {
        try {
          // Attempt JSON parse for arrays, objects, booleans, numbers
          args[paramName] = JSON.parse(rawVal);
        } catch {
          // Fallback to string if not valid JSON
          args[paramName] = rawVal;
        }
      }
    }

    // Pattern B: <parameters> { ... } </parameters> or direct JSON body
    if (!foundParams) {
      const trimmedBody = body.replace(/<\/?parameters>/gi, '').trim();
      if (trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmedBody);
          Object.assign(args, parsed);
          foundParams = true;
        } catch {
          isMalformed = true;
        }
      }
    }

    if (toolName) {
      toolCalls.push({
        id: `call_dsml_${Date.now()}_${callIndex++}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(args)
        }
      });
    }
  }

  // 2. Also support compact inline style: <|invoke:tool_name|>{"key":"val"}<|/invoke|>
  const compactRegex = /<\|invoke:([^|>]+)\|>\s*(\{[\s\S]*?\})\s*<\|\/invoke\|>/gi;
  let compactMatch: RegExpExecArray | null;
  while ((compactMatch = compactRegex.exec(normalized)) !== null) {
    const toolName = compactMatch[1].trim();
    try {
      const args = JSON.parse(compactMatch[2].trim());
      toolCalls.push({
        id: `call_dsml_compact_${Date.now()}_${callIndex++}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(args)
        }
      });
    } catch {
      isMalformed = true;
    }
  }

  // 3. Extract and sanitize clean text outside tool calls
  const clean = sanitizeProse(rawContent);

  if (toolCalls.length === 0 && hasDsmlIndicator) {
    isMalformed = true;
  }

  return {
    toolCalls,
    cleanContent: clean,
    hasDsml: true,
    isMalformed
  };
}

/**
 * Fail-closed sanitizer: ensures internal protocol markup, XML tags, or DSML delimiters
 * can NEVER be rendered or persisted as normal user-facing prose.
 */
export function sanitizeProse(content: string): string {
  if (!content || typeof content !== 'string') return '';

  return content
    // Strip complete DSML and tool-call blocks first
    .replace(/<[\uff5c|]DSML[\uff5c|]tool_calls>[\s\S]*?<\/[\uff5c|]DSML[\uff5c|]tool_calls>/gi, '')
    .replace(/<tool_calls>[\s\S]*?<\/tool_calls>/gi, '')
    .replace(/<[\uff5c|]tool_calls[\uff5c|]>[\s\S]*?<\/[\uff5c|]tool_calls[\uff5c|]>/gi, '')
    .replace(/<[\uff5c|]?(?:DSML[\uff5c|])?invoke\b[\s\S]*?<\/[\uff5c|]?(?:DSML[\uff5c|])?invoke>/gi, '')
    .replace(/<[\uff5c|]invoke:[^|>]+[\uff5c|]>[\s\S]*?<[\uff5c|]\/invoke[\uff5c|]>/gi, '')
    // Also strip any dangling open/close tags
    .replace(/<[\uff5c|]DSML[\uff5c|][^>]*>/gi, '')
    .replace(/<\/[\uff5c|]DSML[\uff5c|][^>]*>/gi, '')
    .replace(/<[\uff5c|]?(?:DSML[\uff5c|])?invoke\b[^>]*>/gi, '')
    .replace(/<\/[\uff5c|]?(?:DSML[\uff5c|])?invoke>/gi, '')
    .replace(/<[\uff5c|]?(?:DSML[\uff5c|])?parameter\b[^>]*>[\s\S]*?<\/[\uff5c|]?(?:DSML[\uff5c|])?parameter>/gi, '')
    .replace(/<[\uff5c|]?(?:DSML[\uff5c|])?parameter\b[^>]*>/gi, '')
    .replace(/<\/[\uff5c|]?(?:DSML[\uff5c|])?parameter>/gi, '')
    .replace(/<[\uff5c|]?tool_calls[\uff5c|]?>/gi, '')
    .replace(/<\/[\uff5c|]?tool_calls[\uff5c|]?>/gi, '')
    .replace(/<[\uff5c|]invoke:[^>]+[\uff5c|]>/gi, '')
    .replace(/<[\uff5c|]\/invoke[\uff5c|]>/gi, '')
    // Strip standalone DeepSeek special tokens like <|...|>
    .replace(/<[\uff5c|][^>]+[\uff5c|]>/g, '')
    // Collapse excess whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generates a clean human-facing report summarizing executed tool actions
 * if the model only emitted tool calls without conversational prose.
 */
export function formatFallbackActionReport(toolCallsTracked: any[]): string {
  if (!toolCallsTracked || toolCallsTracked.length === 0) {
    return 'Your request has been processed.';
  }

  const echoUpdates = toolCallsTracked.filter(t => t.tool === 'update_echo' || t.name === 'update_echo');
  if (echoUpdates.length > 0) {
    return `I have updated the tags for ${echoUpdates.length} recent echo${echoUpdates.length === 1 ? '' : 'es'}.`;
  }

  const loopUpdates = toolCallsTracked.filter(t => t.tool?.includes('loop') || t.name?.includes('loop'));
  if (loopUpdates.length > 0) {
    return `I have updated ${loopUpdates.length} loop item${loopUpdates.length === 1 ? '' : 's'}.`;
  }

  return `Completed ${toolCallsTracked.length} action${toolCallsTracked.length === 1 ? '' : 's'}.`;
}
