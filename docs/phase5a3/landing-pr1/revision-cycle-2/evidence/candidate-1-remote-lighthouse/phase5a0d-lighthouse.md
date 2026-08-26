# Phase 5A.0d Lighthouse report

Status: **PASS** (lab-only; INP and field CWV unavailable)

| Route | Profile | Perf | A11y | BP | SEO | LCP ms | CLS med/max | TBT ms | TTFB ms | Transfer KiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| landing | public/mobile | 0.96 | 1 | 0.96 | 1 | 2625 | 0/0 | 93 | 23.1 | 257.3 |
| login | public/mobile | 0.95 | 1 | 0.96 | 1 | 2820 | 0/0 | 43 | 19.6 | 367.7 |
| contact | public/mobile | 0.95 | 1 | 0.96 | 1 | 2827.5 | 0/0 | 39 | 15 | 308.6 |
| landing | public/desktop | 1 | 1 | 0.96 | 1 | 560.4 | 0/0 | 0 | 14.3 | 257.3 |
| login | public/desktop | 1 | 1 | 0.96 | 1 | 651.3 | 0/0 | 0 | 16.2 | 367.6 |
| contact | public/desktop | 1 | 1 | 0.96 | 1 | 611.7 | 0/0 | 0 | 15.9 | 306.6 |
| app-shell | local-authenticated/mobile | 0.86 | 1 | 0.96 | 1 | 4139.3 | 0/0 | 84 | 120.1 | 410.7 |
| product-detail | local-authenticated/mobile | 0.9 | 0.96 | 0.96 | 1 | 3444.3 | 0/0 | 129.5 | 118.7 | 456.8 |
| app-shell | local-authenticated/desktop | 0.99 | 1 | 0.96 | 0.92 | 835.9 | 0/0 | 0 | 104.4 | 489.7 |
| product-detail | local-authenticated/desktop | 0.99 | 0.96 | 0.96 | 1 | 849.7 | 0/0 | 0 | 116 | 496.2 |

## Blocking failures

- None

## Instability failures

- None

## Directional blueprint debt

- public/mobile/landing:blueprint:lcp-median-above-2500ms
- public/mobile/login:blueprint:lcp-median-above-2500ms
- public/mobile/contact:blueprint:lcp-median-above-2500ms
- local-authenticated/mobile/app-shell:blueprint:lcp-median-above-2500ms
- local-authenticated/mobile/product-detail:blueprint:lcp-median-above-2500ms

Report checksum: `b62227cb8b4cfe4c4dfb764b718c180c41b65ce33215ca2c1a916bb76ead2b60`
