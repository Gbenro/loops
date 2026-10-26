# Luna Beta release configuration — proposed, not applied

Repository Gbenro/loops; release branch beta; Vercel project loops-lbzc;
canonical entry https://beta.lunaloops.app/beta.

## Ownership — updated 26 October 2026

Codex owns feature development, debugging, automated testing, and preparation of
verified release commits. Gemini Dev owns GitHub release management and Vercel
deployment after Ben's approval. Codex does not independently push or merge into
beta or change hosting configuration, and will not continue Vercel CLI access
troubleshooting unless Gemini specifically requests help.

This workflow update remains uncommitted in codex/beta-release-workflow. The branch
HEAD is the accepted application release 77f31f1843268b5ba0e54183717bd0d9ee08c26f;
that SHA does not include these proposed workflow changes. Git index writes were
denied in Codex's environment. Preserve this worktree and use the local Gemini
handoff for the exact file list and partial validation; this is not a verified
workflow release commit.

## Exact proposed checks

`.github/workflows/beta-ci.yml` runs on every PR targeting beta and every beta push,
without path filters (required checks must not remain pending for unrelated paths).
Read-only GitHub token; no production credentials, deployments, or SQL.

- `Beta contracts and recording`: Node 24, npm ci, Chromium installation, Beta source
  build, all Luna Field and Echo Journey Node tests. Covers authentication refresh,
  account isolation, reconciliation, recording finalization/recovery, audio failures,
  signed URL refresh, Journey ordering, seeking, resume and continuous playback.
  These are mocked live-service contracts, not probes of private production records.
- `Beta build and browser`: Node 24, npm ci, build:beta (Beta generator then Vite),
  Chromium and WebKit startup checks on production-built /beta. External requests
  blocked; microphone denial stubbed. Checks rendering, Echo navigation and opening
  the capture dialog; it does not exercise interrupted recovery or real recording.
  The configured viewports are desktop Chromium and mobile WebKit, not Android Chrome.

Vercel buildCommand changes to npm run build:beta; output remains dist, rewrites remain
unchanged. Project Node runtime must support Node 24 for stripTypeScriptTypes.

## Migration boundary

Remove beta from deploy-migrations.yml push branches. Both existing migration jobs
also require github.ref == refs/heads/main, including workflow_dispatch. Existing main
path filters remain. Beta PR checks contain no database secrets or migration command.
The duplicate main migration workflows remain a separate backend concern; this change
does not restructure main deployment. Existing deploy.yml remains main-only; Beta uses
the Vercel Git integration and has no extra deployment action.

## Proposed beta branch protection

Exact API payload: `.github/beta-protection.proposed.json` (not automatically applied).
Require both named checks and branch up-to-date; one approving review; dismiss stale
approvals; approval after latest push; resolved conversations; include administrators;
no force pushes or deletion. No auto-merge or bypass configured by this change.

GitHub review cannot be supplied by the PR author. If an agent opens a PR as Gbenro,
Ben cannot approve that PR as Gbenro. Before enabling protection, use an already
authorized separate PR author or a separate trusted reviewer. Gemini owns the merge
after Ben's approval; generic branch protection does not identify Ben uniquely.
No new identities or access grants are proposed automatically.

## Verification required before push/merge

Remote beta was verified on 26 October 2026 at
77f31f1843268b5ba0e54183717bd0d9ee08c26f, the base of this worktree.
Authenticated Vercel browser inspection confirmed the following configuration:

- Project loops-lbzc, ID prj_DjM8g6UEy8hfpwXsC8Lqg3iLGEaf, connects to Gbenro/loops.
- Production tracks beta and automatically assigns beta.lunaloops.app after deployment.
- Repository root, Vite, npm run build, dist, Node 24.x; install override disabled;
  Ignored Build Step Automatic; no deployment checks configured.
- Separate Classic project loops tracks main and serves lunaloops.app.
- Existing Railway services inspected in the deployment assessment track main.

This patch proposes changing the Beta build command to npm run build:beta; the
dashboard configuration has not been changed. Before merging:

1. Confirm loops-lbzc connects to Gbenro/loops and production branch beta; domain
   beta.lunaloops.app belongs to that project. Verify Node 24 and build settings.
2. Record the currently successful deployment's immutable URL, deployment ID, Git SHA
   and Ready/Production status. Check it is eligible for Instant Rollback and retained.
   Baseline deployment reference: B1j2SXEpX5jRKm4BCyyAHwKUiwYY.
   Baseline URL: https://loops-lbzc-e37es0xth-gbenro-adesoyes-projects.vercel.app.
   GitHub deployment 7342146283 reports success for the accepted base commit;
   /beta and the Sky image matched the accepted assets in the deployment assessment.
   Instant Rollback eligibility still requires confirmation. The dashboard displays
   30-day production deployment retention, so retain the local source/assets too.
3. Confirm Railway services track main (or their existing branch), not beta; inspect
   all attached integrations and the legacy main Vercel action's target metadata.
   Repository changes here do not edit backend source, SQL, policies or credentials,
   but provider-side branch triggers cannot be inferred from local files.
4. The later ownership transfer supersedes Codex's earlier push instruction. Gemini
   manages publication of codex/beta-release-workflow and the PR/release process
   after Ben's approval. A branch push may create a Vercel preview via the existing
   integration. Refresh beta before an approved merge and inspect intervening changes.
5. Let checks run successfully once; obtain approval before applying the proposed
   beta protection payload. Resolve PR-author/reviewer identity first.
6. Ben approves the reviewed PR; separately authorize exact merge SHA. Merge beta;
   Vercel Git integration deploys automatically. Verify /beta and deployment SHA.

Stop on branch/project mismatch, missing rollback identity, failed checks, unavailable
reviewer, newer unreviewed commits, or evidence that beta triggers backend deployment.
No new infrastructure is required. Gemini's release handoff covers these workflow
changes, the existing deployment mapping, the remaining verification, and approvals.
No Supabase schema, application authentication, or backend source changes are included.

## Rollback

Keep the existing successful deployment untouched. After verifying its ID, use Vercel
Instant Rollback to that deployment only with owner approval. Revert the faulty Beta
commit through a reviewed PR as follow-up. Confirm auto-promotion behavior after rollback.
No database rollback or backend deployment is part of this frontend workflow.

## Local validation

Rechecked on 26 October 2026: Beta generator succeeded; 79 Node tests passed and
one test file failed to load because Playwright is missing. npm ci failed with Windows
EPERM even after a worktree write-permission grant. npm test and the Vite stage of
npm run build:beta could not start because Vitest/Vite were not installed. Browser
checks remain unrun. git diff --check passed. No application assertion failure was
established, but these are partial results: do not merge until full CI passes.

The user's PowerShell GitHub login was confirmed as Gbenro. Codex's sandbox push
dry run failed while launching the GitHub credential helper (Windows named-object
access denied), and Git index.lock creation was also denied. Gemini owns publication
through its approved environment. Do not export credentials into this repository.

References:
- https://vercel.com/docs/git
- https://vercel.com/docs/instant-rollback
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
