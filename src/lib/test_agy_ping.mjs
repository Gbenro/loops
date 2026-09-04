import { AgyHarnessAdapter } from './harnessAdapters.js';

async function main() {
  console.log('Testing direct AgyHarnessAdapter execution...');
  const adapter = new AgyHarnessAdapter();
  const prompt = `Minimal production acceptance test of AGY after the harness-neutral worker refactor from commit c42b6b2. Do not modify repository files. Route this task specifically through the AGY runtime adapter, not DSH. Respond with exactly: AGY post-refactor ping received successfully.`;

  const result = await adapter.executeTask({
    prompt,
    workspaceDir: '/home/ben/.openclaw/workspace/loops-app'
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
