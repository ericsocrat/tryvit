# Frozen classic evidence contracts

These five files are exact pre-Mini schema snapshots from commit `7fb0473`.
They are imported only by `tests/evidence-mini-equivalence.test.ts` as an
independent acceptance and parsed-output oracle. Keep them out of production
imports and do not mechanically update them with production schema edits.

The mutation corpus probes each nested field, optional/deleted members, numeric
bounds, string bounds, source IDs, URLs, timestamps, duplicate arrays and unknown
keys. Classic URL refinement exceptions are intentionally normalized to rejected
parses in the new implementation; accepted output is otherwise identical.
