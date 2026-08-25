# Phase 5A.3 PR 1 — landing and route-local public shell

Status: **draft, unmerged, and not approved**.

This packet covers only `/` and its route-local Folded Label Register shell. It does not
migrate Learn, contact, legal, authentication, authenticated application, search,
product, or scanner routes. Global favicon, PWA icons, social-image routes, providers,
API behavior, database/RLS, Supabase migrations, hosted configuration, and cache policy
remain unchanged.

The corrected production candidate and media are bound to implementation commit
`1f7ad2c0e52833f06a3d17e010ad653b366ee291`, tree
`c6b75ba217967b1dcdb6a4c0b09adbe07514765d`, on base
`3f1c11f6d46fc1fd58a67c9c7be8296e8fdb345a`. Commit `ce422e56` only regenerated
the live route inventory, restored the immutable route-JS marker contract, and isolated
Phase 5A.2 test parsing from the new Phase 5A.3 projects.

## Candidate summary

- Source Fold supplies identity and editorial expression; Evidence Register supplies
  evidence, confidence, and missingness mechanics.
- The landing is server-rendered by default. Its only client islands are the theme
  toggle and the package-to-label narrative control.
- EN, PL, and DE copy is selected on the server; no critical proposition, evidence,
  method, privacy cue, navigation, or recovery content waits for hydration.
- The package visual, Source Fold mark, and domain glyphs are code-native SVG/CSS; no
  generic stock media or autoplay video was added.
- The audited Manrope/Source Serif 4 files were removed after both delivery trials
  missed the blocking LCP target. The candidate therefore retains system fonts.
- The landing produces zero intended Supabase Auth/REST/Realtime or authenticated
  feature-flag traffic in its guarded evidence run.

## Current decision

The request is **REVISE**, not approve. The stable mobile Lighthouse median LCP is
2558.5 ms, 58.5 ms above the 2500 ms blocking target. The immutable route-JS comparator
also cannot measure the redesigned landing because its base-owned identity assertion is
hard-coded to the retired hero headline. Changing that trusted comparator inside this
implementation PR would let the PR redefine its own judge, so it was not done.

The first Linux candidate-baseline attempt failed byte identity and withheld artifacts.
The corrected exact-source rerun `32823920912` then passed both guarded capture passes
byte-for-byte and produced source-bound candidate and determinism artifacts. Those
artifacts are proposals only; the immutable baseline remains unchanged and unapproved.

Formal trademark/legal clearance and qualified PL/DE language review are also absent.
Eric's explicit identity-adoption risk decision remains mandatory.

The inherited root WebApplication JSON-LD still advertises instant scanning and a
science-driven health score while this route truthfully reports paused live data; a
landing-only page cannot suppress that parent-layout script. Final review also found a
redundant pair of inherited and route-local skip links. Both require revision rather
than a post-evidence silent change.

See:

- [Evidence contract](EVIDENCE_CONTRACT.md)
- [Typography and identity](TYPOGRAPHY_AND_IDENTITY.md)
- [Legal screening](LEGAL_SCREENING.md)
- [Baseline strategy](BASELINE_STRATEGY.md)
- [Validation and impact](VALIDATION_AND_IMPACT.md)
- [Source and artifact inventory](SOURCE_AND_ARTIFACT_INVENTORY.md)
- [Final review synthesis](reviews/final/synthesis.md)
- [Media manifest](evidence/manifest.json)
- [Performance samples](evidence/performance.json)
- [Authoritative Linux candidates](evidence/linux-candidate.json)
