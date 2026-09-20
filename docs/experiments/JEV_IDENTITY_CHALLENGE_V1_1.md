# JEV identity challenge v1.1 amendment

This is a pre-inference methodology amendment. It occurred before blind review,
JEV inference, or benchmark freezing; no model output informed it. The v1
evidence artifacts, including its exact-stratum-overgeneration stop receipt,
remain immutable historical evidence.

The final benchmark is unchanged: 150 `MODEL_REVIEWED_CONSENSUS` cases, with
50 cases in each class and 25 PL plus 25 DE cases in each class. Historical
exclusions, source independence, verified-SKU and family uniqueness, semantic
payload leakage prevention, and reviewer independence are unchanged.

v1.1 changes construction only. Final strata are diversity constraints per
market: CONSISTENT strata require 2--6 cases, INCONSISTENT 2--5, and
INSUFFICIENT_EVIDENCE 3--7. Selection first meets diversity floors, then
minimizes distance from the historical v1 distribution with candidate hashes as
tie-breakers.

Initial blind-review readiness requires 30 valid unratified candidates in every
class/market cell and enough candidates for each diversity floor. The initial
queue contains 30 opaque semantic packets per cell. It is ordered only by
candidate/payload hash and diversity state, never JEV output or reviewer labels.
After independent review, deterministic replenishment releases the next unused
packets only when consensus cannot safely fill a 25-case cell. JEV inference
remains impossible until exactly 150 cases have construction-author and blind
reviewer consensus and pass all final safety checks.

This benchmark remains a balanced identity challenge, not an estimate of live
TryVit prevalence or production accuracy.

The v1.1 commands are separate from v1: `v1-1-prepare-review`,
`v1-1-replenish`, and `v1-1-freeze`. Preparation writes an internal immutable
queue manifest with full candidate order and release ranges, plus a separate
blind export that contains only an opaque token, semantic payload, and payload
hash. Replenishment may append only the next fixed range from that frozen
order. The v1.1 freeze command is the only v1.1 path that creates inference
manifests, and it requires exactly 150 `MODEL_REVIEWED_CONSENSUS` cases.

Every export, replenishment and freeze reconstructs and validates the complete
queue order against the validated safe pool. The queue binds the full pool and
its own state by SHA-256. Release ranges must be contiguous prefixes, starting
with `[0,30)`; later batches contain at most the next ten entries per cell.
Both reviews, nonempty attestations and timezone-bearing ISO timestamps are
required for every released case before replenishment. Recorded reviews cannot
be changed in later states.

`v1-1-replenish` requires `--reviewer-output` and emits only newly released
packets. Exported prefixes are persisted in the next queue state; blind packets
are sorted by opaque token, never grouped by hidden class. Transitions claim the
input queue using an exclusive adjacent `.consumed` receipt, so replaying that
parent under different output names fails closed. A crash after claiming a
transition requires manual recovery of the retained artifacts; never delete the
claim and automatically resend a potentially delivered batch. All output files
are create-only, and historical queues remain unchanged.

`v1-1-freeze` emits a single create-only bundle containing both pinned arm
manifests, the consensus ledger, the validated review-state snapshot, and a
receipt binding all four documents. Each case binds its semantic payload
separately. Use `verify-v1-1-freeze --candidate-pool ... --exclusion-index ...
--freeze ...` to recompute the entire selection, pins, balance, diversity,
family/SKU uniqueness, payload leakage checks and receipt bindings.
`v11_verified_provider_payloads` is the v1.1 runner boundary and verifies the
whole bundle before returning any semantic-only payload. There is no v1.1
network runner in this amendment; individual manifests are not authorization
to call JEV. The receipt keeps `inference_status = NOT_RUN`.
