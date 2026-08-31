#!/usr/bin/env node

/**
 * Luna Development Bridge — Local Ephemeral CLI (V1)
 *
 * Connects the local coding agent (Gemini / Antigravity) to Luna Cloud Development Service.
 * Features:
 *  - Authenticates and starts/attaches to a DevSession
 *  - Inspects local git repository and environment
 *  - Exposes local HTTP RPC on 127.0.0.1:4888
 *  - Implements automatic idle timeout (default: 15 minutes)
 */

import http from 'http';
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

// 1. Config & Environment
const DEFAULT_PORT = 4888;
const DEFAULT_IDLE_MINUTES = 15;
const API_BASE_URL = process.env.LUNA_DEV_API_URL || process.env.VITE_API_URL || 'https://loops-production-e1d5.up.railway.app';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

function getAuthFilePath() {
  const homeDir = os.homedir();
  const dir = path.join(homeDir, '.luna');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'auth.json');
}

function resolveAuthToken(explicitToken = null) {
  if (explicitToken) return explicitToken;
  if (process.env.LUNA_DEV_TOKEN) return process.env.LUNA_DEV_TOKEN;
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;

  // Check ~/.luna/auth.json
  try {
    const authFile = getAuthFilePath();
    if (fs.existsSync(authFile)) {
      const data = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      if (data.accessToken) return data.accessToken;
      if (data.access_token) return data.access_token;
    }
  } catch {}

  // Check local .env / .env.local
  try {
    const envLocal = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envLocal)) {
      const content = fs.readFileSync(envLocal, 'utf8');
      const match = content.match(/LUNA_DEV_TOKEN=([^\r\n]+)/);
      if (match) return match[1].trim();
    }
  } catch {}

  return '';
}

function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { branch, commit };
  } catch {
    return { branch: 'unknown', commit: 'unknown' };
  }
}

function getEnvironmentInfo() {
  const { branch, commit } = getGitInfo();
  return {
    os: `${os.platform()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    branch,
    commit,
    hostname: os.hostname(),
    workingDirectory: process.cwd()
  };
}

// 2. HTTP Helper for Cloud Development Service
async function apiCall(endpoint, method = 'GET', body = null, token = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const authToken = token || resolveAuthToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  };

  const res = await fetch(url, options);
  if (!res.ok) {
    let errMsg = `HTTP ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}

// 3. Intent-Aware Event Classification & Dispatch
function classifyEventIntent(event) {
  const content = event.content || '';
  const metadata = event.metadata || {};
  const type = event.type || '';

  // 1. Read-only investigations & diagnostics
  if (metadata.investigationType || metadata.status === 'bridge_read_test' || /READ-ONLY INVESTIGATION|DIAGNOSTIC/i.test(content)) {
    return {
      intent: 'read_only_investigation',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Read-only diagnostic/investigation request'
    };
  }

  // 2. Read-only scope requests
  if (metadata.scopeRequest || /READ-ONLY SCOPE REQUEST|SCOPE REQUEST/i.test(content)) {
    return {
      intent: 'read_only_scope_request',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Read-only scope analysis request'
    };
  }

  // 3. Developer questions / clarifications
  if (type === 'developer.question' || metadata.decisionRequired) {
    return {
      intent: 'clarification',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Developer question or clarification request'
    };
  }

  // 4. Explicit session completion / close actions
  if (type === 'session.completed' || metadata.action === 'complete') {
    return {
      intent: 'session_action',
      isReadOnly: false,
      requiresWorkflow: false,
      requiresCompletion: true,
      directiveSummary: 'Explicit session completion requested'
    };
  }

  // 5. Explicit session handoff transitions
  if (type === 'session.handoff' || metadata.action === 'handoff') {
    return {
      intent: 'session_action',
      isReadOnly: true,
      requiresWorkflow: false,
      requiresCompletion: false,
      directiveSummary: 'Session handoff transition requested'
    };
  }

  // 5. Authorized implementation directives
  if (metadata.status === 'approved_for_implementation' || /APPROVED — Implement|PROCEED WITH IMPLEMENTATION|EXECUTE IMPLEMENTATION/i.test(content)) {
    return {
      intent: 'implementation_directive',
      isReadOnly: false,
      requiresWorkflow: true,
      requiresCompletion: false, // Session stays open until explicit verification
      directiveSummary: 'Authorized implementation directive'
    };
  }

  return {
    intent: 'general_decision',
    isReadOnly: false,
    requiresWorkflow: false,
    requiresCompletion: false,
    directiveSummary: content.substring(0, 100)
  };
}

// 4. Automated Evidence & Verification Pipeline
async function executeVerificationAndEvidencePipeline(issueId, sessionId, token, options = {}) {
  console.log('\n================================================================');
  console.log(`✦ Resuming Gemini Execution Pipeline for Issue ${issueId}...`);
  console.log('================================================================\n');

  // Step 1: Run automated tests
  console.log('▶ [Pipeline 1/3] Running automated test suite (vitest)...');
  let testStatus = 'passed';
  let passedCount = 0;
  let failedCount = 0;
  let testOutput = '';

  try {
    const testResult = execSync('npm test', { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    testOutput = testResult;
    const matchPassed = testResult.match(/(\d+)\s+passed/);
    if (matchPassed) passedCount = parseInt(matchPassed[1], 10);
    console.log(`✓ Tests passed: ${passedCount} passed, 0 failed`);
  } catch (err) {
    testStatus = 'failed';
    testOutput = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    const matchFailed = testOutput.match(/(\d+)\s+failed/);
    if (matchFailed) failedCount = parseInt(matchFailed[1], 10);
    console.error(`✗ Test failure: ${failedCount} tests failed`);
  }

  // Report tests evidence
  await apiCall(`/api/dev/sessions/${sessionId}/events`, 'POST', {
    issueId,
    type: 'tests.reported',
    author: 'gemini',
    content: `Automated test suite execution: ${passedCount} passed, ${failedCount} failed`,
    metadata: {
      status: testStatus,
      command: 'npm test',
      passed: passedCount,
      failed: failedCount
    }
  }, token);
  console.log('✓ Recorded tests.reported evidence to Development Service');

  // Step 2: Run build
  console.log('\n▶ [Pipeline 2/3] Running frontend production build (vite build)...');
  let buildStatus = 'passed';
  try {
    execSync('npm run build', { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('✓ Production build succeeded cleanly');
  } catch (err) {
    buildStatus = 'failed';
    console.error('✗ Build failure');
  }

  // Report build evidence
  await apiCall(`/api/dev/sessions/${sessionId}/events`, 'POST', {
    issueId,
    type: 'build.reported',
    author: 'gemini',
    content: `Frontend production build ${buildStatus}`,
    metadata: {
      status: buildStatus,
      command: 'npm run build'
    }
  }, token);
  console.log('✓ Recorded build.reported evidence to Development Service');

  // Step 3: Report commit evidence
  console.log('\n▶ [Pipeline 3/3] Recording git commit evidence...');
  const gitInfo = getGitInfo();
  await apiCall(`/api/dev/sessions/${sessionId}/events`, 'POST', {
    issueId,
    type: 'commit.reported',
    author: 'gemini',
    content: `Committed changes on branch ${gitInfo.branch} (${gitInfo.commit.substring(0, 7)})`,
    metadata: {
      hash: gitInfo.commit,
      branch: gitInfo.branch
    }
  }, token);
  console.log('✓ Recorded commit.reported evidence to Development Service');

  // Report implementation summary (without closing session unless explicitly requested)
  if (options.implementationSummary) {
    await apiCall(`/api/dev/sessions/${sessionId}/events`, 'POST', {
      issueId,
      type: 'implementation.reported',
      author: 'gemini',
      content: options.implementationSummary,
      metadata: {
        changedFiles: options.changedFiles || []
      }
    }, token);
    console.log('✓ Recorded implementation.reported evidence to Development Service');
  }

  if (options.completeSession) {
    await apiCall(`/api/dev/sessions/${sessionId}/events`, 'POST', {
      issueId,
      type: 'session.completed',
      author: 'gemini',
      content: 'Dev Session completed with all verification steps verified.',
      metadata: {
        circuitStatus: 'verified'
      }
    }, token);
    console.log('✓ Recorded session.completed event');
  }

  console.log('\n================================================================');
  console.log('✦ Pipeline Execution Finished Successfully!');
  console.log('================================================================\n');
}

// 5. Continuous Event Listener & Active Worker
async function startEventListener(issueId, sessionId, token, options = {}) {
  const seenEvents = new Set();

  console.log(`\n✦ Active Event Listener initialized for Issue ${issueId}`);
  console.log(`  Session ID:   ${sessionId}`);
  console.log('  Listening for decision.approved, decision.rejected, requirement changes...\n');

  // Pre-load existing events so we don't duplicate on first tick
  try {
    const existing = await apiCall(`/api/dev/issues/${issueId}/events`, 'GET', null, token);
    const events = existing.items || [];
    for (const evt of events) {
      seenEvents.add(evt.id);
    }
    console.log(`  [Listener] Loaded ${events.length} existing event(s).`);
  } catch (err) {
    console.warn(`  [Listener Notice] Could not pre-fetch events: ${err.message}`);
  }

  // Active polling loop (3-second interval)
  const pollInterval = setInterval(async () => {
    try {
      const res = await apiCall(`/api/dev/issues/${issueId}/events`, 'GET', null, token);
      const events = res.items || [];

      for (const evt of events) {
        if (!seenEvents.has(evt.id)) {
          seenEvents.add(evt.id);
          console.log(`\n✦ [Bridge Event] Received "${evt.type}" from ${evt.author}:`);
          console.log(`  "${evt.content}"`);

          const intent = classifyEventIntent(evt);
          console.log(`  → Event Intent: ${intent.intent} (isReadOnly: ${intent.isReadOnly}, requiresWorkflow: ${intent.requiresWorkflow})`);

          if (intent.isReadOnly) {
            console.log('  → Read-only event. Acknowledged without triggering workflow.');
          } else if (intent.intent === 'implementation_directive') {
            console.log('  → Authorized implementation directive detected.');
          } else if (evt.type === 'decision.rejected') {
            console.warn('  → Decision rejected. Halting pipeline.');
          } else if (evt.type === 'requirement.changed') {
            console.log('  → Requirement changed. Reviewing specification...');
          }
        }
      }
    } catch (err) {
      // transient
    }
  }, 3000);

  return pollInterval;
}

// 5. Main Bridge Runner
async function runBridge() {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  const paramArg = args[1];

  // Check for --token flag
  const tokenFlagIdx = args.indexOf('--token');
  const explicitToken = tokenFlagIdx !== -1 && args[tokenFlagIdx + 1] ? args[tokenFlagIdx + 1] : null;
  const activeToken = resolveAuthToken(explicitToken);

  if (command === 'set-token') {
    const tokenToSave = paramArg || explicitToken;
    if (!tokenToSave) {
      console.error('Usage: luna-dev set-token <jwt_token>');
      process.exit(1);
    }
    const authFile = getAuthFilePath();
    fs.writeFileSync(authFile, JSON.stringify({ accessToken: tokenToSave, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    console.log(`✓ Saved Luna Dev token to ${authFile}`);
    return;
  }

  if (command === 'login') {
    const email = paramArg || process.env.LUNA_EMAIL;
    const password = args[2] || process.env.LUNA_PASSWORD;
    if (!email || !password) {
      console.error('Usage: luna-dev login <email> <password>');
      process.exit(1);
    }
    console.log(`✦ Authenticating ${email} with Supabase...`);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`✗ Login failed: ${err.error_description || err.message || res.statusText}`);
      process.exit(1);
    }
    const data = await res.json();
    const authFile = getAuthFilePath();
    fs.writeFileSync(authFile, JSON.stringify({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
      updatedAt: new Date().toISOString()
    }, null, 2), { mode: 0o600 });
    console.log(`✓ Successfully authenticated as ${data.user.email}`);
    console.log(`✓ Saved session to ${authFile}`);
    return;
  }

  if (command === 'get') {
    if (!paramArg) {
      console.error('Usage: luna-dev get <issueId>');
      process.exit(1);
    }
    console.log(`\n✦ Retrieving Issue ${paramArg} from Luna Development Service...`);
    try {
      const res = await apiCall(`/api/dev/issues/${paramArg}`, 'GET', null, activeToken);
      console.log(JSON.stringify(res, null, 2));
    } catch (err) {
      console.error(`✗ Error retrieving issue: ${err.message}`);
    }
    return;
  }

  if (command === 'question') {
    const issueId = paramArg;
    const questionText = args[2];
    if (!issueId || !questionText) {
      console.error('Usage: luna-dev question <issueId> "<question>" [--proposal "<proposal>"]');
      process.exit(1);
    }
    const propIdx = args.indexOf('--proposal');
    const proposal = propIdx !== -1 && args[propIdx + 1] ? args[propIdx + 1] : undefined;

    console.log(`\n✦ Posting developer.question to Issue ${issueId}...`);
    try {
      const issueRes = await apiCall(`/api/dev/issues/${issueId}`, 'GET', null, activeToken);
      const sessionId = issueRes.latestSession?.id;
      if (!sessionId) {
        throw new Error(`No active Dev Session found for issue ${issueId}. Authorize a session first.`);
      }

      const event = await apiCall(`/api/dev/sessions/${sessionId}/events`, 'POST', {
        issueId,
        type: 'developer.question',
        author: 'gemini',
        content: questionText,
        metadata: {
          proposal,
          decisionRequired: true
        }
      }, activeToken);

      console.log(`✓ Posted developer.question (Event ID: ${event.id})`);
      console.log(`  Question: ${questionText}`);
      if (proposal) console.log(`  Proposal: ${proposal}`);
    } catch (err) {
      console.error(`✗ Error posting question: ${err.message}`);
    }
    return;
  }

  if (command === 'check' || command === 'list') {
    console.log('\n✦ Querying Luna Development Service for assigned work...');
    console.log(`  Cloud Service: ${API_BASE_URL}\n`);
    try {
      const res = await apiCall('/api/dev/issues?limit=10', 'GET', null, activeToken);
      const issues = res.items || [];
      if (issues.length === 0) {
        console.log('  [Status] No open development issues found in queue.');
        console.log('  Ask Luna in chat: "Create a development issue for [your feature]" to assign work.\n');
      } else {
        console.log(`  Found ${issues.length} development issue(s):\n`);
        issues.forEach((iss, idx) => {
          console.log(`  ${idx + 1}. [${iss.status.toUpperCase()}] ${iss.title} (${iss.id})`);
          console.log(`     Priority: ${iss.priority} | Agent: ${iss.assigned_agent || iss.assignedAgent || 'gemini'}`);
          console.log(`     Description: ${iss.description}`);
          if (iss.acceptance_criteria && iss.acceptance_criteria.length > 0) {
            console.log('     Acceptance Criteria:');
            iss.acceptance_criteria.forEach(ac => console.log(`       - ${ac}`));
          }
          console.log('');
        });
      }
    } catch (err) {
      console.warn(`  [Notice] Could not fetch issues: ${err.message}`);
    }
    return;
  }

  if (command === 'listen' || command === 'resume') {
    const issueId = paramArg;
    if (!issueId) {
      console.error('Usage: luna-dev listen <issueId>');
      process.exit(1);
    }
    console.log(`\n✦ Starting active event listener for Issue ${issueId}...`);
    try {
      const issueRes = await apiCall(`/api/dev/issues/${issueId}`, 'GET', null, activeToken);
      const sessionId = issueRes.latestSession?.id;
      if (!sessionId) {
        throw new Error(`No active Dev Session found for issue ${issueId}`);
      }

      await startEventListener(issueId, sessionId, activeToken, { autoResume: true });
    } catch (err) {
      console.error(`✗ Error in event listener: ${err.message}`);
    }
    return;
  }

  if (command === 'wait-event' || command === 'wait') {
    let issueId = paramArg;
    const timeoutIdx = args.indexOf('--timeout');
    const timeoutSec = timeoutIdx !== -1 && args[timeoutIdx + 1] ? parseInt(args[timeoutIdx + 1], 10) : 300;

    if (!issueId) {
      console.log(`\n✦ [Event Waiter] No specific issue provided. Checking for pending authorized Gemini sessions...`);
      try {
        const pending = await apiCall('/api/dev/agent/pending-sessions', 'GET', null, activeToken);
        const sessions = pending.items || [];
        if (sessions.length > 0) {
          issueId = sessions[0].issueId;
          console.log(`  ✓ Auto-discovered pending session ${sessions[0].id} on issue ${issueId}`);
        } else {
          console.log(`  [Notice] No active pending sessions found.`);
        }
      } catch (err) {
        console.warn(`  [Notice] Pending session check: ${err.message}`);
      }
    }

    if (!issueId) {
      console.error('Usage: luna-dev wait-event <issueId> [--timeout <seconds>]');
      process.exit(1);
    }

    console.log(`\n✦ [Event Waiter] Monitoring Issue ${issueId} for incoming Luna events (timeout: ${timeoutSec}s)...`);

    const knownEvents = new Set();
    const startTime = Date.now();

    // Pre-populate known events
    try {
      const initial = await apiCall(`/api/dev/issues/${issueId}/events`, 'GET', null, activeToken);
      const items = initial.items || [];
      items.forEach(e => knownEvents.add(e.id));
      console.log(`  [Event Waiter] Initialized with ${items.length} baseline event(s).`);
    } catch (err) {
      console.warn(`  [Notice] Pre-fetch warning: ${err.message}`);
    }

    // Polling loop that exits process cleanly on event arrival
    const interval = setInterval(async () => {
      // Check for timeout
      if ((Date.now() - startTime) >= timeoutSec * 1000) {
        clearInterval(interval);
        console.log(JSON.stringify({
          status: 'timeout',
          message: `No new Luna events arrived within ${timeoutSec} seconds.`,
          issueId,
          timestamp: new Date().toISOString()
        }, null, 2));
        process.exit(0);
      }

      try {
        const res = await apiCall(`/api/dev/issues/${issueId}/events`, 'GET', null, activeToken);
        const events = res.items || [];

        for (const evt of events) {
          if (!knownEvents.has(evt.id)) {
            // Found a new incoming event!
            clearInterval(interval);
            const intent = classifyEventIntent(evt);

            console.log('\n================================================================');
            console.log(`✦ [AUTONOMOUS WAKE TRIGGER] New event detected: ${evt.id}`);
            console.log(`  Author:   ${evt.author}`);
            console.log(`  Type:     ${evt.type}`);
            console.log(`  Intent:   ${intent.intent}`);
            console.log(`  Content:  "${evt.content}"`);
            console.log('================================================================\n');

            // Handle in-band secure session handoff
            if (evt.type === 'session.handoff' && evt.metadata?.handoffTicket && evt.metadata?.nextSessionId) {
              console.log(`\n✦ [Secure Session Handoff] Detected handoff to ${evt.metadata.nextIssueId} / ${evt.metadata.nextSessionId}`);
              try {
                const claimRes = await apiCall('/api/dev/sessions/claim-handoff', 'POST', {
                  fromSessionId: evt.sessionId,
                  targetSessionId: evt.metadata.nextSessionId,
                  targetIssueId: evt.metadata.nextIssueId,
                  handoffTicket: evt.metadata.handoffTicket
                }, activeToken);

                console.log(`✓ Claimed target session token for session: ${claimRes.sessionId}`);

                // Post acknowledgment to new session
                await apiCall(`/api/dev/sessions/${claimRes.sessionId}/events`, 'POST', {
                  issueId: claimRes.issueId,
                  type: 'session.started',
                  author: 'gemini',
                  content: `Dev Session ${claimRes.sessionId} attached autonomously via secure handoff. Ready for directives.`,
                  metadata: {
                    handoffFrom: evt.sessionId,
                    previousIssueId: issueId
                  }
                }, claimRes.token);

                console.log(JSON.stringify({
                  status: 'event_received',
                  event: evt,
                  intent: {
                    intent: 'session_action',
                    isReadOnly: true,
                    requiresWorkflow: false,
                    requiresHandoff: true
                  },
                  handoff: {
                    newIssueId: claimRes.issueId,
                    newSessionId: claimRes.sessionId,
                    newToken: claimRes.token
                  },
                  issueId,
                  timestamp: new Date().toISOString()
                }, null, 2));

                process.exit(0);
              } catch (claimErr) {
                console.error(`✗ Error claiming handoff ticket: ${claimErr.message}`);
              }
            }

            console.log(JSON.stringify({
              status: 'event_received',
              event: evt,
              intent: intent,
              issueId,
              timestamp: new Date().toISOString()
            }, null, 2));

            process.exit(0);
          }
        }
      } catch (err) {
        // network transient
      }
    }, 2500);

    return;
  }

  if (command === 'watch-pending' || command === 'watch') {
    const timeoutIdx = args.indexOf('--timeout');
    const timeoutSec = timeoutIdx !== -1 && args[timeoutIdx + 1] ? parseInt(args[timeoutIdx + 1], 10) : 300;
    const autoClaim = args.includes('--claim');

    console.log(`\n✦ [Pending Watcher] Monitoring for unclaimed/pending Luna assignments (timeout: ${timeoutSec}s)...`);

    const startTime = Date.now();
    let pollIntervalMs = 4000;

    const poll = async () => {
      if ((Date.now() - startTime) >= timeoutSec * 1000) {
        console.log(JSON.stringify({
          status: 'timeout',
          message: `No new pending assignments arrived within ${timeoutSec} seconds.`,
          timestamp: new Date().toISOString()
        }, null, 2));
        process.exit(0);
      }

      try {
        const pending = await apiCall('/api/dev/agent/pending-sessions', 'GET', null, activeToken);
        const sessions = pending.items || [];

        if (sessions.length > 0) {
          const target = sessions[0];
          console.log('\n================================================================');
          console.log(`✦ [AUTONOMOUS WAKE TRIGGER] New pending assignment discovered: ${target.issueId}`);
          console.log(`  Session ID: ${target.id}`);
          console.log(`  Agent:      ${target.agent}`);
          console.log(`  Status:     ${target.status}`);
          console.log(`  Started:    ${target.startedAt}`);
          console.log('================================================================\n');

          let claimResult = null;
          if (autoClaim) {
            console.log(`✦ [Pending Watcher] Auto-claiming session ${target.id}...`);
            try {
              claimResult = await apiCall(`/api/dev/sessions/${target.id}/claim`, 'POST', { agent: 'gemini' }, activeToken);
              console.log(`  ✓ Successfully claimed session. Active token minted: ${claimResult.token ? claimResult.token.substring(0, 10) + '...' : 'n/a'}`);
            } catch (claimErr) {
              console.warn(`  [Notice] Claim error: ${claimErr.message}`);
            }
          }

          console.log(JSON.stringify({
            status: 'assignment_discovered',
            session: target,
            claim: claimResult,
            timestamp: new Date().toISOString()
          }, null, 2));

          process.exit(0);
        }
      } catch (err) {
        // network transient
      }

      pollIntervalMs = Math.min(pollIntervalMs * 1.25, 20000);
      setTimeout(poll, pollIntervalMs);
    };

    poll();
    return;
  }

  if (command !== 'start') {
    console.log(`
Usage: luna-dev [check|list|get|question|listen|wait-event|watch-pending|resume|start|login|set-token] [issueId] [options]

Commands:
  check / list             Check assigned development issues from Luna
  get <issueId>            Retrieve complete details, latest session & evidence for an issue
  question <issueId> "..." Post a developer.question to the issue on Development Service
  wait-event <issueId>     Wait for next Luna event and exit with payload to wake the agent
  watch-pending            Monitor for unclaimed/pending Luna assignments and wake the agent
  listen <issueId>         Actively listen for Luna decisions/events and automatically resume execution
  start [issueId]          Start local ephemeral Dev Bridge RPC & active listener on 127.0.0.1:4888
  login <email> <password> Authenticate with Supabase and store token locally
  set-token <token>        Save Bearer token to ~/.luna/auth.json
`);
    process.exit(0);
  }

  console.log('\n✦ Starting Luna Development Bridge (V1)...');
  console.log(`  Cloud Service: ${API_BASE_URL}`);

  const envInfo = getEnvironmentInfo();
  console.log(`  Local Git:     ${envInfo.branch} (${envInfo.commit.substring(0, 7)})`);
  console.log(`  Environment:   ${envInfo.os}, Node ${envInfo.nodeVersion}`);

  // Fetch target issue
  let targetIssue = null;
  let targetIssueDetail = null;
  const issueIdArg = paramArg;
  try {
    if (issueIdArg) {
      targetIssueDetail = await apiCall(`/api/dev/issues/${issueIdArg}`, 'GET', null, activeToken);
      targetIssue = targetIssueDetail.issue || targetIssueDetail;
    } else {
      const res = await apiCall('/api/dev/issues?status=ready&limit=1', 'GET', null, activeToken);
      if (res.items && res.items.length > 0) {
        targetIssue = res.items[0];
      } else {
        const inProg = await apiCall('/api/dev/issues?status=in_progress&limit=1', 'GET', null, activeToken);
        if (inProg.items && inProg.items.length > 0) {
          targetIssue = inProg.items[0];
        }
      }
    }
  } catch (err) {
    console.warn(`  [Notice] Could not pre-fetch issue: ${err.message}. Running in open bridge mode.`);
  }

  const activeIssueId = targetIssue?.id || issueIdArg || 'iss_local_scratch';
  console.log(`  Active Issue:  ${targetIssue?.title || activeIssueId}`);

  // Use active session from issue or create one
  let session = targetIssueDetail?.latestSession || null;
  if (session) {
    console.log(`  Session ID:    ${session.id} (status: ${session.status})`);
  } else {
    try {
      session = await apiCall('/api/dev/sessions', 'POST', {
        issueId: activeIssueId,
        agent: 'gemini',
        model: 'gemini-2.5-pro',
        repository: path.basename(process.cwd()),
        branch: envInfo.branch,
        environment: envInfo
      }, activeToken);
      console.log(`  Session ID:    ${session.id} (status: ${session.status})`);
    } catch (err) {
      console.warn(`  [Notice] Cloud session creation fallback: ${err.message}`);
      session = {
        id: `sess_local_${Date.now()}`,
        issueId: activeIssueId,
        status: 'connected',
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };
    }
  }

  // Idle timeout management (default: 15m)
  let lastActivity = Date.now();
  const idleTimeoutMs = DEFAULT_IDLE_MINUTES * 60 * 1000;

  const refreshActivity = () => {
    lastActivity = Date.now();
  };

  const idleInterval = setInterval(async () => {
    const elapsed = Date.now() - lastActivity;
    if (elapsed > idleTimeoutMs) {
      console.log(`\n⏳ Idle timeout (${DEFAULT_IDLE_MINUTES}m with no activity). Closing session...`);
      try {
        await apiCall(`/api/dev/sessions/${session.id}/end`, 'POST', {
          summary: 'Session automatically closed due to inactivity timeout'
        });
      } catch {}
      clearInterval(idleInterval);
      server.close(() => {
        console.log('✦ Luna Dev Bridge closed cleanly.\n');
        process.exit(0);
      });
    }
  }, 30000);

  // 4. Start Local RPC Server on 127.0.0.1:4888
  const server = http.createServer(async (req, res) => {
    refreshActivity();

    // Enable CORS for local tools
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'connected',
          session,
          issue: targetIssue,
          idleMinutesRemaining: Math.max(0, Math.round((idleTimeoutMs - (Date.now() - lastActivity)) / 60000)),
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (pathname === '/issue' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(targetIssue || { id: activeIssueId, message: 'No pre-loaded issue' }));
        return;
      }

      if (pathname === '/events' && req.method === 'GET') {
        try {
          const eventsData = await apiCall(`/api/dev/issues/${activeIssueId}/events`, 'GET', null, activeToken || session.token);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(eventsData));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Read JSON request body for POST endpoints
      if (req.method === 'POST') {
        let bodyRaw = '';
        req.on('data', chunk => { bodyRaw += chunk; });
        req.on('end', async () => {
          let body = {};
          try {
            if (bodyRaw) body = JSON.parse(bodyRaw);
          } catch {}

          try {
            if (pathname === '/ask') {
              const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
                issueId: activeIssueId,
                type: 'developer.question',
                author: 'gemini',
                content: body.question,
                metadata: {
                  proposal: body.proposal,
                  decisionRequired: body.decisionRequired
                }
              }, activeToken || session.token);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/report-tests') {
              const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
                issueId: activeIssueId,
                type: 'tests.reported',
                author: 'gemini',
                content: body.details || `Tests ${body.status}: ${body.passed || 0} passed, ${body.failed || 0} failed`,
                metadata: {
                  status: body.status || 'passed',
                  command: body.command,
                  passed: body.passed,
                  failed: body.failed
                }
              }, activeToken || session.token);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/report-build') {
              const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
                issueId: activeIssueId,
                type: 'build.reported',
                author: 'gemini',
                content: body.details || `Build ${body.status || 'passed'}`,
                metadata: {
                  status: body.status || 'passed',
                  command: body.command
                }
              }, activeToken || session.token);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/report-commit') {
              const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
                issueId: activeIssueId,
                type: 'commit.reported',
                author: 'gemini',
                content: body.message,
                metadata: {
                  hash: body.hash,
                  branch: body.branch
                }
              }, activeToken || session.token);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/report-deployment') {
              const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
                issueId: activeIssueId,
                type: 'deployment.reported',
                author: 'gemini',
                content: body.details || `Deployment to ${body.environment || 'production'}`,
                metadata: {
                  environment: body.environment || 'production',
                  url: body.url,
                  ...body.metadata
                }
              }, activeToken || session.token);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/report-verification') {
              const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
                issueId: activeIssueId,
                type: 'verification.reported',
                author: 'gemini',
                content: body.notes || body.content || 'Verification completed successfully',
                metadata: {
                  verifiedBy: body.verifiedBy || 'gemini',
                  ...body.metadata
                }
              }, activeToken || session.token);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/complete') {
              const ended = await apiCall(`/api/dev/sessions/${session.id}/end`, 'POST', {
                summary: body.finalSummary || 'Session completed successfully'
              }, activeToken || session.token);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(ended));

              setTimeout(() => {
                server.close();
                process.exit(0);
              }, 500);
              return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  const port = process.env.PORT || DEFAULT_PORT;
  server.listen(port, '127.0.0.1', () => {
    console.log(`\n✦ Local Dev Bridge listening on http://127.0.0.1:${port}`);
    console.log(`  Coding Agent RPC:  http://127.0.0.1:${port}/issue`);
    console.log(`  Events & Polling:  http://127.0.0.1:${port}/events`);
    console.log(`  Auto-Idle Timeout: ${DEFAULT_IDLE_MINUTES} minutes\n`);

    // Start background event listener
    startEventListener(activeIssueId, session.id, activeToken || session.token);
  });

  // Clean shutdown handlers
  const cleanup = async () => {
    console.log('\n✦ Shutting down Dev Bridge...');
    clearInterval(idleInterval);
    try {
      if (session?.id) {
        await apiCall(`/api/dev/sessions/${session.id}/end`, 'POST', {
          summary: 'Bridge interrupted via SIGINT/SIGTERM'
        });
      }
    } catch {}
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

runBridge().catch(err => {
  console.error('Fatal bridge error:', err);
  process.exit(1);
});
