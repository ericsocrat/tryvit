# Revision cycle 1 → revision cycle 2

## Source differences

| Finding | Cycle 1 | Cycle 2 |
| --- | --- | --- |
| Live privacy truth | Denied account initialization despite the auth probe | States the minimal existing-session check and defers camera/product lookup |
| Demo privacy truth | Generic public statement | Explicitly no account/session lookup, camera, product lookup, or hosted fallback |
| Metadata | Locale-aware but readiness-blind | One six-state locale/readiness source shared with WebSite JSON-LD |
| Mobile navigation | Method, Trust, Contact hidden; Evidence hidden at 390 | Four section destinations on a dedicated second header level |
| Disclosure | Block `div` directly in `summary` | Phrasing-only spans with native semantics |
| Identity | Header and hero both owned full lockup/descriptor | Header owns one lockup/descriptor |
| 390 first fold | Package below authoritative Linux fold | Package signature fully visible in local governed capture |
| 1440 first fold | Actions fell below authoritative Linux fold | Both actions and package fully contained |

## Quantitative differences

| Metric | Cycle 1 | Cycle 2 | Change |
| --- | ---: | ---: | ---: |
| Mobile LCP median | 2410.05 ms | 2259.43 ms | −150.63 ms |
| Mobile LCP maximum | 2835.22 ms | 2260.90 ms | −574.31 ms |
| Mobile performance median | 0.97 | 0.98 | +0.01 |
| Mobile TBT maximum | 140 ms | 79 ms | −61 ms |
| Desktop LCP median | 627.48 ms | 563.47 ms | −64.01 ms |
| Landing Route-JS gzip | 182,296 B | 182,291 B | −5 B |
| Font transfer | 0 B | 0 B | unchanged |
| CLS maximum | 0 | 0 | unchanged |

## Artifact comparison policy

`evidence/cycle-comparison.json` lists every shared, added, removed, or changed
cycle-relative evidence path with old/new byte counts and SHA-256 values. Media changes
because identity ownership, navigation, copy, and first-fold geometry changed. LHRs,
performance summaries, Route-JS files, runtime/provenance, and manifests change because
the production source, build, runtime, and measured values changed. Review files are new
and cannot be inherited from cycle 1.

No cycle-1 file is modified in place.

