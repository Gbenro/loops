/**
 * deduplicateArchive.ts
 *
 * Migration script that collapses duplicate session wrappers, guarantees that
 * every historical run ID has exactly one authoritative archived record, segregates
 * test fixtures, and generates an idempotent catalog.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runDeduplicationMigration(customArchiveDir?: string): {
  collapsedSessionsCount: number;
  prunedEphemeralRunsCount: number;
  authoritativeRunsCount: number;
  authoritativeSessionsCount: number;
} {
  const archiveDir = customArchiveDir || path.resolve(__dirname, '../../data/lab_archive');
  const sessionsDir = path.join(archiveDir, 'sessions');
  const runsDir = path.join(archiveDir, 'runs');
  const fixturesRunsDir = path.join(archiveDir, 'fixtures', 'runs');

  if (!fs.existsSync(fixturesRunsDir)) {
    fs.mkdirSync(fixturesRunsDir, { recursive: true });
  }

  const CANONICAL_SESSIONS: Record<string, any> = {
    sess_lab_canonical_benchmark: {
      id: 'sess_lab_canonical_benchmark',
      name: 'Luna Attention V1 Canonical Benchmark',
      description: 'Systematic comparison of Control (A), Broad Baseline (B), and Attention Engine V1 (C) across 25 question classes.',
      hypothesis: 'Attention Engine V1 achieves >85% grounding with <10% false connection risk and superior longitudinal temporal span compared to Control and Broad baselines.',
      status: 'completed',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-12T19:00:00.000Z',
      runIds: [
        'run_1789211082230_cal8',
        'run_1789254192740_a4az',
        'run_1789261534197_ue8l'
      ],
      metadata: {
        canonical: true,
        description: 'Authoritative canonical benchmark session containing historical V1, V1.1, and V1.2 baselines.'
      }
    },
    sess_lab_exp001: {
      id: 'sess_lab_exp001',
      name: 'Experiment 001',
      description: 'Controlled Attention Lab A/B/C comparison using the same benchmark question, Field snapshot/evidence, model, and parameters across Production/control retrieval, Broad-context retrieval, and Attention Engine V1.',
      hypothesis: 'Attention Engine V1 improves grounding and longitudinal evidence selection versus production/control and broad-context retrieval without changing model intelligence.',
      status: 'paused',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      pausedAt: '2026-09-12T18:00:00.000Z',
      pauseReason: 'Paused pending Attention Lab experiment integrity verification (Gate 1: Provenance, Gate 2: Model Identity, Gate 3: Verbatim A/B/C outputs).',
      runIds: [],
      metadata: {
        canonical: true,
        immutableBaseline: true
      }
    },
    sess_lab_1789265353670_i3w74: {
      id: 'sess_lab_1789265353670_i3w74',
      name: 'Attention V1.3 — Domain-Aware Semantic Qualification (iss_1789263237926_2e3q)',
      description: 'Attention Lab verification session demonstrating domain qualification, DEV contamination rejection, and longitudinal coverage.',
      hypothesis: 'Attention Engine V1.3 classifies records into semantic domains, rejects dev/system records for personal lived experience questions, resolves polysemy, and admits dev records for builder inquiries.',
      status: 'completed',
      createdAt: '2026-09-13T01:55:53.670Z',
      updatedAt: '2026-09-13T02:35:00.000Z',
      runIds: [
        'run_1789265419630_lue4',
        'run_1789266756354_inwn'
      ],
      metadata: {
        issueId: 'iss_1789263237926_2e3q',
        version: 'v1.3'
      }
    }
  };

  const AUTHORITATIVE_RUN_SESSION_MAP: Record<string, string> = {
    run_1789211082230_cal8: 'sess_lab_canonical_benchmark',
    run_1789254192740_a4az: 'sess_lab_canonical_benchmark',
    run_1789261534197_ue8l: 'sess_lab_canonical_benchmark',
    run_1789265419630_lue4: 'sess_lab_1789265353670_i3w74',
    run_1789266756354_inwn: 'sess_lab_1789265353670_i3w74'
  };

  const KNOWN_TEST_FIXTURE_RUN_IDS = new Set([
    'run_test_01',
    'run_allowed_02',
    'run_blocked_01',
    'run_test_v13_mock_immutability',
    'run_v13_heavy_test'
  ]);

  let collapsedSessionsCount = 0;
  let prunedEphemeralRunsCount = 0;

  // 1. Process runs
  if (fs.existsSync(runsDir)) {
    const runFiles = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));
    for (const file of runFiles) {
      const rf = path.join(runsDir, file);
      try {
        const raw = fs.readFileSync(rf, 'utf-8');
        const runData = JSON.parse(raw);
        const rid = runData.runId || file.replace('.json', '');

        if (AUTHORITATIVE_RUN_SESSION_MAP[rid]) {
          runData.sessionId = AUTHORITATIVE_RUN_SESSION_MAP[rid];
          fs.writeFileSync(rf, JSON.stringify(runData, null, 2), 'utf-8');
        } else if (KNOWN_TEST_FIXTURE_RUN_IDS.has(rid)) {
          runData.isTestFixture = true;
          const fixtureTarget = path.join(fixturesRunsDir, file);
          fs.writeFileSync(fixtureTarget, JSON.stringify(runData, null, 2), 'utf-8');
          fs.writeFileSync(rf, JSON.stringify(runData, null, 2), 'utf-8');
        } else {
          // Ephemeral test run
          fs.unlinkSync(rf);
          prunedEphemeralRunsCount++;
        }
      } catch (err) {
        console.warn('[Migration] Error processing run file:', file, err);
      }
    }
  }

  // 2. Process sessions
  if (fs.existsSync(sessionsDir)) {
    const sessFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    for (const file of sessFiles) {
      const sid = file.replace('.json', '');
      if (CANONICAL_SESSIONS[sid]) {
        continue;
      }
      // Collapse duplicate wrapper
      const sf = path.join(sessionsDir, file);
      fs.unlinkSync(sf);
      collapsedSessionsCount++;
    }
  }

  // 3. Write canonical sessions
  for (const [sid, sdata] of Object.entries(CANONICAL_SESSIONS)) {
    const starget = path.join(sessionsDir, `${sid}.json`);
    fs.writeFileSync(starget, JSON.stringify(sdata, null, 2), 'utf-8');
  }

  // 4. Write catalog.json
  const catalogSessions = Object.values(CANONICAL_SESSIONS).map(sdata => {
    const runs = sdata.runIds || [];
    const latestRid = runs.length > 0 ? runs[runs.length - 1] : undefined;
    return {
      id: sdata.id,
      name: sdata.name,
      description: sdata.description,
      hypothesis: sdata.hypothesis,
      status: sdata.status,
      createdAt: sdata.createdAt,
      updatedAt: sdata.updatedAt,
      runCount: runs.length,
      latestRunId: latestRid,
      latestRunTimestamp: latestRid ? sdata.updatedAt : undefined,
      metadata: sdata.metadata || {}
    };
  });

  const catalogPayload = {
    archiveVersion: '2.0.0',
    updatedAt: new Date().toISOString(),
    totalSessions: catalogSessions.length,
    sessions: catalogSessions
  };

  fs.writeFileSync(path.join(archiveDir, 'catalog.json'), JSON.stringify(catalogPayload, null, 2), 'utf-8');

  return {
    collapsedSessionsCount,
    prunedEphemeralRunsCount,
    authoritativeRunsCount: Object.keys(AUTHORITATIVE_RUN_SESSION_MAP).length,
    authoritativeSessionsCount: Object.keys(CANONICAL_SESSIONS).length
  };
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('deduplicateArchive.ts')) {
  const result = runDeduplicationMigration();
  console.log('[Migration Completed]:', result);
}
