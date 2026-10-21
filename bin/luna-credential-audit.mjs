#!/usr/bin/env node
// Offline audit. Never emits matching credential text or rewrites history.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
const pattern = '(dsc_|dtk_)[A-Za-z0-9_-]{16,}';
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const matches = [];
const scan = (text, context) => {
  for (const line of text.split('\n')) {
    for (const match of line.matchAll(new RegExp(pattern, 'g'))) {
      matches.push({ ...context, fingerprint: createHash('sha256').update(match[0]).digest('hex').slice(0, 16), kind: match[0].startsWith('dsc_') ? 'discovery' : 'session' });
    }
  }
};
for (const file of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
  if (!/\.(?:md|ts|js|jsx|mjs|json|ya?ml|env|txt)$/i.test(file) || !fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => scan(line, { location: 'working-tree', file, line: index + 1, fixture: /test|spec/i.test(file) }));
}
const commits = git(['log', '--all', '--format=%H', '-G', pattern, '--', '.']).trim().split('\n').filter(Boolean);
for (const commit of new Set(commits)) {
  const diff = git(['show', '--format=', '--unified=0', commit, '--', '.']);
  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (/^[+-](?![+-])/.test(line)) scan(line, { location: 'history-diff', commit, file, fixture: /test|spec/i.test(file) });
  }
}
console.log(JSON.stringify({ historyCommitsExamined: new Set(commits).size, matches, warning: 'Fingerprints only. Historical exposure remains until approved credential rotation; no history was rewritten.' }, null, 2));
