# JEV advisory shadow-mode source review

Status: local, optional, read-only operator tool. Hosted execution is not configured.

## Integration seam

The tool attaches after deterministic reconciliation has produced a local review
artifact. `pipeline.evidence_cohort.reconcile()` already reports identity text
differences, and `scripts/recovery/plan_retained_cohort.py` assigns authoritative
hold reasons such as `identity_text_change_requires_review`. Neither module calls
JEV. An operator may translate a genuinely ambiguous pair into the strict public
manifest accepted by `pipeline.jev_advisory`.

Deterministic conflicts and decisions remain authoritative. The advisory tool
skips every case whose deterministic state is not `semantic_ambiguity`.

## Commands

Preparation and reporting are offline:

```powershell
python -m pipeline.jev_advisory prepare `
  --input <local-public-review-cases.json> `
  --output audit-reports/jev-advisory/<new-run>

python -m pipeline.jev_advisory evaluate `
  --manifest audit-reports/jev-advisory/<new-run>/manifest.json

python -m pipeline.jev_advisory report `
  --manifest audit-reports/jev-advisory/<new-run>/manifest.json
```

The default evaluation records `offline_disabled`. A live call requires both
`--jev-live` and process-local `TYPESAFE_API_KEY`. No repository, Vercel,
GitHub, or Supabase secret is configured by this feature.

## Public input boundary

Each side declares exactly `product_name`, `brand`, `variant`, `package`, and
`quantity`; the case declares `market` and a public HTTPS source URL. Local case
references and deterministic reasons are hashed and retained locally but are not
sent. User data, internal product IDs, reviewer decisions, private notes,
confidence/trust scores, nutrition, allergens, and operational records are
rejected by the exact input schema.

## Advisory result

`JEVSourceReviewAdvisoryV1` retains the opaque case/input/public-field hashes,
deterministic state, frozen prompt/model identity, all three answers with raw
probability vectors and confidence, timing, usage, estimated cost, attempts,
status, timestamp, and `advisory_only: true`. Provider probabilities are retained
unchanged; a 0.011 sum tolerance covers the validated two-decimal 0.99/1.01
rounding behavior.

Provider failures create local failure statuses. At most two transient retries
are allowed. Authentication and request-validation failures are not retried.
Unexpected model substitution fails the advisory call. None of these outcomes
can fail, approve, reject, hold, release, select, or write an observation.

## Real shadow cohort

After inference, `init-shadow-labels` creates a blank local label ledger. Human
reviewers may later record the final label, whether the advisory reduced effort,
review time, and a note. Labels are created after inference and never enter the
provider request. Related cases carry a stable public-derived family hash.

The next promotion decision requires at least 150 genuinely review-worthy,
labelled operational cases where available, overall/PL/DE macro-F1 at least 0.90
where sample sizes are meaningful, mismatch recall at least 90%, zero
high-confidence mismatch-to-match failures, valid completion at least 99%, no
private-data violation, and measurable reviewer usefulness. Passing those gates
could authorize queue-priority influence only. Automatic source approval remains
out of scope and requires a separate architecture decision.
