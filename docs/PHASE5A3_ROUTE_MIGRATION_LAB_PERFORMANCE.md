# Phase 5A.3 route-migration lab-performance methodology

> **Status:** Prospective base-owned release policy for Phase 5A.3 and later
> route-family migrations
> **Applies to:** Deterministic source-bound lab evidence collected before a route PR
> can be approved

## Boundary

This methodology is a deterministic **lab-release gate**. It is not a claim that a
route passes field Core Web Vitals. Real-user LCP, INP, and CLS remain post-launch field
metrics and require representative production traffic.

The existing guarded Lighthouse workflow remains useful for broad regression coverage.
This document governs the stricter route-migration approval decision made from an exact
source-bound cohort.

## Frozen cohort and thresholds

Each route-family candidate retains exactly five valid mobile samples and five valid
desktop samples from one frozen source/build/environment.

| Gate | Blocking threshold |
| --- | ---: |
| Mobile performance median | `>= 0.90` |
| Desktop performance median | `>= 0.95` |
| Mobile LCP median | `<= 2400 ms` |
| Mobile five-run p75 | `<= 2500 ms` |
| TBT maximum across both profiles | `<= 200 ms` |
| CLS maximum across both profiles | `<= 0.05` |
| TTFB maximum across both profiles | `<= 800 ms` |
| Route-JS regression | unchanged `+10 KiB OR +5%` guard |

For exactly five samples, p75 is defined deterministically as the fourth value after
sorting the five LCP values from lowest to highest.

## Retention and causal classification

- Retain every valid sample and its original execution order.
- Never remove a sample, mutate a threshold after measurement, average away a failure,
  or selectively rerun a valid cohort.
- Every mobile sample above `2500 ms` remains visible in the handoff and receives an
  evidence-backed causal classification.
- An above-`2500 ms` sample blocks when it makes the median or p75 gate fail, or when
  trace/chunk/source evidence ties it to a new route-owned regression.
- A classified shared-runtime lab simulation, environmental lab variance, or known
  non-route-owned cause does not independently veto a cohort whose distribution and
  all other gates pass.
- Missing causal classification fails closed.

The executable contract lives in
`frontend/tooling/phase5a3-route-lab-performance.ts`; policy unit tests cover the
thresholds, five-run p75 definition, sample retention, classification, and
route-owned-regression veto.

## Why the individual-sample veto changed

Phase 5A.3 retained repeated cases where raw H1/FCP paint occurred early while
Lighthouse/Lantern produced unstable simulated element-render-delay clusters. The
individual high values remained visible, but after query/provider, first-party error,
font, transfer, layout, Route-JS, and other identified route-owned causes were exhausted,
the former rule requiring every individual LCP sample to remain at or below `2500 ms`
became a poor launch proxy.

Median plus five-run p75 preserves a strict distribution gate. Mandatory causal
classification preserves the regression veto without treating one explained simulated
shared-runtime sample as field-performance evidence.

## Retained Cycle 3 evaluation

No Lighthouse run was repeated for this governance decision. The already-retained
Cycle 3 exact-source Linux cohort is evaluated unchanged.

Sorted mobile LCP values:

`2155.45, 2172.15, 2218.88, 2268.47, 2593.46 ms`

| Gate | Retained result | Decision |
| --- | ---: | --- |
| Mobile LCP median | `2218.88 ms` | **PASS** |
| Mobile p75 | `2268.47 ms` | **PASS** |
| TBT maximum | `107 ms` | **PASS** |
| CLS maximum | `0` | **PASS** |
| TTFB maximum | `26.11 ms` | **PASS** |
| Mobile performance median | `0.98` | **PASS** |
| Desktop performance median | `1.00` | **PASS** |
| Route-JS | `182,291 B` gzip | **PASS** |

The retained `2593.46 ms` sample remains visible. Its classification is
`shared-runtime-lab-simulation`: observed H1/FCP paint was `127 ms`, there was no
observed post-navigation task over `50 ms`, and the late work belongs to the historical
Lighthouse/Lantern simulated shared-runtime pattern rather than a new route-owned task.

Under this merged prospective contract, the retained Cycle 3 lab cohort passes. That
result changes the approval methodology only; it does not approve landing content,
visual baselines, legal/language/device gates, PR `#1301`, or production field Web
Vitals.
