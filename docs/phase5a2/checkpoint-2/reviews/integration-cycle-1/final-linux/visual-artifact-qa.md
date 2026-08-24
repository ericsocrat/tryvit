# Linux-renderer visual/provenance QA recheck

> Provenance: **PASS**; visual/media QA: **PASS**; exact defects: **none**.

The lane verified 246,254-byte manifest
`bf05a824e4b4e6d6cd68c8a0b9c525cbc4b1674eebe3cfd9faa220ae306e8364`,
90 listed files / 7,150,882 bytes, 91 total files / 7,397,136 bytes, every file hash,
72 unchanged / 18 changed, and the 8,164-byte proof
`00cfa9cc3732add05fb48d9d9f2f3c9ffcacb85a265949637cb41e6fcb9577ab`.

Both boards and all 1,091 frames of the 12 WebMs decoded and passed. There is no hidden
overflow, clipping, collision, blank frame, stale state, terminal mismatch, or report/
manifest discrepancy. Font/license/runtime/resilience/performance arithmetic passes.
This result is review-only and does not authorize production.
