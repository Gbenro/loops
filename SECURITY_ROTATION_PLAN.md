# Luna Development Coordination — Security Rotation & Rollout Plan

**Document Version:** 2.1.0  
**Target Issue:** `iss_1792189315472_sdtm`  
**Handshake ID:** `LUNA-FOUR-AGENT-20261022`  
**Status:** Staging Preparation Complete — Blockers Resolved — Awaiting Human Production Authorization

---

## 1. Consumer & Credential Inventory

| Environment Variable / Secret | Affected Consumers | Role & Purpose | Health / Failure Boundary |
| :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Server (`mcp-server/src/server.ts`, `db.ts`, `devBridge.ts`, `attentionLab.ts`) | Administrative DB operations, ephemeral session token validation (`dtk_`), asset mirroring, and event logging after anonymous RLS removal. | Verified via `GET /status` field `privilegedDiscoveryConfigured: true`. If missing or invalid, fails closed with HTTP 503 for development operations. |
| `OPENROUTER_API_KEY` | Backend Server (`mcp-server/src/openrouter.ts`, `src/lib/openrouterClient.js`) | LLM model routing and chat completions for Luna direct chat. | Fails closed on model inference; Dev Bridge and coordination completely unaffected. |
| `LUNA_DEV_DISCOVERY_KEY` | Worktree Developer CLIs (`bin/luna-dev.mjs`, `bin/luna-coordinate.mjs`) | Read-only discovery of pending dev sessions and queue state. Zero Personal Field access, zero write authority. | Fails closed: HTTP 401 if missing or invalid. Historical key `dsc_4ba5b063659f5fd48d341fd55d3e2bcc3a8d2a294bbd2c1d` is retired and rejected. |
| `LUNA_DEV_DEFAULT_USER_ID` | Backend Server (`mcp-server/src/devAuthorization.ts`, `server.ts`) | Binds creator ownership (`a7def673-5786-4d52-833f-2e7e2dbc7b05`, Ben) for discovery and observer requests. | Fails closed: discovery returns null / 401 if unset. |
| `LUNA_DEV_MAINTENANCE` | Development Bridge Authorization Gate (`mcp-server/src/devAuthorization.ts`) | Bridge-only maintenance pause flag (`'true'` or `'false'`). | When `'true'`, all `/api/luna/command-center/dev` requests fail closed with HTTP 503 (`DEV_BRIDGE_MAINTENANCE`). Public application is 100% unaffected. |
| `dtk_<agent_session>` | Codex, Gemini, Dot Contributors | Scoped ephemeral contributor credentials (30-min rolling activity). Bound to authenticated `agent` and `issueId`. | Fails closed: HTTP 401 on expiration or invalid token; HTTP 403 on author mismatch, impersonation, or cross-issue writes. |

---

## 2. Dot Contributor Permissions Boundary & API Contract

Dot operates as a **separately authenticated coordination contributor**, not merely a read-only observer:

* **Identity:** `agent: 'dot'`, registered in `VERIFIED_AGENTS = new Set(['codex', 'gemini', 'luna', 'dot'])`.
* **Credential:** Dedicated ephemeral session token (`dtk_<dot_token>`) minted upon creator authorization and atomic claim.
* **Connection Mechanism:** HTTPS direct REST to `/api/luna/command-center/dev` on host `NUCBOX_M7\Ben`. Dot does not touch the local git repository (bypassing filesystem permissions).
* **API Contract ([`public/openapi-dev-contributor.json`](file:///C:/Users/Ben/Documents/Codex/2026-10-12/files-pasted-by-the-user-ran/work/luna-gemini-integration/public/openapi-dev-contributor.json)):**
  * Advertises ONLY actions permitted to a scoped session credential:
    * `dev.issues.get` (scoped to `session.issueId`)
    * `dev.events.list` (scoped to `session.issueId`)
    * `dev.sessions.get` (scoped to `session.id`)
    * `dev.events.post` (scoped to `session.issueId` and `session.id`)
  * Discovery-only actions (`dev.issues.list`, `dev.sessions.pending`, `dev.queue.get_state`) are excluded from the contributor contract.
  * Enforces required fields for `dev.events.post`: `issueId`, `sessionId`, `type`, `author` (must be `"dot"`), `content`, and `metadata` (must contain `agent: "dot"`, `workstream: string`).
* **Server-Enforced Prohibitions:**
  * Impersonation of `codex`, `gemini`, `luna`, or `user` (`authorizeReport` verifies `payload.author === session.agent` -> HTTP 403).
  * Cross-issue event posting (`payload.issueId !== session.issueId` -> HTTP 403).
  * Deployment reporting (`deployment.reported` rejected -> HTTP 403).
  * Decision approval or user sign-off (`decision.approved` rejected -> HTTP 403).
  * Issue status modification or creation (`dev.issues.update_status`, `dev.issues.create` rejected -> HTTP 403).
  * Credential generation or claim (`dev.sessions.create`, `dev.sessions.claim` rejected -> HTTP 403).
  * Access to Personal Field, creative, audio, or core execution routes (rejected -> HTTP 403).
* **Evidence Preservation:** `computeFactualEvidence` partitions Dot's reports under `dot:<workstream>`, preventing overwriting of Codex or Gemini workstream test evidence.

---

## 3. Session Provisioning & Queue Isolation Workflow

### A. Creator-Authenticated Issuance & Claim
1. **Issuance:** Creator (authenticated via Supabase user JWT) calls `createDevSession` on issue `iss_1792189315472_sdtm` with `status: 'pending'`, setting `environment: { mode: 'coordination' }` for each agent:
   * Session for Codex: `agent: 'codex'` -> returns pending session ID `sess_codex`
   * Session for Gemini: `agent: 'gemini'` -> returns pending session ID `sess_gemini`
   * Session for Dot: `agent: 'dot'` -> returns pending session ID `sess_dot`
2. **Claim:** Each agent atomically claims its assigned session via `claimPendingDevSession`:
   * Verified by CAS compare-and-set: `.eq('id', sessionId).eq('status', 'pending').eq('agent', agentName)`.
   * Mints an ephemeral token `dtk_<64_hex_chars>` with rolling 30-minute expiration.
   * If an agent attempts to claim another agent's session, the database CAS filter rejects it.

### B. Execution Queue Isolation
* Coordination sessions are explicitly tagged with `environment: { mode: 'coordination' }`.
* Headless execution worker leasing (`claimNextExecution`) ignores sessions with `mode: 'coordination'` and sessions without `workerId`.
* Queue state calculation (`getDevQueueState`) filters out coordination sessions when determining execution queue status (`discovered`, `claimed`, `working`).
* Result: Coordination sessions never occupy repository execution slots or block headless workers.

---

## 4. Corrected Credential Cutover Sequencing

Secrets are prepared offline before production configuration changes:

```
[Phase A: Offline Preparation] ➔ [Phase B: Deployment] ➔ [Phase C: DB Migration] ➔ [Phase D: Live Verification] ➔ [Phase E: Provisioning & Handshake] ➔ [Phase F: Key Invalidation]
```

1. **Phase A: Offline Secret Preparation (Outside Live Railway)**
   * Generate replacement secrets in creator's secure offline vault:
     * `NEW_DISCOVERY_KEY` = `dsc_<cryptographically_random_32_bytes>`
     * `NEW_OPENROUTER_KEY` = User's updated OpenRouter API key
   * Inventory all active consumers to confirm zero hardcoded dependencies.

2. **Phase B: Backend Container Deployment**
   * Push verified hardened commit (`agent/gemini-integration`) containing:
     * Dot contributor role and OpenAPI contract
     * Development Bridge maintenance gate (`LUNA_DEV_MAINTENANCE`)
     * Coordination session queue isolation
     * Strict authorization and token redaction
   * In Railway Dashboard, set the prepared environment variables:
     * `LUNA_DEV_DISCOVERY_KEY` = `<NEW_DISCOVERY_KEY>`
     * `OPENROUTER_API_KEY` = `<NEW_OPENROUTER_KEY>`
     * `LUNA_DEV_DEFAULT_USER_ID` = `a7def673-5786-4d52-833f-2e7e2dbc7b05`
   * Railway performs a zero-downtime rolling restart.

3. **Phase C: Database Policy Application**
   * In Supabase SQL Editor, execute `supabase/migrations/20261020000001_dev_bridge_remove_anon_token_policies.sql`.
   * Drops `anon USING (true)` policies on `dev_issues`, `dev_sessions`, and `dev_events`.
   * Authenticated creator policies (`auth.uid() = user_id`) and service-role bypass remain permanent.

4. **Phase D: Live Health & Security Verification**
   * Query `GET https://loops-production-e1d5.up.railway.app/status`:
     * Confirm `status: "healthy"`
     * Confirm `privilegedDiscoveryConfigured: true`
   * Verify security boundary:
     * Unauthenticated request to `/api/luna/command-center/dev` returns HTTP 401.
     * Request with retired token `dsc_4ba5b063659f5fd48d341fd55d3e2bcc3a8d2a294bbd2c1d` returns HTTP 401.
     * Request with `<NEW_DISCOVERY_KEY>` returns HTTP 200 with credentials redacted.

5. **Phase E: Agent Session Provisioning & Four-Agent Handshake**
   * Creator issues pending sessions for `codex`, `gemini`, and `dot` on `iss_1792189315472_sdtm`.
   * Each agent claims its session token (`dtk_...`).
   * Execute sequential handshake test `LUNA-FOUR-AGENT-20261022`:
     * Luna reads and confirms state.
     * Gemini reads and publishes acknowledgment.
     * Codex reads and publishes acknowledgment.
     * Dot reads and publishes acknowledgment with verified `author: 'dot'`.
     * All agents verify cross-reading from `iss_1792189315472_sdtm`.

6. **Phase F: Permanent Retirement & Decommissioning**
   * Confirm the historical discovery key is non-functional across all environments.
   * Verify audit log using `bin/luna-credential-audit.mjs`.

---

## 5. Development Bridge-Only Maintenance Gate & Recovery Procedure

### A. Development Bridge-Only Maintenance Gate
* **Mechanism:** Setting `LUNA_DEV_MAINTENANCE=true` in Railway environment.
* **Scope:** Gates ONLY `/api/luna/command-center/dev` and legacy `/api/dev/*` routes.
* **Behavior:** Development Bridge requests immediately return HTTP 503 (`code: 'DEV_BRIDGE_MAINTENANCE'`, `message: 'Development Bridge is in maintenance mode.'`).
* **Public Application Protection:** Luna's public direct chat (`/api/chat`), command center core (`/api/luna/command-center/core`), sound loops, ephemeris calculations, and user authentication are completely untouched and continue serving users normally.
* **Creator Access:** Ben retains direct authenticated administrative access through the Supabase Studio dashboard.

### B. Absolute Non-Reversion Policy
* Under no circumstances will the system be rolled back to pre-hardening commit `f74d017` or will anonymous database policies (`anon USING (true)`) be recreated.
* Rollback target in any disaster recovery scenario is strictly the verified secure recovery commit, preserving strict authentication and dropping `dev.inspect.echo`.
