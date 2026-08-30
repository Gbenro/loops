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

// 3. Main Bridge Runner
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
      // First ensure session exists
      const envInfo = getEnvironmentInfo();
      const session = await apiCall('/api/dev/sessions', 'POST', {
        issueId,
        agent: 'gemini',
        model: 'gemini-2.5-pro',
        repository: path.basename(process.cwd()),
        branch: envInfo.branch,
        environment: envInfo
      }, activeToken);

      const event = await apiCall(`/api/dev/sessions/${session.id}/events`, 'POST', {
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

  if (command !== 'start') {
    console.log(`
Usage: luna-dev [check|list|get|question|start|login|set-token] [issueId] [options]

Commands:
  check / list             Check assigned development issues from Luna
  get <issueId>            Retrieve complete details, latest session & evidence for an issue
  question <issueId> "..." Post a developer.question to the issue on Development Service
  start [issueId]          Start local ephemeral Dev Bridge RPC on 127.0.0.1:4888
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
  const issueIdArg = paramArg;
  try {
    if (issueIdArg) {
      const res = await apiCall(`/api/dev/issues/${issueIdArg}`, 'GET', null, activeToken);
      targetIssue = res.issue || res;
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

  // Create Dev Session in Cloud Service
  let session = null;
  try {
    session = await apiCall('/api/dev/sessions', 'POST', {
      issueId: activeIssueId,
      agent: 'gemini',
      model: 'gemini-2.5-pro',
      repository: path.basename(process.cwd()),
      branch: envInfo.branch,
      environment: envInfo
    });
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
          const eventsData = await apiCall(`/api/dev/sessions/${session.id}/events?issueId=${activeIssueId}`);
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
              });
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
              });
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
              });
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
              });
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(event));
              return;
            }

            if (pathname === '/complete') {
              const ended = await apiCall(`/api/dev/sessions/${session.id}/end`, 'POST', {
                summary: body.finalSummary || 'Session completed successfully'
              });
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
