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
const AUTH_TOKEN = process.env.LUNA_DEV_TOKEN || process.env.VITE_SUPABASE_ANON_KEY || '';

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
async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
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
  const command = args[0] || 'start';
  const issueIdArg = args[1];

  if (command !== 'start') {
    console.log(`
Usage: luna-dev start [issueId] [--port 4888] [--idle-timeout 15]

Commands:
  start [issueId]   Start local ephemeral Dev Bridge for the given or latest issue
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
  try {
    if (issueIdArg) {
      const res = await apiCall(`/api/dev/issues/${issueIdArg}`);
      targetIssue = res.issue || res;
    } else {
      const res = await apiCall('/api/dev/issues?status=ready&limit=1');
      if (res.items && res.items.length > 0) {
        targetIssue = res.items[0];
      } else {
        const inProg = await apiCall('/api/dev/issues?status=in_progress&limit=1');
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
