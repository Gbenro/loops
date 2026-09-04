#!/usr/bin/env node
/**
 * Luna Development Service → AGY Headless Bridge (Compatibility Wrapper)
 * Re-exports and runs the unified multi-harness development worker with defaultAgent: 'agy'.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAuthToken,
  getConversationMapping,
  saveConversationMapping,
  pollAndExecuteNext,
  startDaemonWorker
} from './luna-dev-worker.mjs';
import { AgyHarnessAdapter } from '../src/lib/harnessAdapters.js';

export {
  getAuthToken,
  getConversationMapping,
  saveConversationMapping,
  pollAndExecuteNext,
  startDaemonWorker
};

export async function runAgyHeadless(options) {
  const adapter = new AgyHarnessAdapter();
  return adapter.executeTask(options);
}

// ─── Direct CLI Entrypoint ────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  startDaemonWorker({ workspaceDir: process.cwd(), forceAgent: 'agy' }).catch(err => {
    console.error(`[Luna AGY Bridge] Fatal error: ${err.message}`);
    process.exit(1);
  });
}
