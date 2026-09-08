# Preview Supabase isolation operator

Runtime audit found three names: browser/SSR/proxy/service-worker/public-share
clients use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
`SUPABASE_SERVICE_ROLE_KEY` is used only by `/api/health`, whose client caller is
the admin monitoring page. That privileged path is not necessary for ordinary
consumer Preview testing. The operator does not add a service key; Preview's
privileged health endpoint may remain503 and must not be described as verified.

`scripts/ci/preview-isolation.mjs` is read-only by default. It uses the already
authenticated Vercel CLI, explicitly scoped to the known TryVit project/team,
and retrieves the existing staging anon key through `supabase projects api-keys`.
It neither creates keys nor changes Auth settings. Key values remain in memory;
API payloads go through child stdin (`vercel api --input -`), never command
arguments, environment export files, logs or receipts.

The live reviewed topology had separate Preview-only URL/anon records and
Production-only records, with no branch-specific overrides. Existing Preview
IDs can be patched only after rechecking their exact Preview-only scope and
metadata. A missing Preview record can be created separately without upsert.
Shared multi-target, branch-specific, integration-owned, privileged or ambiguous
records stop for review. Never use a broad `env update`, `env rm`, or upsert on a
shared Production/Preview record. A shared topology needs its own reviewed split
or branch-only override plan; this operator will not invent one.

Run from a correctly linked TryVit checkout with an existing CLI path:

```sh
node scripts/ci/preview-isolation.mjs --vercel-cli <existing-vercel-vc.js>
# Only after reviewing the exact plan and establishing an exclusive edit window:
node scripts/ci/preview-isolation.mjs --vercel-cli <existing-vercel-vc.js> --execute --confirm-plan-sha256 <reviewed-digest>
```

Before writing, confirm no TryVit deployments are queued, initializing or
building and no other actor will change environment settings or push during the
edit. The API does not provide a claimed transactional guarantee against outside
concurrent edits. The utility rechecks before each write and checks Production
metadata plus readable URL/anon value hashes after each write. Production's
sensitive service key is not fetched: preserve its metadata
fingerprint, never substitute a hash of a masked/absent value as proof of its
plaintext value. `present` in a snapshot means a readable value was inspected,
not necessarily that an unreadable sensitive value is absent remotely.

Snapshots now use direct decrypted-record API reads with explicit branch
resolution. Vercel CLI59.7 env-run merges local dotenv/process values over remote
values; it caused a false post-write HOLD in the initial attempt. Tests now
reproduce that contamination and prove direct snapshots are unaffected. Runtime
Supabase variables are also stripped from child environments. The original HOLD
is retained; subsequent direct readback confirmed both writes without retrying.

Only two values are eligible: the canonical staging URL and an existing
staging-bound anon-role key. A service-role key is rejected as browser input.
Effective default Preview and `codex/evidence-first-consumer` branch values must
match staging afterward, without adding privileged credentials. Any drift or
partial failure stops; no compensating Production write is attempted.

Success is `CONFIGURED_NOT_DEPLOYED`. Existing deployments retain their previous
environment; the initial local env-run result did not prove their targets. A fresh Preview
build and sanitized effective-project-reference verification are required before
testing. Begin with read-only checks; authenticated writes require explicitly
approved staging fixtures. Do not reuse production accounts/data for tests or
add broad Preview redirect wildcards. OAuth/signup/recovery callbacks need a
separately reviewed exact staging origin; this utility does not change them.

Current API references: [environment metadata/update](https://vercel.com/docs/rest-api/projects/edit-an-environment-variable),
[Preview-only creation](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables).
