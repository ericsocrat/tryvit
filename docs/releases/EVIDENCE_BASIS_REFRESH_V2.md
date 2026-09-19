# OFF observation extractor v2 and existing-source basis refresh

## Scope

This release corrects one source-bound extraction defect. The retained field
`nutrition_data_per` now maps exact `100g` to `per_100g` and exact `100ml` to
`per_100ml`. Missing, unsupported, malformed, or explicitly contradictory
declarations remain `unknown`. Category, product form, values, `_100g` suffixes,
and nutrient units are never positive basis evidence.

`off-observations-v1` remains unchanged historical evidence. V2 refreshes create
new immutable observations whose sealed `derivation` binds the selected v1
observation ID and payload hash, the recovery-matrix hash, and the extraction
timestamp. Old observations remain present. Current projections, provenance,
selection, and source-owned assertion pointers move through
`ingestion_apply_observation`; assertion contents remain identical and their
original v1 representation remains sealed in the retained observation.

## Reviewed inputs

- frozen source cohort: the existing retained 60-file artifact, with only the
  55 already-selected production members eligible;
- recovery matrix:
  `audit-reports/evidence-basis-recovery/selected-observations-20260919.json`;
- matrix SHA-256:
  `97ce5c8744427846c5cef9c66ee30f343caf176ec6c9807c010ac1d8c5deced7`;
- generated refresh-manifest SHA-256:
  `321a03284b78c947457b02b33b7cddda572ccb2a5dc3cd944ca049aac71de689`;
- expected results: 48 `per_100g`, seven `per_100ml`, zero unknown.

## Production sequence

The existing initial-import action keeps rejecting existing sources. Only the
separate `basis-refresh` action accepts this manifest.

1. Merge and certify exact main.
2. Run the ordinary staging/production migration release for the v2 ingestion
   admission migration, with fresh recovery evidence.
3. Capture a fresh reviewed populated-21 recovery from the exact production
   state before each batch.
4. Plan at most five IDs without `--execute`; review the returned plan SHA.
5. Re-run with `--execute`, the exact source/main/project, reviewed refresh and
   allowlist hashes, recovery directory, CA, and confirmation SHA.
6. Verify each receipt and selected postimage before the next capture/batch.
7. Never retry an uncertain commit. Inspect its encrypted envelope first.

Example action shape (values are deliberately placeholders):

```text
node scripts/recovery/cohort-production-operator.mjs
  --action basis-refresh
  --ids <one-to-five-reviewed-product-ids>
  --reviewed-refresh-sha256 321a03284b78c947457b02b33b7cddda572ccb2a5dc3cd944ca049aac71de689
  --recovery-directory <fresh-combined-production-recovery>
  --reviewed-allowlist-sha256 <fresh-reviewed-allowlist-sha256>
  --source-head <exact-main>
  --main-sha <exact-main>
  --project uskvezwftkkudvksmken
  --source-ca <reviewed-ca-file>
```

Rollback uses the ordinary `rollback` action with the member's encrypted
envelope plus a fresh structural recovery proof. It restores the former
projection and selected v1 observation while retaining the new v2 observation
and ingestion batch as immutable history.

## Boundaries

No source fetch, product addition, score, UI, authentication, RLS, or visual
baseline change belongs to this release. A full cohort operation is successful
only when all 55 exact members are selected on v2 and read-only verification
reports 48 `per_100g`, seven `per_100ml`, zero unknown, unchanged nutrition
values/source hashes, and retained v1 history.
