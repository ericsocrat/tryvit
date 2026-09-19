# TryVit Codex instructions

Work from the repository root and inspect `git status`, the current branch, and
the current remote/default-branch state before changing anything. Preserve
unrelated changes and active worktrees.

## Authority and scope

- Start with the top, current checkpoint in `CURRENT_STATE.md`, then read
  `docs/EVIDENCE_DATA_POLICY.md`,
  `docs/implementation/EVIDENCE_FIRST_REBUILD.md`, and
  `docs/releases/EVIDENCE_FIRST_CONSUMER.md` when the task touches product,
  data, release, or production claims.
- Read only the relevant sections of `copilot-instructions.md`. Its
  evidence-first consumer contract supersedes the older retained reference
  material; historical counts, branches, scores, and PASS claims are not
  current evidence.
- Prefer source, migrations, tests, workflows, and fresh provider state over
  narrative status documents. Mark missing or stale evidence as unproven.
- Do not expose secrets, weaken RLS or server-owned authorization, enable
  public signup, automate Turnstile proof, or mutate production data without
  explicit task-specific approval.

## Stack and commands

The frontend is `frontend/` (Next.js, React, TypeScript, npm, Vitest,
Playwright). The hosted Postgres service owns the database and authorization
boundary; use the repository's established frontend deployment path.

From `frontend/`, use the committed npm lockfile:

```powershell
npm ci
npm run type-check
npm run lint
npm run test
```

Run focused checks while iterating and the smallest relevant documented
browser/database checks for the changed surface. Use the guarded commands in
`frontend/README.md` for browser evidence. Do not treat a local build, Preview,
historical CI result, or provider configuration as proof of production state.

For hosted database or deployment-provider inspection, prefer official,
project-scoped, read-only access. Keep schema, deployment, environment,
promotion, and rollback actions approval-gated. Never print credentials or
`.env` contents.

Before handoff, report the exact checks run, their results, checks not run,
source/branch identity, and any remaining uncertainty. Do not weaken a gate to
make it pass.
