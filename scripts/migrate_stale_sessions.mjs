#!/usr/bin/env node
/**
 * Controlled Stale Session Audit & Migration
 * Implements Section 11 of Luna Watcher: reliable task execution specification.
 * Audits historical abandoned 'working' sessions without bulk-resetting completed/accepted work.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.LUNA_API_URL || 'https://loops-production-e1d5.up.railway.app';
const AUTH_FILE = path.join(process.env.HOME || '/home/ben', '.luna/auth.json');

function getAuthToken() {
  if (process.env.LUNA_DEV_TOKEN) return process.env.LUNA_DEV_TOKEN;
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      const token = auth.discoveryToken || auth.token;
      if (token) return token;
    } catch {}
  }
  throw new Error(`Authentication token not found in ${AUTH_FILE} or LUNA_DEV_TOKEN env.`);
}

async function main() {
  const token = getAuthToken();
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== LUNA CONTROLLED SESSION MIGRATION & AUDIT ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('API Base: ', API_BASE);
  console.log('Mode:     ', dryRun ? 'DRY-RUN (audit only)' : 'LIVE RECONCILIATION');

  // 1. Fetch current queue state
  const queueRes = await fetch(`${API_BASE}/api/dev/queue`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!queueRes.ok) {
    throw new Error(`Failed to fetch queue: HTTP ${queueRes.status} ${await queueRes.text()}`);
  }
  const queueData = await queueRes.json();
  const queueItems = queueData.items || [];
  console.log(`\nTotal items in dev queue: ${queueItems.length}`);
  console.log('Current Queue Summary:', JSON.stringify(queueData.summary, null, 2));

  // 2. Identify items marked 'working'
  const workingItems = queueItems.filter(i => i.status === 'working');
  console.log(`\nItems currently showing as 'working': ${workingItems.length}`);

  const auditedRecords = [];

  for (const item of workingItems) {
    const issueRes = await fetch(`${API_BASE}/api/dev/issues/${item.issueId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!issueRes.ok) continue;
    const issueDetail = await issueRes.json();
    const issue = issueDetail.issue || issueDetail;
    const sessions = issueDetail.sessions || [];
    const latestSession = sessions[0] || (item.currentSessionId ? { id: item.currentSessionId } : null);

    const startedAt = item.handoffTimestamps?.workingAt || issue.created_at;
    const ageHours = Math.round((Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60));

    // Audit classification: Is this a stale historical session (> 24 hours old)?
    const isStale = ageHours > 24;

    const record = {
      issueId: item.issueId,
      title: item.title,
      priority: item.priority,
      status: item.status,
      sessionId: latestSession?.id || null,
      startedAt,
      ageHours,
      action: isStale ? 'reconcile_end_session' : 'preserve_recent_work'
    };
    auditedRecords.push(record);

    console.log(`- ${item.issueId}: "${item.title.slice(0, 45)}" (Age: ${ageHours}h, Session: ${record.sessionId}) -> ${record.action}`);

    if (isStale && !dryRun && record.sessionId) {
      try {
        const endRes = await fetch(`${API_BASE}/api/dev/sessions/${record.sessionId}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason: 'stale_session_audit_migration_v1' })
        });
        if (endRes.ok) {
          console.log(`  ✓ Ended stale session ${record.sessionId}`);
        } else {
          console.warn(`  ✗ Failed to end session: HTTP ${endRes.status}`);
        }
      } catch (err) {
        console.warn(`  ✗ Error ending session: ${err.message}`);
      }
    }
  }

  // 3. Save audit export
  const auditPath = path.join(process.cwd(), 'scripts', 'stale_sessions_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    auditedCount: auditedRecords.length,
    records: auditedRecords
  }, null, 2));
  console.log(`\nAudit log saved to: ${auditPath}`);

  // 4. Fetch updated queue state to report effect
  if (!dryRun) {
    const updatedQueueRes = await fetch(`${API_BASE}/api/dev/queue`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (updatedQueueRes.ok) {
      const updatedData = await updatedQueueRes.json();
      console.log('\nUpdated Queue Summary after migration:');
      console.log(JSON.stringify(updatedData.summary, null, 2));
      console.log('Next Eligible Issue:', updatedData.nextEligibleIssueId);
    }
  }
}

main().catch(err => {
  console.error('Fatal Migration Error:', err.message);
  process.exit(1);
});
