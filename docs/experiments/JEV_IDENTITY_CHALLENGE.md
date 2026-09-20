# JEV identity challenge benchmark

This benchmark is a balanced identity challenge, not an estimate of live TryVit
class prevalence or expected production accuracy. It is separate from the
36-case operational shadow cohort and has no product or source-selection authority.

Construction requires 150 consensus-labelled, family-unique cases: 25 PL and
25 DE cases for each of CONSISTENT, INCONSISTENT, and INSUFFICIENT_EVIDENCE.
Candidate construction, hidden dossiers, label ledgers, excluded candidates, and
model-visible payloads are separate artifacts. Only semantic identity fields may
enter either inference arm; EANs, URLs, hashes, source metadata, labels, strata,
and provenance are forbidden.

The fixed semantic schema is product name, brand, manufacturer/owner, publicly
evidenced aliases, variant/flavor, formulation/fat, preparation, quantity,
package form/count, product kind, and other non-unique identity attributes.
Arm A supplies its minimal base fields; Arm B adds values only within this same
schema.

Arm A uses `generic-abstention-v2`. Arm B uses the separately frozen public-evidence
adjudication prompt. Neither arm may read the other arm's results.

## Construction workflow

`pipeline.jev_identity_challenge` is an offline-only construction utility. It
creates an exclusion index from frozen historical artifacts, validates a raw
candidate pool, emits an opaque blind-review packet, and freezes the 150-case
benchmark only after the construction author and blind reviewer agree. A
candidate pool must contain at least 40 candidates in each class/market cell
before review; deterministic replenishment adds candidates without weakening
that requirement.
candidate with same-publisher evidence is rejected unless its hidden dossier
records an explicit authoritative-source exception. Every final dossier must
record the public source URL, publisher/domain, capture time, evidence role,
and source digest; these facts never enter either model payload.

The frozen artifacts are kept under the ignored
`audit-reports/jev-identity-challenge-v1/` namespace:

- `candidate-discovery.json` — unratified hypotheses only.
- `candidate-pool.json` — full hidden dossiers, before reviewer ratification.
- `blind-review-packets.json` — opaque tokens plus semantic packets only.
- `consensus-label-ledger.json` and `rejected-candidate-audit.json` — labels
  and disagreements, never provider inputs.
- `arm-a-minimal-manifest.json` and `arm-b-enriched-manifest.json` — separate,
  hash-bound semantic inputs for future evaluation.
- `freeze-receipt.json` — binds every immutable artifact and records
`NOT_RUN` until separately authorized inference.

The only value a future provider client may obtain from an arm manifest is
`provider_payload(...)`, which discards its local case reference and validates
the semantic-only payload again. It cannot send an EAN, URL, source publisher,
hash, label, stratum, reviewer data, or provenance field.

The validator also requires Arm B to preserve every Arm A base-field value,
requires hidden evidence that every insufficient-evidence packet has two
source-grounded plausible completions, and rejects a final cohort unless null
counts for every visible semantic field/side match across the three classes.
That makes naturally incomplete consistent and inconsistent cases mandatory,
rather than allowing missingness itself to reveal the expected label.

## Predefined analysis

For both arms, the later comparison computes per-class precision/recall/F1,
overall accuracy, macro-F1, dangerous true-INCONSISTENT to CONSISTENT errors,
unnecessary rejections, by-market/stratum/family results, cost, attempts, and
latency. Calibration uses top-label confidence, 10 equal-frequency bins with
deterministic case-hash tie-breaking, top-label ECE, and multiclass Brier.
It reports 10,000 stratified paired bootstrap percentile intervals over the six
25-case class-market cells. These intervals are descriptive: they never
override the zero dangerous-false-consistent safety gate.

Arm B can be considered for a later advisory decision only when all frozen
gates pass: valid completion at least 99%, zero dangerous errors, inconsistent
recall at least 96%, consistent precision at least 95%, consistent recall at
least 90%, insufficient-evidence recall at least 80%, macro-F1 at least 0.88,
macro-F1 improvement over Arm A at least 0.05, no additional dangerous errors,
ECE at most 0.10, Brier at most 0.25, cost at most $0.10, p95 latency at most
five seconds, and no integrity or leakage failure.
