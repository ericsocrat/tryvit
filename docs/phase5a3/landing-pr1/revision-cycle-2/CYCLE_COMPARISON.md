# Cycle comparison

| Stage | Source | Main result | Disposition |
| --- | --- | --- | --- |
| Cycle 1 | `64f015ee` | Truth/navigation/fold findings; Linux LCP red | REVISE |
| Cycle 2 candidate 1 | `14c8b19f` | Local LCP green; legacy social/manifest and console 404; remote Linux LCP red | REVISE |
| Cycle 2 replacement | `6f675ffe` | Social/console/anchors/accessibility fixed; Linux LCP/TBT and 390 specimen overlap red | REVISE |

Candidate-1 media, metrics, manifest, and reviews remain under its own namespace. The
replacement file-by-file ledger compares Cycle 1, candidate 1, and candidate 2 hashes
without rewriting either predecessor.

## Quantitative comparison

| Metric | Cycle 1 local packet | Candidate 1 local | Candidate 1 remote Linux | Replacement Linux |
| --- | ---: | ---: | ---: | ---: |
| Mobile LCP median | 2410.05 ms | 2259.43 ms | 2624.97 ms | 2630.71 ms |
| Mobile LCP max | 2835.22 ms | 2260.90 ms | 2711.07 ms | 2821.25 ms |
| Mobile TBT max | 140 ms | 79 ms | 104 ms | 262 ms |
| Best Practices | 0.96 | 0.96 | 0.96 | 1.00 |
| Console / first-party 4xx | present | present | present | zero |
| Landing Route-JS gzip | 182,296 B | 182,291 B | 182,291 B | 182,291 B |
