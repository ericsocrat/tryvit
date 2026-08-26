# Eric decision request

Requested disposition: **REVISE**.

## Blocking engineering item

The exact-source mobile LCP median is `2410.05 ms` against `2400 ms`; two retained
samples are `2779.01` and `2835.22 ms` against the `2500 ms` per-sample limit. The
remaining performance budgets pass. Do not approve or merge while this gate remains.

Fresh review also requires revision of:

- live privacy copy that denies account initialization while live readiness performs an
  auth user probe/subscription;
- demo description/OG/Twitter metadata that is localized but no longer readiness-aware;
- mobile header navigation that hides all content destinations at 390 CSS pixels;
- block content directly inside `<summary>` without Safari/AT validation;
- system-font differences that move actions below the authoritative Linux first fold;
- repeated desktop identity ownership between header and hero.

## Mandatory identity-risk decision

The public screen retains the material `TRYVITE` EUTM `018026887` finding. This packet
is not legal clearance. Eric must choose exactly one path before production adoption:

1. obtain professional trademark assessment before adopting the identity;
2. provisionally accept the risk, with an owner and recorded deadline before public
   launch/indexing for qualified assessment; or
3. reject or revise the identity.

Codex does not select or self-approve that business/legal choice.

## Language and human validation

Qualified PL and DE review has not occurred and remains a merge blocker for
consequential public copy. Automated locale, text-spacing, reflow, and screenshot checks
do not substitute for native review.

Representative physical-device, branded Safari, screen-reader, voice-control, and
camera checks were not available. No approval is claimed for them. Camera/scanner is
outside this landing PR.

## Baseline boundary

The exact deterministic Linux landing candidates are ready, but PR `#1301` must not
replace its own immutable baseline. If Eric later approves an exact candidate, baseline
replacement requires a separately authorized PR.

Reviewer A disposition: **REVISE**. Reviewer B disposition: **REJECT the exact
candidate**. The primary handoff remains **REVISE** because the direction can be
corrected, but this source is not approvable.
