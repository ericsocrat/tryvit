# Historical profile validator regression

`20260908065059_evidence_profile_validator_bonus_types.sql` fixes validation of the existing v3.3 configuration. It changes only `validate_country_profile(text,text)`. No scoring function, configuration, product score, registry hash, or function privilege is changed.

Continuous and categorical penalty weights must be positive and sum to 1 within the existing strict 0.01 tolerance. Bonus weights must be negative and are excluded from that penalty sum. `total_weight` retains its signed-sum meaning (0.92 for v3.3); `penalty_weight` (1.00) and `bonus_weight` (-0.08) expose the two components separately.

Only v3.2 may omit the legacy continuous type. Null/unknown types, missing or nonnumeric weights, nonfinite strings, invalid supplied ceilings, malformed factors, missing names, and duplicate names fail validation. This checks configuration structure and accounting; it does not validate scientific efficacy.

The local regression command is:

```powershell
$env:QA_LOCAL_POSTGRES_CONTAINER = 'supabase_db_tryvit-evidence-first'
node --test scripts/qa/profile-validator.test.mjs
```

The harness verifies the exact loopback database port 55102, installs the function inside a rollback transaction, runs 39 pgTAP assertions, and compares every public function definition/ACL and model configuration before and after. A second rollback case reinstates the original validator and proves that it rejects the unchanged v3.3 profile. Successful static tests with database tests skipped do not constitute SQL verification.
