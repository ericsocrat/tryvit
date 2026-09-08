# Foundation deployment sequencing incident — 2026-09-08

## Disposition

Foundation PR #1359 merged normally at 05:04:53 UTC into
`7e3ec3d3be9480cde07f0c6d6e0c69aad08f4b77`, tree
`5bcbf8e91f4f7cfa5f73c074dce70c3acc5f656d`. Supabase's native Git integration
then applied its five migrations to production before the intended staging
application. **The staging-first release requirement was not met.** Local
restoration and migration rehearsals are not a substitute for that requirement.

No manual production database workflow was dispatched. Native action
`ff09bed5af7c4fd193075af4d1829f17` started at 05:04:59 UTC; its migration step
finished at 05:05:39 UTC. GitHub check `101943930008` identifies the merged source.
The production migration ledger advanced from 237 to 242, ending at
`20260905120236`. The logs listed the five foundation migrations. Configuration
and seed steps were skipped; no Edge Function deployment was observed.

The competing path survived the earlier GitHub workflow consolidation. That
was a release-control defect: auditing repository workflows alone did not
establish that the managed platform had no independent deployment trigger.

## Containment and verification

- Further release mutations were paused while the actual application was checked.
- The four ingestion tables have RLS enabled and no anonymous/authenticated table
  privileges. Lists, list items and comparisons retain RLS, deny anonymous table
  access, and retain authenticated access subject to their policies.
- The legacy list-items endpoint returns `refresh_required`, not a successful
  response with a missing score that an old client could misinterpret.
- Read-only aggregates found 2,720 products, 2,434 active products, zero ingestion
  batches and zero source observations. No source import was performed. These
  aggregates do **not** prove every production row is byte-identical.
- At 05:23:44.262 UTC, the production branch's `git_branch` was changed from
  `main` to an empty string and read back. The same branch ID, project reference,
  default-branch flag and name remained. No branch was deleted, GitHub connection
  unlinked, migration rolled back, or Vercel setting changed by that operation.
- Vercel deployed the unchanged foundation frontend from the merged source;
  post-deploy smoke run `34189416078` passed. Main Gate `34189274934` passed
  type-check/lint, unit, build and Playwright jobs, but **failed SonarCloud's
  quality gate**. The Main Gate as a whole is not certified green.

Privacy protections were not reverted merely to restore deployment order.
Staging catchup is remediation after this incident, not retrospective evidence
that production was staging-tested before application.

## Remaining release controls

Staging dry-run `34190858900` passed at 05:30:44.118 UTC for the exact merged
source and foundation manifest SHA-256
`3389ef688241f5e14a2ac0e1912fc4dd082e33c844b8a7d69fc535b5eb60cd4b`.
It identified 15 pending migrations. `dryRun: true` and `lintPassed: false`
mean that it proves neither staging application nor post-application lint.

The subsequent actual staging run `34193369429` passed at 06:10:18.413 UTC
against the same source and manifest, with `dryRun: false`, zero pending
migrations and `lintPassed: true`. Read-only follow-up found the exact 242-version
ledger, two users, four products, empty ingestion batches/observations, and the
checked foundation privacy boundaries intact. This closes staging catchup,
not the incident's staging-first sequencing violation.

Before the consumer release, verify staging application and recovery, preserve
the disabled native production Git binding, isolate Preview from the production
database, and verify the Vercel main-deployment guard. Database and frontend
promotion must be explicitly sequenced as described in
[Consumer promotion](CONSUMER_PROMOTION.md). Do not fabricate a manual production
receipt by dispatching an empty run for migrations already applied natively.

The consumer release driver adds an explicit read-only native-binding check
before CLI access and immediately before application. Unknown state, failed
requests and enabled bindings fail closed. This does not lock remote settings
against concurrent operator changes or replace the pre-merge control review.

### Preview verification correction

An initial claim that remote Preview used the production database was based on
`vercel env run`. Subsequent investigation proved CLI 59.7.0 overlays local dotenv
and process values on remote values. That original remote-target conclusion is
**unproven**, not a confirmed configuration defect. A later approved operation
updated the two separate Preview-only URL/anon-key records to staging. Direct
per-record API readback at 06:35:07 UTC confirmed both intended staging values
and unchanged Production value/metadata fingerprints. No service-role key was
added to Preview, and no configuration write was retried after the operation's
false failure report. The failed verifier and corrected readback are retained.

Current remote configuration is staging-bound. Previously created deployments
retain their own build-time environment and are not certified by this change;
the exact consumer deployment still requires runtime target verification.

## Related Auth redirect cleanup

At 05:57:23.794 UTC, the obsolete `poland-food-db.vercel.app/auth/callback`
and `poland-food-db.vercel.app/**` allowlist entries were removed. The canonical
`https://tryvit.app/auth/callback` and
`https://tryvit.app/auth/recovery/callback` entries were preserved.
The old host returned `404 / DEPLOYMENT_NOT_FOUND` and was absent from inspected
owned project/team domains; external ownership and takeover were not proven.

Readback confirmed signup disabled, canonical site URL unchanged, Google enabled,
Apple and anonymous authentication disabled, and mail auto-confirm disabled.
No account or credential was created or changed. Login/recovery was not exercised
by this configuration check. The production Turnstile proof remains unresolved.
