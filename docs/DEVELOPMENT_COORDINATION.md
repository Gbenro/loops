# Luna development coordination — local implementation

Prepared 20 October 2026. Shared issue: `iss_1792189315472_sdtm`.
This patch is local. No push, merge, deployment, SQL application, live secret
rotation, or Dot connection is authorized by its existence.

## Workspaces and ownership

All three checkouts began at `f74d017f59c65356246fadfdc83cf2496a449e65`.
Read-only `git ls-remote` confirmed that this is the remote Beta head; `main`
remains `ebe8be29e61185479a07d84030ef281ffa8fc5fb`.

| Workspace under `C:\Users\Ben\Documents\Codex\2026-10-12\files-pasted-by-the-user-ran\work` | Branch | Responsibility |
| --- | --- | --- |
| `loops-app` | `codex/luna-echo-entry` | Preserved original checkout; do not repurpose |
| `luna-codex-ui` | `agent/codex-ui` | Codex presentation/navigation; this first coordination security patch |
| `luna-gemini-integration` | `agent/gemini-integration` | Reserved for Gemini's live data/backend work and compatibility review |

The original checkout was clean; there were no untracked files to migrate.
All 52 tracked design/Beta paths were present in the shared base. Existing ignored
dependencies/build outputs remain in the original checkout. Dependencies were
copied/restored in the Codex workspace without adding packages to manifests.
No existing worktree or branch was reset, deleted, overwritten, or force-checked out.

Codex owns `design/luna-field/src/views.ts`, `components.ts`, styles and visual
interaction changes. Gemini owns `live-services.ts` and live/backend adapters.
`contracts.ts`, `app.ts`, lunar ownership, and capture orchestration require an
explicit cross-agent review before either agent changes the shared contract.
The real Sky implementation and Classic functionality remain the compatibility baseline.
No design fixtures are to be copied into Beta's authenticated Field.

Changes in another worktree do not appear automatically. For future integration:

1. Read the common issue and other contributor's updates before changing shared files.
2. Report base SHA, branch, dirty state, owned files and intended contract change.
3. Make a small local commit after its required checks. Ask the other owner for review.
4. After user approval, the nominated integrator incorporates reviewed commits in
   an integration branch, resolves conflicts visibly, and runs combined checks.
5. Regenerate `public/beta/index.html`, `public/beta.html` and review artifacts from
   `design/luna-field/build.mjs` once, in the nominated workspace. Avoid hand edits.
6. Pushing, merging, deployment, and user acceptance remain separate decisions.

## Authentication and permissions

| Credential | Permitted authority after this patch |
| --- | --- |
| Authenticated user JWT | Creator delegation of explicitly named agent sessions, issue lifecycle decisions |
| Configured discovery secret | Read development issues, events, session status and queue only |
| Agent session token | Its assigned issue/session; reports attributed to its assigned agent; explicit heartbeat/end |
| Separate Dot observer token | Development reads only; no reports, claims, execution, acceptance, assets or Personal Field |

Discovery secrets are compared to the configured secret with a constant-time
comparison. A configured owner is required; no hardcoded owner fallback is used
for credential validation. The server supplies its service client only after the
development request passes the shared allowlist. Missing service configuration
fails closed. Session credentials are validated server-side and are never returned
by read operations. Discovery and token validation no longer mutate sessions.

The undeclared `dev.inspect.echo` action is removed. Development credentials cannot
use Core/Personal Field, Creative, Assets, Lab, execution/worker or credential-management
routes. The advertised permissions now reflect that narrower boundary.

A creator must name `codex`, `gemini`, or the existing `luna` agent explicitly when
provisioning a session. Issue ownership is checked. Claims require that exact
assigned agent and a pending session. Status and agent are included in the update's
compare-and-set filters: a racing claim fails, and a connected session is never
reclaimed or given a replacement token. Lost credentials need an explicit creator
recovery process, not a silent reclaim.

## Reporting protocol

Stable task identifiers established for the shared issue:

- `codex-coordination-hardening` / agent `codex` / workstream `coordination-security`
- `gemini-coordination-compatibility` / agent `gemini` / workstream `integration-review`

After reviewed deployment, the authenticated creator provisions distinct sessions
with `environment.purpose = "coordination"`, the task identifier, and branch.
Do not claim Gemini's session for Codex. Coordination sessions are excluded from
queue execution-state projection and are not execution leases.

The live server has not received this patch. During this local task, recognized
`developer.question` and `session.handoff` events carry the distinct task IDs in the
existing issue's legacy session container. The session is not claimed, reopened,
renewed or presented as a newly verified agent session. This preserves current
work and avoids minting a pending task that an existing worker might execute.

Every report includes agent, workstream, session/task identifiers, branch, commit,
dirty state, changed files, completed work, tests, dependencies, blockers and required
decisions. Use recognized event types. On the patched server, evidence is grouped
by `author:workstream`; scoped reports do not overwrite legacy evidence or advance
the whole issue. Global user scope changes invalidate affected workstream evidence.
Completion of one stream does not imply feature acceptance, deployment or completion
of another stream.

The lightweight CLI has no listener, auto-claim, worker, merge or deployment action:

```powershell
node bin/luna-coordinate.mjs events iss_1792189315472_sdtm
node bin/luna-coordinate.mjs report iss_1792189315472_sdtm path/to/report.json
node bin/luna-coordinate.mjs report iss_1792189315472_sdtm path/to/report.json --publish
```

Reads use an environment-provided observer/discovery credential. Publishing requires
the agent's own `LUNA_DEV_TOKEN` session credential. No token belongs in the JSON
report, command arguments, screenshots, frontend bundle, or repository documentation.
Dry-run is the default. Keep a stable `reportId` when retrying an ambiguous request;
the CLI reads existing events first. This is client duplicate protection, not a
transactional exactly-once guarantee.

Example report (no personal records):

```json
{
  "reportId": "codex-unique-report-id",
  "agent": "codex",
  "workstream": "coordination-security",
  "sessionId": "assigned-session-id",
  "type": "tests.reported",
  "content": "Local security checks completed; deployment awaits review.",
  "status": "passed",
  "command": "node node_modules/vitest/vitest.mjs run --config vitest.dev-security.config.js",
  "passed": 18,
  "failed": 0,
  "changedFiles": ["mcp-server/src/devAuthorization.ts"],
  "completedWork": ["Authorization checks"],
  "testResults": ["Scoped to local security cases"],
  "dependencies": ["Gemini compatibility review"],
  "blockers": [],
  "requiredDecisions": ["Approve rollout separately"]
}
```

## Dot contributor preparation

`public/openapi-dev-contributor.json` defines a narrowly scoped Contributor contract
using the existing Command Center endpoint (`/api/luna/command-center/dev`). Dot is
registered in `VERIFIED_AGENTS = new Set(['codex', 'gemini', 'luna', 'dot'])`, allowing
it to read development state and publish verified coordination messages (`developer.question`,
`developer.blocked`, `implementation.reported`, `tests.reported`, `session.handoff`, etc.)
within its creator-authorized issue scope using an issued ephemeral session credential (`dtk_...`).

Server-side authorization independently verifies that:
1. `payload.author` matches Dot's authenticated session agent (`dot`). Client-supplied impostor identities (`codex`, `gemini`, `luna`) are rejected with 403.
2. `payload.metadata.agent` equals `dot` with an explicit workstream (e.g. `qa`, `coordination`).
3. Multi-agent evidence partitioning (`computeFactualEvidence`) preserves Dot's evidence under `dot:<workstream>` without overwriting Codex or Gemini workstream results.
4. Dot has zero deployment authority (`deployment.reported` rejected), zero credential management authority (`dev.sessions.create`/`claim` rejected), zero task mutation authority (`dev.issues.update_status` rejected), and zero user-approval authority (`decision.approved` rejected).
5. Dot has no access to Personal Field, creative, audio, or core execution routes.

Before connection, configure Dot's HTTPS connector on `NUCBOX_M7\Ben` using the issued session token. Dot does not enter the local git repository and communicates solely over authenticated HTTPS. Human approval remains authoritative.

## Verification and release gates

Build backend before tests that import its generated `dist`:

```powershell
node mcp-server/node_modules/typescript/bin/tsc -p mcp-server/tsconfig.json
node node_modules/vitest/vitest.mjs run --config vitest.dev-security.config.js
node node_modules/vitest/vitest.mjs run --pool=forks --maxWorkers=2 --minWorkers=2
node bin/luna-credential-audit.mjs
```

See `SECURITY_ROTATION_PLAN.md` for audit scope, affected consumers, rollout order,
and rollback boundaries. The migration is prepared only. Gemini's compatibility
review and user approval are required before integrating or releasing this patch.
