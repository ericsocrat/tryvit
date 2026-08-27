# Mobile LCP diagnosis and bounded trials

## Diagnosis

The predecessor cohort selected `h1#landing-title` in every sample at 354×186. It
transferred zero font bytes and no LCP image. The retained predecessor median was
2558.5 ms. After prerequisite merge and interaction corrections, the fresh baseline was
2708.2 ms.

Raw trace evidence paints the H1 with FCP near 100–160 ms. Lighthouse 12.6.1's simulated
result averages optimistic and pessimistic Lantern graphs. When a follow-up Next/React
task that performed layout begins immediately before the observed LCP cutoff, the
pessimistic graph includes it and the simulated LCP jumps by several hundred
milliseconds. When it begins just after the cutoff, it is excluded. This explains the
discrete clusters and why visible H1/CSS changes often worsened rather than improved the
judge.

The older `render-blocking-resources` audit reported zero savings, while the newer
`render-blocking-insight` estimated 350 ms. A global experimental inline-CSS trial
removed both stylesheet requests but worsened median LCP and HTML transfer, so it was
rejected. The final raw and simulated phases are separated in `performance.json`.

## Retained source corrections

- Deferred Supabase client import until the live-only auth effect runs.
- Exact cold-document provider boundary reducing landing HTML transfer while keeping
  RSC/prefetch/query navigations on the application boundary.
- Native package disclosure, eliminating its React mount flip and improving no-JS.
- Hydration-stable theme control with the disabled no-JS fallback retained.

These corrections reduced cold landing Route-JS by 67,749 gzip bytes and substantially
improved the median, while preserving every valid sample.

## Rejected one-variable trials

The branch history and `performance-trials.json` retain normal wrapping, reduced H1,
content visibility, inline CSS, compact React narrative, native disclosure alone,
theme stabilization alone, server-led theme, mobile identity consolidation, auth-state
module split, and their explicit reverts. Thresholds never changed and no outlier was
deleted.

The selected final tree is the closest bounded result that preserves the approved
character and contracts. Its exact final cohort still fails mobile LCP, so the correct
disposition is REVISE rather than another unbounded architecture experiment.
