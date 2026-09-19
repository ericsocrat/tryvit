# JEV source-review experiment evidence

The first isolated pilot remains `REJECT_OR_ITERATE`: overall macro-F1 was 0.794
and German macro-F1 was 0.540. Its result is historical evidence and was not
rewritten after the later prompt work.

A fresh family-isolated German diagnosis and validation selected the generic
`generic-abstention-v2` prompt only from a 90-case German development set. The
prompt SHA-256 is
`014135aad814b77554b79680146e5156c11e6f12b0f756127d290b468b846447`.
With pinned model `jev-1.13.0`, the fresh 120-case German held-out set reached
0.975 macro-F1 and 95% mismatch recall; the fresh 60-case Polish safety set
reached 0.983 and 100%. Both had zero high-confidence mismatch-to-match failures
and 100% completion. All frozen gates passed with no family or label leakage.

The decision was `ADOPT_AS_ADVISORY_CANDIDATE`, which authorizes only this local
shadow-mode tool. It does not authorize hosted calls, ingestion decisions,
database writes, source selection, or automatic approval. The concise immutable
receipt is `docs/experiments/evidence/jev-advisory-validation-20260919.json`.
