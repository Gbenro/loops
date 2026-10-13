# Luna Loops — Codex Development & Architecture Guide

Welcome, Codex. This document outlines everything you need to navigate, develop, test, and synchronize the Luna Loops codebase alongside the Luna Dev Bridge and other AI agents.

---

## 1. Workspace & Architecture Overview

* **Repository Root (WSL/Linux)**: `/home/ben/.openclaw/workspace/loops-app`
* **Windows UNC Path (from Windows IDE / Codex)**: `\\wsl$\Ubuntu\home\ben\.openclaw\workspace\loops-app`
* **Native Android Project (Windows)**: `C:\Users\Ben\loops-app-android`
* **Git Remote**: `https://github.com/Gbenro/loops.git` (Active branch: `main`)

### Key Components
1. **Frontend (Web & PWA/Capacitor)**:
   - Built with React 18, Vite 5, Tailwind/CSS variables.
   - Code is in `src/` (tabs, components, hooks, storage layer in `src/lib/storage.js`).
2. **Backend & MCP Server**:
   - Express + TypeScript service in `mcp-server/`.
   - Hosted on Railway: `https://loops-production-e1d5.up.railway.app`.
   - Core files: `mcp-server/src/server.ts`, `commandCenter.ts`, `devBridge.ts`, `voice.ts`, `chat.ts`, `tools.ts`.
3. **Database & Storage**:
   - Supabase PostgreSQL: `https://eyxvsbqyzeodsjajfqsj.supabase.co`.
   - Tables: `loops`, `echoes`, `echo_reflections`, `chat_sessions`, `chat_messages`, `chat_telemetry`, `dev_issues`, `dev_events`, `dev_sessions`.

---

## 2. Standing Engineering Principles

All AI agents (Codex, Gemini, Claude) adhere to these non-negotiable rules:
1. **Preserve Verified Working Behavior**: Never replace or broadly refactor a working system merely because a cleaner architecture is imaginable.
2. **Smallest Additive/Corrective Change**: Prefer targeted, minimal, evidence-backed patches that solve the demonstrated defect.
3. **Run Regression Tests Before Committing**: Run Vitest suite (`npm test`) and ensure zero regressions.
4. **Build TypeScript for MCP Server**: Always run `cd mcp-server && npm run build` when touching `mcp-server/src/`.
5. **Sync Android Native on Frontend Changes**:
   Whenever frontend files in `src/`, `public/`, or `index.html` are modified, run:
   ```bash
   npm run cap:win-sync
   ```
   This compiles Vite assets and mirrors them to `C:\Users\Ben\loops-app-android`.

---

## 3. Tooling & Common Commands

Run these inside `/home/ben/.openclaw/workspace/loops-app`:

| Action | Command |
| :--- | :--- |
| **Start Frontend Dev Server** | `npm run dev` (runs on `http://localhost:5173`) |
| **Run Unit / Integration Tests** | `./node_modules/.bin/vitest run` or `npm test` |
| **Run Specific Test** | `./node_modules/.bin/vitest run src/lib/<testName>.test.js` |
| **Build MCP Server (TypeScript)** | `cd mcp-server && npm run build` |
| **Sync to Windows Android Native** | `npm run cap:win-sync` |
| **Start Local Dev Bridge Daemon** | `npm run dev-bridge` (runs on `http://127.0.0.1:4888`) |

---

## 4. Luna Dev Bridge Integration

The Luna Dev Bridge coordinates task execution and issue tracking between AI agents and production:

### Connection Coordinates
* **Production API Base**: `https://loops-production-e1d5.up.railway.app`
* **Discovery Key**: `dsc_4ba5b063659f5fd48d341fd55d3e2bcc3a8d2a294bbd2c1d`
* **OpenAPI Specs**:
  - Dev Bridge: `https://loops-production-e1d5.up.railway.app/openapi-dev.json`
  - Command Center: `https://loops-production-e1d5.up.railway.app/openapi-command-center.json`

### Option A: Local Dev Bridge CLI Daemon
Run `npm run dev-bridge` in terminal. It starts a local HTTP bridge on `http://127.0.0.1:4888`:
- `GET http://127.0.0.1:4888/status` — Current connected session & issue
- `GET http://127.0.0.1:4888/issue` — Active target issue details
- `POST http://127.0.0.1:4888/report-tests` — `{ "status": "passed", "command": "npm test", "passed": 51, "failed": 0 }`
- `POST http://127.0.0.1:4888/report-build` — `{ "status": "passed", "command": "npm run build" }`
- `POST http://127.0.0.1:4888/report-commit` — `{ "message": "feat: ...", "hash": "..." }`
- `POST http://127.0.0.1:4888/complete` — `{ "finalSummary": "Completed task..." }`

### Option B: Direct HTTP Gateway (`/api/luna/command-center/dev`)
Send JSON requests with header `Authorization: Bearer dsc_4ba5b063659f5fd48d341fd55d3e2bcc3a8d2a294bbd2c1d`:
* **List Issues**:
  `POST /api/luna/command-center/dev` with `{ "action": "dev.issues.list", "limit": 10 }`
* **Get Issue**:
  `POST /api/luna/command-center/dev` with `{ "action": "dev.issues.get", "id": "iss_..." }`
* **Update Status**:
  `POST /api/luna/command-center/dev` with `{ "action": "dev.issues.update_status", "id": "iss_...", "status": "awaiting_acceptance" }`
* **Post Lifecycle Event**:
  `POST /api/luna/command-center/dev` with `{ "action": "dev.events.post", "issueId": "iss_...", "type": "developer.implementation_reported", "message": "..." }`

---

## 5. Recent Work & State of the Codebase

1. **Voice / Speech Rendering**:
   - Streamlined sentence/clause chunking to 400 characters max in `src/lib/useLunaVoicePlayback.js` for instant start and background prefetching.
   - Stripped citations (`[Ref: ...]`, `[Field: ...]`, `[\d+]`) from TTS audio synthesis in `mcp-server/src/voice.ts`.
2. **Reflection Persistence & Readback Fix (`iss_1791421493797_4ku7`)**:
   - Fixed `src/lib/storage.js` query filters to allow `co-created` / `conversation_reflection` items to display in the Luna client upon refresh.
   - Unified `reflections.get` in `mcp-server/src/commandCenter.ts` and `tools.ts` to query `echoes` as well as `echo_reflections`.
   - Issue status currently: `awaiting_acceptance`.
3. **Attention Engine V1/V2**:
   - Dynamic obligation coverage, grounded Field citation resolution, and bounded telemetry inspection (`chat.get_inference_trace`).

---

## 6. How to Pick Up Where We Left Off

1. Open `/home/ben/.openclaw/workspace/loops-app` (or `\\wsl$\Ubuntu\home\ben\.openclaw\workspace\loops-app` in Windows).
2. Check `git status` and pull `origin main`.
3. Inspect pending Dev issues using `POST /api/luna/command-center/dev` (`dev.issues.list`) or `npm run dev-bridge`.
4. Implement changes adhering to the Standing Engineering Principles.
5. Verify tests and build:
   ```bash
   npm test
   cd mcp-server && npm run build
   ```
6. Sync to Android if frontend modified:
   ```bash
   npm run cap:win-sync
   ```
7. Commit, push, and update issue status / events on the Dev Bridge.
