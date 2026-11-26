/** Prepare a spoken copy; never modify the displayed or stored message. */
export function prepareChatSpeech(raw: string, recordIds: readonly string[] = []): string {
  let text = raw || '';
  // Explicit citation wrappers are metadata, not part of the prose.
  text = text.replace(/\[(?:Ref|Field):[^\]]*\]/gi, '').replace(/\[\d+\]/g, '');
  for (const id of new Set(recordIds)) {
    if (id.length < 8 || !/[a-z]/i.test(id)) continue;
    const escaped = id.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp('(^|[^\\w-])'+escaped+'(?![\\w-])','g'),'$1');
  }
  text = text
    // Classic Echo IDs: e + millisecond timestamp + random suffix.
    .replace(/\be\d{13}[a-z0-9]{4,10}\b/gi, '')
    // New Field records can use a UUID, optionally with a record-type prefix.
    .replace(/\b(?:(?:echo|loop|thread|reflection|message)-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/gi, '')
    .replace(/\([^a-z0-9]*\)|\[[^a-z0-9]*\]/gi, '')
    .replace(/\*\(Note: Served via[^)]*\)\*/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\x60{3}[\s\S]*?\x60{3}/g, '')
    .replace(/\x60([^\x60]+)\x60/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d{1,3}[.)])\s+/gm, '')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +| +$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}
