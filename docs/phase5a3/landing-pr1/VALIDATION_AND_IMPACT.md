# Validation and impact

## Architecture and scope

`page.tsx`, `HomePageContent.tsx`, `LandingSections.tsx`, and the route-local public
shell remain Server Components. Locale and final EN/PL/DE copy resolve on the server.
Only `LandingThemeToggle.client.tsx` and
`PackageLabelNarrative.client.tsx` declare `use client`; both receive serializable
props. No global client shell, animation provider, runtime dependency, root layout,
provider, authenticated component, API, Supabase, database, PWA, or hosted-config change
was introduced.

The production path is rollback-local: restore the three landing entry modules and
remove `_landing-v2`. Evidence tests and live inventory can be reverted independently.

## Accessibility and resilience

- Full-page Axe: zero violations with no exclusions or disabled rules.
- Keyboard: skip link is first, transfers focus to `main`, then reaches Evidence.
- Reflow: 320 CSS pixels and the 200% equivalent capture have no horizontal overflow.
- WCAG text spacing: Polish capture passes without clipping or overlap.
- Forced colors: dedicated capture retained.
- No JavaScript: complete light/dark proposition, evidence, method, privacy, actions,
  navigation, and footer remain server rendered.
- Reduced motion: complete equivalent recording retained.

Not performed: qualified screen-reader/voice-control audit, physical keyboard and touch
device matrix, real camera/scanner work (out of scope), native PL/DE review, or field
RUM. Browser automation does not substitute for those checks.

## Transfer and performance

The final system-font candidate has median cold transfer 300,006 bytes mobile and
300,004 bytes desktop. Median resource transfer is approximately 198.4 KB script,
36.0 KB stylesheet, 0 font, 1.9 KB shared/global image, and 46.7 KB document. The landing
adds no raster hero media; hero-media transfer is 0 bytes.

Five-run Lighthouse medians:

| Profile | Performance | LCP | TBT | CLS | TTFB | Transfer | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Mobile | 0.97 | 2557.1 ms | 59 ms | 0.00002 | 13.6 ms | 300,006 B | **BLOCK: LCP +57.1 ms** |
| Desktop | 1.00 | 635.2 ms | 0 ms | 0 | 13.0 ms | 300,004 B | PASS |

All samples and ranges are in `evidence/performance.json`. Motion observation records
zero CLS and no long tasks. A Chrome DevTools trace was unavailable because no supported
stable-system Chrome executable was installed; guarded Lighthouse and the repository-
pinned Playwright Chromium were used instead.

## Test record

Passing local checks retained during implementation:

- TypeScript, ESLint, production build;
- focused landing/unit contracts (52 tests);
- safety runner/workflow/landing contracts (118 tests);
- final Phase 5A.3 guarded landing review (20 tests);
- targeted responsive guarded review (24 tests);
- exact Polish text-spacing check;
- route-JS public capture itself (three public routes) when run with the head harness;
- regenerated live route inventory and four affected governance suites (79 tests).

The full exact-head unit suite and final guarded smoke are rerun before handoff; their
final results will be recorded in the PR description and reviewer synthesis.

## Blocking and external items

1. Mobile LCP misses the blocking target by 57.1 ms.
2. The trusted route-JS base harness cannot identify the redesigned landing because it
   hard-codes the retired H1. PR run `32803213246` therefore failed before producing a
   comparison. The PR deliberately did not change the base-owned judge.
3. Immutable visual baseline verification fails by design until a separately authorized
   baseline update is approved.
4. Formal trademark clearance and qualified native-language approval are absent.

