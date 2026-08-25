# Eric's Phase 5A.2 Checkpoint 2 approval

> **Last updated:** 2026-08-25
> **Status:** Approved and merged — non-production design and evidence gate
> **Owner issue:** Frontend domain
> **Authority granted:** Normal squash merge of PR `#1295`; no production migration or adoption

## Authoritative decision

Eric approved Phase 5A.2 Checkpoint 2 and authorized the normal-ruleset squash merge of
PR `#1295`.

The selected decisions are:

1. **Visual and interaction system:** Folded Label Register.
2. **Master identity and expressive language:** Source Fold.
3. **Product/evidence information architecture:** Evidence Register, including observed,
   calculated/derived, contextualized, and decision/action ordering; explicit confidence;
   explicit partial, unknown, and unavailable states; and early mobile presentation of
   the decision, confidence, main reason, and next action.
4. **Preferred later production typography direction:** Manrope with restrained Source
   Serif 4.
5. **Approved non-production Golden References:** landing, authentication, authenticated
   home, search and filters, product/evidence, and scanner.

The typography selection is a later production direction, not adoption. PR `#1295` did
not change the production font stack. Each route-family migration must independently
retain green licensing, provenance, fallback, CLS, transfer, and route-performance
evidence before adopting the fonts.

## Merge and certification record

- Approved PR: `#1295`.
- Approved source head: `1a60ba8fc0a1ddf55ff8137a893b32032958fe5e`.
- Approved source tree: `f76dfd5436470ec5690abacc15272b35f22d1b8d`.
- Golden Reference squash: `fd75e5503ca4b3c996a704b41d8a2582905492c9`.
- Squash parent: `72eb2ab55c89a1913488cbd7447d03982da5e503`.
- Squash tree: `f76dfd5436470ec5690abacc15272b35f22d1b8d`, exactly the
  approved source tree.
- Subsequent current-main PR: `#1299`.
- Certified current main at closure entry: `1c5586bfca7598e14359b472658fe8451c0fa0e5`.
- Certified current-main tree: `76686814ddbf5d106488f5c9fd4f33784da05f28`.

PR `#1299` is the direct child of the Golden squash. Its only change is three pinned
CodeQL Action updates in `.github/workflows/codeql.yml`; it does not change Golden
Reference source or evidence.

Exact-current-main certification passed:

- Main Gate/Sonar: run `32789804202` — success.
- Phase 5A.2 Golden References: run `32789807741` — success.
- Repository hygiene: run `32789806058` — success.
- Post-deploy smoke: run `32789811742` — success.
- Code Scanning alerts: zero.
- Secret Scanning alerts: zero.
- Open Dependabot alerts: three inherited alerts, `#92`–`#94`.

## Retained production constraints

The approval does not waive or conceal the conservative production-performance record:

- `/app` mobile baseline: `0.83`;
- target: `0.85`;
- retained TBT sample: `538 ms`;
- retained landing outlier: `0.65`.

These observations did not block the non-production gate. They remain blocking evidence
for production migration and may not be reclassified as resolved without later measured
approval.

## Unresolved later review requirements

The following remain unresolved and must not be described as completed:

- trademark and legal clearance;
- qualified Polish and German review;
- real assistive-technology review;
- representative real-device and hybrid-input testing;
- branded Safari;
- real camera/scanner testing;
- password-manager and autofill testing;
- production and field performance.

## Authority boundary

Checkpoint 2 is approved and Phase 5A.2 is complete as a non-production design and
evidence gate. This record does not authorize production-route migration, production
identity or font adoption, release, a performance-debt waiver, or later Phase 5 work.

Phase 5A.3 is the next planned phase and requires separate implementation authorization.
No Phase 5A.3 implementation was started by this closure task.

Historical capture sources, manifests, artifact IDs, reviews, scores, superseded packets,
and rejected attempts remain frozen and unchanged.
