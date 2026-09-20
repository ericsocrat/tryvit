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
