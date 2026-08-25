## Route-specific JavaScript

| Route | Main gzip | Head gzip | Delta | Target | Status |
|---|---:|---:|---:|---:|---|
| Landing | 244.2 KiB | 178.0 KiB | -66.2 KiB (-27.1%) | 180.0 KiB | PASS |
| Login | 250.5 KiB | 250.7 KiB | +0.1 KiB (+0.1%) | not yet set | PASS |
| Contact | 247.8 KiB | 182.2 KiB | -65.7 KiB (-26.5%) | 150.0 KiB | PASS regression; target debt |
| Authenticated shell | 284.1 KiB | 284.2 KiB | +0.2 KiB (+0.1%) | not yet set | PASS |
| Product detail | 313.4 KiB | 313.6 KiB | +0.2 KiB (+0.1%) | not yet set | PASS |

Regression enforcement fails when either +10 KiB or +5% is exceeded. Existing target debt remains visible and is not redefined as a passing target.
