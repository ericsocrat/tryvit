# Consumer source and promotion order

The TryVit Vercel project is `prj_FQB2vfRlaEme8EeI1AIWiscp0J09` in
`erics-projects-faa226e7`. Its logged-in project settings were verified to use
Root Directory `frontend` with files outside the root included. The effective
configuration is `frontend/vercel.json`; it now disables Git deployments from
`main`. Other branches retain their default preview behavior. No unsupported
`rootDirectory` property is added to JSON.

This source control is necessary because Vercel automatically promoted main
commit `7e3ec3d3` to the production domains after the foundation merge. Merging
consumer source must not race its database migrations. The JSON guard still
requires normal source review/merge and confirmation that Vercel honors it;
editing this local file has not changed the live project or its current aliases.

Read-only verification with the installed Vercel CLI 59.7.0 succeeded for
`whoami` and scoped `project inspect tryvit`. An initial `env run` observation
was contaminated by local `.env` values; it did not prove the previous remote
Preview target. After the approved two Preview-only updates, direct API readback
confirmed the URL and anon key bound to staging `rxtaicdpnaqigowdbmsb`, with
Production values and metadata unchanged. No service key was added. The original
false HOLD and corrected readback receipts are retained separately; no mutation
retry was performed. Existing Preview builds have not been rebuilt or
target-attested, so authenticated testing remains HOLD until a fresh build's
effective binding and staging fixtures are verified. No secret values or
environment files were exported.

## Ordered release

1. Verify the main-deployment guard before merging consumer source. Keep the
   separate Supabase native auto-deployment path disabled. Confirm no competing
   production deployment is queued; do not infer this from an idle local CLI.
2. Bring staging to the foundation baseline first, or explicitly include its
   exact older pending prerequisites in the consumer manifest and rehearsal.
   A partial/unexpected pending list must remain HOLD, never `--include-all`.
3. Merge reviewed consumer source. Record its exact current-main SHA and manifest
   digest. Use an isolated, clean checkout of that SHA for every release step.
4. Apply and verify that manifest on staging through the manual database driver.
   Verify the frontend preview's public Supabase project reference is staging
   before authenticated testing; a Vercel Preview label does not prove its DB
   target. Preserve deployment protection and never print secret values.
5. Apply production only after matching staging and fresh recovery receipts pass
   the exact-source driver. Verify the resulting production database before
   exposing the rebuilt frontend to its ordinary traffic.
6. Build a **Production-target** artifact from the same SHA and Production
   environment settings, then deploy it without assigning production domains.
   Verify its source, project, readiness and public Supabase reference, smoke-test
   the protected deployment as authorized, then promote that exact deployment ID.

From the correctly linked isolated repository checkout, using a pinned Vercel
CLI and credentials in the environment (never command-line token literals):

```sh
vercel pull --yes --environment=production --scope erics-projects-faa226e7
vercel build --prod --scope erics-projects-faa226e7
vercel deploy --prebuilt --prod --skip-domain --yes --scope erics-projects-faa226e7
# Record and verify the returned deployment ID and both database receipts first.
vercel promote <verified-production-deployment-id> --scope erics-projects-faa226e7
```

Run CLI operations from the repository root with the correct project linkage;
do not rely on an unverified working-directory or implicit linking choice.
`vercel pull` writes private environment material locally: keep it ignored and
access-controlled. Never upload those files as evidence. Do not use a dirty
development worktree for the production build.

`--skip-domain` creates a staged production deployment, not a guarantee that
its unique URL is inaccessible; retain deployment protection. An ordinary
Preview-target deployment must not be promoted as though it were the identical
tested production artifact: current CLI behavior creates a new production
deployment when promoting Preview. Production-target staged promotion preserves
the artifact and separates domain assignment from building.

Official references: [Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration),
[staged production builds](https://vercel.com/docs/cli/deploying-from-cli),
[promote behavior](https://vercel.com/docs/cli/promote), and
[monorepo CLI root](https://vercel.com/docs/monorepos).
