# Phase 5A.2 direction benchmarks

Status: Checkpoint 1 research baseline

Observed: 2026-08-17

Scope: interaction and information-design principles for guarded direction
studies; not production requirements, scientific validation, or legal clearance

## Executive Summary

- **Make the decision fast and the proof patient.** The first viewport should
  identify the product, state the most useful interpretation, name the leading
  reason, and offer one next action. It should never collapse the underlying
  evidence into an unexplained score.
- **Use one Evidence Spine.** Every conclusion should be traceable through
  **Observed → Calculated → Contextualized → Decision**. Missingness,
  uncertainty, method version, and source identity remain visible at the layer
  where they arise.
- **Treat scanning and adaptation as state changes, not visual effects.** The
  scanner must explain permission, readiness, detection, lookup, recovery, and
  manual-entry states. Wider layouts should add useful adjacency, not simply
  stretch a phone screen.
- **Borrow mechanisms, not signatures.** The benchmark value lies in hierarchy,
  comparability, provenance, and recovery behavior. TryVit must not reproduce a
  peer's score taxonomy, copy, palette, icons, distinctive tab model, chart
  styling, scanner reticle, or product-comparison trade dress.

## Decision model: fast decision, slow proof

The direction should support two reading speeds without creating two versions
of the truth.

### Fast decision

The immediate result should contain only what is needed to orient and act:

1. verified product identity and data freshness;
2. a plain-language directional result;
3. the highest-impact reason, including a warning when evidence is incomplete;
4. one appropriate action, such as inspect, compare, rescan, or choose an
   alternative.

The fast layer is an index into evidence, not a substitute for it. Color can
reinforce state but cannot carry meaning alone.

### Slow proof: the Evidence Spine

| Layer | Question it answers | Required contents | Failure to avoid |
| --- | --- | --- | --- |
| **Observed** | What did TryVit actually receive? | Label values, ingredients, barcode, source/provider, observation or verification date, locale and serving basis, and explicit missing fields. | Presenting inferred or stale data as a package fact. |
| **Calculated** | What did TryVit derive? | Normalization, formula inputs, thresholds, weights, method version, and reproducible intermediate results. | Hiding judgment inside an unexplained score. |
| **Contextualized** | What does the result mean here? | Relevant authority or research context, exposure and applicability limits, uncertainty, user preferences, and comparable alternatives. | Turning hazard into personal risk or association into causation. |
| **Decision** | What can the person reasonably do next? | Concise interpretation, reason, action, limitations, and a route back to every supporting layer. | Framing a product opinion as medical advice or certainty. |

This separation follows the strongest shared principle in the evidence
benchmarks: [RTINGS](https://www.rtings.com/company/test-benches-and-scoring-system)
versions the path from measurement to score,
[EFSA](https://www.efsa.europa.eu/en/topics/topic/food-additives) separates
hazard information from exposure-based assessment, and
[Cochrane](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-15)
keeps effect, certainty, applicability, and decisions distinct. The TryVit
expression should be its own, but every decision must remain reversible back
through the spine.

## Product and evidence benchmarks

The observations below use only first-party product pages or primary
institutional guidance. Product-company pages describe their own products and
claims; they are interaction benchmarks, not independent validation of health
outcomes.

### Yuka — answer first, reasons one level deeper

- **Dated observation — 17 August 2026.** Yuka's current app page presents scan,
  result detail, alternatives, history, and an easy-to-read color treatment as
  one consumer loop. Its EU/UK terms describe an automated food score weighted
  across nutritional quality, additives, and organic certification, while also
  warning that label-derived records can contain errors and that the score is
  an opinion rather than medical advice. [Yuka application](https://yuka.io/en/app/)
  and [EU/UK terms](https://help.yuka.io/l/en/article/nui6tegnjw-terms-conditions-ue-uk)
- **Exceptional principle.** A quick classification remains inspectable: the
  person can move from the headline judgment to the factors that produced it
  and then to a practical alternative.
- **TryVit takeaway.** Lead with one directional result, but expose the raw
  nutrition, additive, method, and provenance contributions immediately below
  it. A suggested alternative must state why it is comparable and better for
  the selected concern.
- **Unsuitable element.** Do not adopt Yuka's weighting, hard score caps,
  health-language taxonomy, or assumption that one universal ranking fits
  every person and consumption context.
- **Generic/derivative risk.** Barcode-to-number, traffic-light colors, and a
  better-alternative carousel are common patterns and weak identity material.
  Reusing Yuka's four-color hierarchy, score language, card sequence, or
  recommendation presentation would read as derivative even if the data were
  different.

### ZOE — classify the mechanism, not just the category

- **Dated observation — 30 July 2026.** ZOE describes a photo-led scanner that
  returns a result in seconds and classifies processing with four risk bands.
  Its explanation uses several factors rather than NOVA classification alone,
  and its latest microbiome article reports associations from ZOE datasets;
  those company-reported associations are not a causal or independent product
  validation. [ZOE scanner and microbiome research](https://zoe.com/learn/zoes-ultra-processed-food-scanner-new-microbiome-research)
- **Exceptional principle.** A broad label such as “ultra-processed” becomes
  more useful when the interface explains the product-specific mechanisms that
  changed the interpretation.
- **TryVit takeaway.** When a category is heterogeneous, surface the decisive
  factors and counter-evidence. A product should not inherit a severe result
  merely because it belongs to a broad class.
- **Unsuitable element.** Do not import ZOE's proprietary risk bands,
  microbiome ranking, marketing claims, or language that implies a scanner has
  established an individual's health outcome.
- **Generic/derivative risk.** Photo capture followed by colored risk bands is
  now category-generic. Mirroring ZOE's four labels, “reveal” framing, scanner
  composition, or microbiome narrative would create a stronger derivative
  association.

### Oura — daily focus backed by baseline and history

- **Dated observation — 5 November 2025 and 14 July 2026.** Oura's redesign
  makes one daily focus the entry point, keeps core measures in a quick-glance
  view, and moves long-term strengths and trends into a deeper health view.
  Its current Trends guidance distinguishes the latest measurement from a
  longer-period average and supports multiple time grains. [Oura app redesign](https://ouraring.com/blog/new-app-design/)
  and [Using Trends](https://support.ouraring.com/hc/en-us/articles/360055983614-Using-Trends)
- **Exceptional principle.** Present state, personal baseline, and longitudinal
  pattern have different jobs; separating them reduces noise without hiding
  history.
- **TryVit takeaway.** Give the current product decision a single focus, then
  let people inspect ingredients, recurring patterns, or comparison history at
  the appropriate time scale. Clearly distinguish product facts from a user's
  own history.
- **Unsuitable element.** Do not turn a food scan into a readiness ritual,
  biometric coaching model, or pseudo-personal baseline when TryVit lacks the
  longitudinal evidence to support it.
- **Generic/derivative risk.** “Today / Vitals / My Health,” circular wellness
  scores, biometric color fields, and Oura's calm dark visual language are
  recognizable signatures. The temporal hierarchy is reusable; its naming and
  expression are not.

### RTINGS — comparable measurements need a versioned method

- **Dated observation — 23 March 2026; comparison feature documented 28 January
  2020.** RTINGS ties measurements, scoring curves, and ratings to named test
  bench versions, warns when major method changes break comparability, and
  exposes the methodology. Its side-by-side tool promotes differences that are
  material to a selected use case rather than listing every difference equally.
  [Test benches and scoring system](https://www.rtings.com/company/test-benches-and-scoring-system)
  and [side-by-side tool](https://www.rtings.com/company/side-by-side)
- **Exceptional principle.** Comparability is a governed property: identical
  rows are meaningful only when products share the same measurement and method
  version.
- **TryVit takeaway.** Product comparisons should align like-for-like observed
  values, show method compatibility, and elevate only decision-relevant
  differences. Method revisions require explicit version and compatibility
  handling.
- **Unsuitable element.** Do not transplant RTINGS' 0-to-10 ratings, weighted
  difference formula, lab language, or consumer-electronics assumption that all
  relevant properties can be measured under one test bench.
- **Generic/derivative risk.** Side-by-side tables are generic; RTINGS' score
  tiles, exact hierarchy, test-bench terminology, and blue/gray review grammar
  are distinctive. TryVit should use its own evidence labels and visual rhythm.

### Apple Compare — stable rows make dense choice legible

- **Dated observation — 17 August 2026.** Apple's current iPhone Compare page
  lets people choose models and aligns repeated attributes such as price,
  display, capability availability, and battery information, with footnotes for
  test conditions and limitations. [Apple iPhone Compare](https://www.apple.com/iphone/compare/)
- **Exceptional principle.** A stable attribute schema lets differences emerge
  without requiring the reader to remember one product while inspecting
  another.
- **TryVit takeaway.** Keep compared products pinned to the same nutrient,
  ingredient, additive, serving, provenance, and uncertainty rows. Collapse
  identical low-value rows and foreground consequential differences without
  deleting the evidence.
- **Unsuitable element.** Do not use a long marketing-spec catalog, promotional
  superlatives, purchase-first calls to action, or footnotes as a place to hide
  material uncertainty.
- **Generic/derivative risk.** Aligned specification rows are generic. Apple's
  device silhouettes, typography, large white-space cadence, sticky product
  rail, iconography, and availability marks form recognizable trade dress and
  should not be imitated.

### EFSA — distinguish presence, hazard, exposure, and regulatory status

- **Dated observation — reviewed 13 and 30 April 2026.** EFSA explains that EU
  food additives are assessed before authorization and that assessment uses
  chemical and biological properties, toxicology, and dietary exposure. It
  also records follow-up states such as missing data, revised acceptable daily
  intake, and potential population-level exceedance. OpenFoodTox 3.0 exposes
  structured hazard summaries and references back to EFSA assessments.
  [EFSA food additives](https://www.efsa.europa.eu/en/topics/topic/food-additives)
  and [OpenFoodTox](https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox)
- **Exceptional principle.** The presence of a substance is not itself a risk
  conclusion; identity, hazard, exposure, population, reference values, and
  data gaps must remain distinguishable.
- **TryVit takeaway.** An additive view should state what was observed, its
  authorization or assessment status, what evidence says, whether exposure can
  be estimated, and what remains unknown. Authority name and assessment date
  belong beside the claim.
- **Unsuitable element.** Do not convert an E number, hazard endpoint, or open
  data row directly into a red product verdict. Do not imply EFSA endorsement
  of TryVit's interpretation.
- **Generic/derivative risk.** Regulatory tables and substance identifiers are
  generic facts; EFSA branding, official visual conventions, copied summaries,
  or authority-like seals would risk false affiliation. The larger risk is
  authority laundering through incomplete citation.

### Cochrane — certainty belongs beside the finding

- **Dated observation — Handbook version 6.5 (2024), chapter last updated
  August 2023; checked 17 August 2026.** Cochrane's guidance asks reviewers to
  cover important benefits and harms, evidence certainty, bias, completeness,
  applicability, and the uncertainty around estimates. It cautions against
  treating absence of evidence as evidence of no effect. [Cochrane Handbook, Chapter 15](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-15)
  and [Chapter 14](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14)
- **Exceptional principle.** Effect size, certainty, applicability, and the
  eventual choice are related but independent dimensions.
- **TryVit takeaway.** Put confidence and applicability beside health-context
  claims, not in a distant disclaimer. Use calibrated language and preserve
  adverse, conflicting, or indirect evidence where it could change the choice.
- **Unsuitable element.** Do not display GRADE certainty labels unless TryVit
  has actually followed the method. Do not use a food interface to make
  treatment recommendations or imply Cochrane review status.
- **Generic/derivative risk.** Evidence tables are generic, but copying Summary
  of Findings structure, certainty labels, or Cochrane styling can falsely
  signal methodological equivalence or endorsement.

### Our World in Data — provenance is part of the interaction

- **Dated observation — 18 October 2023; checked 17 August 2026.** Our World in
  Data's Grapher redesign lets one dataset move among chart, map, and table
  views, gives each view only relevant controls, keeps download and reuse
  available, and displays sources prominently with deeper metadata on demand.
  [Redesigning interactive data visualizations](https://ourworldindata.org/redesigning-our-interactive-data-visualizations)
- **Exceptional principle.** Explanation, exploration, source inspection, and
  reuse can coexist without making provenance an appendix.
- **TryVit takeaway.** Put source identity and “how this was derived” beside
  each evidence block. Where a chart is useful, provide an accessible table or
  text equivalent and retain the selected comparison context.
- **Unsuitable element.** Do not turn a shopping decision into an open-ended
  analytics workbench or default to maps, configuration panels, and full-screen
  exploration when a concise answer is needed.
- **Generic/derivative risk.** Chart/table toggles and source drawers are
  generic. OWID's tab placement, chart grammar, source footer, typography, and
  blue data-publication aesthetic should not become TryVit's visual identity.

## Platform and scanner benchmarks

### Android adaptive layouts — respond to the window, not a device label

- **Dated observation — 17 August 2026.** Current Android guidance defines
  window size classes from the space available to the app, not from an
  `isTablet` assumption, and treats the class as dynamic during resizing,
  rotation, multi-window use, and folding. Canonical patterns include
  list-detail and supporting-pane relationships on roomier windows.
  [Window size classes](https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes)
  and [adaptive apps](https://developer.android.com/develop/adaptive-apps)
- **Exceptional principle.** Adaptation changes information relationships at
  meaningful thresholds; it is more than scaling the same composition.
- **TryVit takeaway.** Base direction changes on content pressure and available
  width. Compact layouts should preserve a single clear task; wider layouts can
  place result and proof, or comparison list and detail, in adjacent regions
  while preserving semantic order and focus continuity.
- **Unsuitable element.** Do not copy Compose components, Material navigation,
  Android breakpoints as a web device taxonomy, or a canonical scaffold when
  the content does not need that relationship.
- **Generic/derivative risk.** Responsive reflow and two-pane layouts are
  generic. Material navigation rails, exact pane proportions, Android icons,
  motion, and scaffold styling would make the result platform-derivative.

### ML Kit barcode and Google code scanner — make readiness and recovery explicit

- **Dated observation — 17 August 2026.** Google's current guidance separates a
  permission-less, system-mediated code scanner for simple flows from ML Kit's
  direct barcode API for custom interfaces. The custom path can limit expected
  formats, distinguish bundled from downloaded model readiness, use potential
  detections and auto-zoom, and ask for recapture when image quality is
  insufficient. [ML Kit barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
  and [Google code scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)
- **Exceptional principle.** “Scanning” is a pipeline with observable readiness,
  detection, decode, and recovery states; the simplest trustworthy capability
  should be preferred over unnecessary camera ownership.
- **TryVit takeaway.** Model the scanner as a deterministic state machine, keep
  manual entry available, limit formats when the product scope permits, and
  distinguish “barcode not yet decoded” from “decoded product not found.”
- **Unsuitable element.** Do not treat Android APIs as the implementation plan
  for the current web prototype, copy Google's scanner sheet, or hide model,
  camera, offline, and lookup failures behind one generic error.
- **Generic/derivative risk.** A viewfinder, corner brackets, scan line, and
  success pulse are generic scanner conventions. Google's exact framing,
  wording, animation, auto-zoom treatment, and system-sheet appearance should
  not be reproduced.

### Android permission guidance — ask in context and preserve a way forward

- **Dated observation — 6 March 2026 and 17 August 2026.** Android recommends
  minimizing permissions, asking only when the person invokes the relevant
  feature, allowing cancellation, respecting denial, and degrading gracefully.
  It also points to permission-less alternatives where the platform can perform
  a scoped task. [Permission best practices](https://developer.android.com/training/permissions/usage-notes)
  and [request runtime permissions](https://developer.android.com/training/permissions/requesting)
- **Exceptional principle.** Permission is part of the user's task and trust
  relationship, not an onboarding toll.
- **TryVit takeaway.** Explain camera use immediately before scan activation,
  request only the capability needed, and keep image upload or manual barcode
  entry available after denial or hardware failure. Re-entry must not nag.
- **Unsuitable element.** Do not request access at launch, pre-empt the native
  prompt with coercive copy, repeatedly route a person to settings, or imply
  that refusal blocks unrelated product research.
- **Generic/derivative risk.** Contextual rationale and graceful denial are
  generic trust patterns. A web prototype should not imitate Android system
  dialogs or Material permission artwork, which could confuse platform and
  product authority.

## Scanner state contract for the direction studies

The prototype should make each state distinguishable by text and semantics, not
only motion or color. Android and ML Kit inform the behavioral model; they do
not prescribe the TryVit visual design or current technical implementation.

| State | What the person sees | Valid next transitions |
| --- | --- | --- |
| **Idle** | Clear scan purpose, privacy expectation, and manual-entry alternative. | Start scan; enter barcode; leave. |
| **Capability check** | Whether a delegated scanner, camera, model, and secure context are available. | Ready; permission explanation; unavailable recovery. |
| **Permission decision** | In-context reason and a non-coercive cancel path, only if direct camera access is required. | Granted; denied; cancelled. |
| **Initializing** | Bounded readiness message; downloaded-model work is not mislabeled as poor camera aim. | Aiming; offline/model unavailable; retry; manual entry. |
| **Aiming** | Stable target guidance and accessible instructions. | Potential code; decoded; pause; cancel. |
| **Assist** | Specific correction such as move closer, improve light, steady, or align; optional zoom remains visible and reversible. | Aiming; decoded; timeout; manual entry. |
| **Decoded** | Masked or safely displayed code, format, and lookup progress. | Looking up; rescan; edit/manual confirmation. |
| **Lookup** | Product retrieval is separate from optical decoding. | Found; not found; ambiguous; offline; service error. |
| **Found** | Product identity is confirmed before the fast decision appears. | Decision; proof; compare; rescan. |
| **Not found or ambiguous** | Explain whether the code is valid but absent, maps to multiple records, or needs better evidence. | Contribute data; choose match; manual search; rescan. |
| **Denied or unavailable** | Respect the decision or limitation without blame. | Manual entry; image/file route if appropriate; try again by explicit choice. |
| **Recoverable error** | Stable, non-sensitive cause and a bounded remedy. | Retry the failed stage; manual entry; exit. |

No state may silently jump from a potential detection to a product judgment.
Repeated frames must not trigger duplicate lookups or duplicate result
announcements, and success should stop capture promptly.

## Adaptive layout contract without copying platform signatures

The same evidence hierarchy should survive every viewport. Layout changes may
alter adjacency and disclosure, but not the meaning, order, or authority of the
content.

| Available space | Direction behavior | Must remain invariant |
| --- | --- | --- |
| **Compact** | One primary column; result before proof; scanner controls reachable with one hand; comparison differences presented sequentially. | Product identity, leading reason, uncertainty, source access, and manual recovery. |
| **Transition width** | Add a bounded supporting region only when both regions remain readable; avoid half-width dense charts or ingredient lists. | DOM/reading order, focus order, action priority, and equivalent evidence. |
| **Wide** | Use list-detail or result-proof adjacency; keep the selected product and comparison context visible; cap line length rather than filling space. | Same method version, same decision, same caveats, and no desktop-only evidence. |

Checkpoint studies should choose their own breakpoints from content stress tests,
not copy Android's numeric thresholds. They should also avoid platform-specific
navigation rails, pane scaffolds, icons, and motion. A distinct TryVit direction
comes from evidence hierarchy, typography, geometry, language, and transitions
working together—not from reskinning a canonical layout.

## Checkpoint 1 acceptance implications

Each direction should be rejected or revised if it cannot demonstrate all of
the following with deterministic synthetic data:

1. a useful first-screen decision that exposes its leading reason;
2. a complete route from the decision back through every Evidence Spine layer;
3. source identity, method version, freshness, missingness, and uncertainty
   where they affect interpretation;
4. a comparison that only claims equivalence under a compatible schema and
   method;
5. distinct scan states with permission denial, no-match, offline, and manual
   recovery paths;
6. compact and wide layouts that preserve semantic and decision equality;
7. meaning that survives reduced motion, forced colors, keyboard use, and the
   absence of color;
8. an originality review showing that the direction extracted principles
   without reproducing benchmark copy, taxonomies, composition, or trade dress.

## Caveats and open questions

- These observations are a dated design benchmark, not a claim that the named
  products meet TryVit's accessibility, privacy, scientific, or regulatory
  requirements.
- ZOE, Yuka, Oura, RTINGS, and Apple are authoritative only about their own
  interfaces and stated methods. Their product claims require separate
  validation before TryVit could rely on them as health evidence.
- EFSA and Cochrane provide evidence-discipline principles, not an endorsement
  of a TryVit score or decision system.
- Preliminary originality review can identify obvious resemblance. Trademark,
  design-right, copyright, medical-claim, and market-specific regulatory
  clearance remain human legal work after a direction is selected.
- Checkpoint 1 still needs to decide how TryVit represents serving-normalization
  conflicts, evidence that changed after a product was scanned, and user
  preferences that legitimately produce different decisions from the same
  observed product facts.
