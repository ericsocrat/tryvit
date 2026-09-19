# Bounded source expansion operator

This path extends the reviewed evidence-cohort operator without changing the
consumer contract. It accepts only an exact `source-expansion-cohort-v1`
manifest produced from:

1. a frozen 150-product PL selection;
2. one retained OFF lookup per exact EAN;
3. deterministic source identity and extractor-v2 validation; and
4. a fresh read-only production identity review.

Acquisition and source files stay under ignored
`audit-reports/source-expansion/`. They are public food-source evidence but are
not application source or a reason to enlarge the Git review. The production
operator hashes every file again before opening a database connection.

## Acquisition

Run the selection SQL read-only and retain its exact output. Then:

```powershell
python -m scripts.recovery.source_expansion_acquire `
  --selection <selection.json> `
  --confirm-selection-sha256 <reviewed-selection-sha256> `
  --output-directory <owned-run-directory>

python -m scripts.recovery.source_expansion_finalize `
  --selection <selection.json> `
  --confirm-selection-sha256 <reviewed-selection-sha256> `
  --acquisition-receipt <run/receipt.json> `
  --confirm-acquisition-sha256 <receipt-sha256> `
  --output <run/acquisition-manifest.json>

python -m scripts.recovery.source_expansion_bind_review `
  --acquisition-manifest <run/acquisition-manifest.json> `
  --confirm-acquisition-manifest-sha256 <acquisition-manifest-file-sha256> `
  --production-review <run/production-identity-review.json> `
  --confirm-production-review-sha256 <production-review-sha256> `
  --output <run/release-manifest.json>
```

`--resume` resumes only an interrupted acquisition with the same binding. It
verifies every retained member result and does not refetch completed EANs.
Not-found, failed and held products remain in the receipt and never enter the
release entries.

## Recovery and isolated proof

From a clean exact-main checkout, copy the previously reviewed retained cohort
and basis-refresh source artifacts into their ignored canonical paths. Use
`inspect-sources` with the expansion manifest to produce the exact current
public-source allowlist. Review its digest, then use the ordinary `capture`
action to create and actually restore the encrypted 21-table/schema recovery
artifact.

Run the expansion rehearsal against that proof:

```powershell
node scripts/recovery/source-expansion-rehearsal.mjs `
  --recovery-directory <private-recovery-directory> `
  --binding-file <sanitized-exact-binding.json> `
  --expansion-manifest <run/release-manifest.json> `
  --reviewed-expansion-sha256 <release-manifest-file-sha256> `
  --execute
```

The rehearsal imports the complete accepted cohort into a network-none restored
production clone in batches of at most five. It verifies each transaction,
every prior postimage after each batch, idempotent no-write reruns, the original
55 selections, comparison growth, consumer score retirement, and a complete
reversal while retaining immutable observation history.

## Production execution

Plan first with all reviewed accepted IDs. The operator internally partitions
them into batches of at most five while one reviewed recovery preimage remains
authoritative for the release:

```powershell
node scripts/recovery/cohort-production-operator.mjs `
  --action expansion-batch `
  --project uskvezwftkkudvksmken `
  --source-head <exact-main-sha> `
  --main-sha <exact-main-sha> `
  --source-ca <reviewed-supabase-ca> `
  --source-env-file <existing-local-credential-file> `
  --recovery-directory <private-recovery-directory> `
  --expansion-manifest <run/release-manifest.json> `
  --reviewed-expansion-sha256 <release-manifest-file-sha256> `
  --ids <all-reviewed-accepted-ids>
```

Execute only the unchanged `PLAN_READY_FOR_REVIEW` digest by adding
`--execute --confirm-sha256 <plan-sha256>`. Each product commits independently;
the operator stops at the first HOLD, verifies every completed five-product
batch and the cumulative release postimages, and reports all remaining IDs as
not attempted. A commit-uncertain result is never retried.

After a PASS, run `inspect-sources` again with the same expansion manifest,
review the new exact allowlist, and create a new encrypted/restored recovery
artifact for the expanded state. Do not treat an application build or a source
receipt as database recovery evidence.
