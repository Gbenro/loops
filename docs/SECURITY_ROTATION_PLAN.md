# Development credential exposure and staged rotation plan

Prepared 20 October 2026. No live credential or database policy has been changed.

## Findings and audit limits

The offline audit examines tracked text and matching changes in all reachable local
Git refs. It emits filenames, commit IDs and one-way fingerprints, never raw tokens.
Five history commits contain matching additions/removals, including synthetic test
fixtures. Non-fixture exposure includes:

| Location | Evidence |
| --- | --- |
| `CODEX.md`, commit `ebe8be29e61185479a07d84030ef281ffa8fc5fb` | Discovery credential literal; fingerprint `8fdc4b92ab18db9c` |
| Historical `mcp-server/src/devBridge.ts`, commit `471165838e24df823eaf16586ec36afb63091373` | Two hardcoded credential literals; fingerprints `d6e10f967edb8833`, `7ac071034a88d440` |
| Commit `d6b70f5ea5c2c193566175a92b473c473e1a8097` | Removal of those backend literals; removal does not erase exposure |

The patched guide no longer contains the literal. The preserved original checkout,
remote history, clones, cached documentation and external copies remain unchanged.
Historical credentials must be treated as exposed; this audit does not prove whether
each is still active. Test fixtures are identified separately and are not real secrets.
No history has been rewritten. Unreachable objects, private CI logs, deployed environment
variables and external credential stores were not inspected.

Additional local findings addressed by the patch: prefix-based discovery acceptance;
inconsistent Command Center/REST authorization; undeclared Personal Field inspection;
implicit agent attribution; active-session reclaim/token replacement; mutation on
discovery/validation reads; leaking tokens through read responses; missing-service-key
fallback to an anonymous client; and contributor evidence being combined incorrectly.

## Affected integrations to inventory

- Railway backend: configured discovery secret, explicit development owner, server-only
  service key availability, and later the separate Dot observer credential.
- Codex/Gemini local Luna credential files, environment variables and bridge CLI processes.
- Existing Custom Actions/Command Center consumers using the development credential.
- Watchers/workers: confirm issuance, explicit agent identity, heartbeat/report metadata,
  and handling of rejected active-session claims. Do not interrupt current workers now.
- Documentation, shared snippets, clones and retained artifacts containing old values.

Confirm the actual consumer inventory and named owners before execution. Do not give
Dot a copy of an existing broad credential. No Personal Field or auth application
credentials need to be handed to Dot.

## Proposed rollout, requiring separate approval

1. Gemini reviews compatibility in its own worktree. Resolve required creator-issued
   session provisioning, explicit agent metadata and worker discovery behavior.
2. Prepare environment values in the approved secret manager, with an explicit owner
   and separate discovery/observer credentials. Do not commit values or log them.
3. Test the reviewed backend and connectors in an approved non-production environment:
   unmatched secret rejected; allowed reads succeed; observer/session writes and
   Personal Field requests denied; parallel claims cannot replace active credentials.
4. Obtain user approval for deployment and the database policy change. Deploy the
   hardened backend before applying the prepared migration: validation must already
   use the server-only client before anonymous token policies are removed.
5. Verify normal authorized agent reporting and read-only observer behavior. Do not
   use negative/intrusive production tests without further authorization.
6. Obtain approval to rotate the exposed discovery credential. Coordinate a short
   maintenance window with every consumer; pause/restart only the affected connectors
   under that approved plan. Replace the single configured secret and consumer secret
   references together. The patch deliberately does not support a legacy-secret bypass.
7. Assess existing session expiries and explicitly revoke/reissue exposed session
   credentials if required. Do not invalidate other active sessions by claiming them.
8. Read back only development status and confirm consumers have resumed. Record
   acknowledgements and credential versions, never credential values.

## Rollback

Keep the prior reviewed deployment artifact and a backup of existing policies/configuration
in the approved secret system. Rollback must preserve strict authentication and the
new secret: pause affected consumers and restore a known secure artifact/configuration.
Do not restore exposed credentials, prefix acceptance, anonymous session enumeration,
or broad development access to Personal Field data. If the secure rollback is unavailable,
keep affected development connectors paused and request a decision.

The SQL migration drops only the five old anonymous development-token policies.
Authenticated owner policies and Personal Field tables are untouched. Verify those
owner policies before execution. No destructive history rewrite, force push, deployment,
credential rotation, or SQL execution is part of this local task.
