import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EvidenceRegister } from "@/app/dev/phase5a2/_directions/evidence-register/EvidenceRegister";
import { OpenCore } from "@/app/dev/phase5a2/_directions/open-core/OpenCore";
import { SourceFold } from "@/app/dev/phase5a2/_directions/source-fold/SourceFold";
import { MotionStudy } from "@/app/dev/phase5a2/_shared/MotionStudy.client";
import { ProductLookup } from "@/app/dev/phase5a2/_shared/ProductLookup.client";
import { ReviewFrame } from "@/app/dev/phase5a2/_shared/ReviewFrame";
import { ScannerStudy } from "@/app/dev/phase5a2/_shared/ScannerStudy.client";
import {
  PHASE5A2_CANDIDATES,
  PHASE5A2_SURFACES,
  phase5A2ReviewHref,
  resolvePhase5A2RouteState,
  type Phase5A2Candidate,
  type Phase5A2RouteState,
} from "@/app/dev/phase5a2/_shared/contract";
import {
  PHASE5A2_FIXTURE,
  PHASE5A2_FIXTURE_SHA256,
} from "@/app/dev/phase5a2/_shared/fixture";
import { PHASE5A2_COMMON_MESSAGES } from "@/app/dev/phase5a2/_shared/messages";
import { isPhase5A2DirectionSelectionOpen } from "@/app/dev/phase5a2/phase5a2-gate";
import {
  DIRECTION_SELECTION_BINARY_COUNT,
  DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS,
  DIRECTION_SELECTION_CONTACT_SHEET_COUNT,
  DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS,
  DIRECTION_SELECTION_PACKAGE_FILE_COUNT,
  DIRECTION_SELECTION_STILL_COUNT,
  DIRECTION_SELECTION_VIDEO_COUNT,
} from "@/../tooling/design-system/direction-selection/capture-contract";

const frontendRoot = process.cwd();
const readFrontend = (filename: string): string =>
  readFileSync(path.join(frontendRoot, filename), "utf8");

const candidateSourcePaths = [
  "src/app/dev/phase5a2/_directions/source-fold/SourceFold.tsx",
  "src/app/dev/phase5a2/_directions/evidence-register/EvidenceRegister.tsx",
  "src/app/dev/phase5a2/_directions/open-core/OpenCore.tsx",
] as const;
const candidateStylePaths = [
  "src/app/dev/phase5a2/_directions/source-fold/source-fold.module.css",
  "src/app/dev/phase5a2/_directions/evidence-register/evidence-register.module.css",
  "src/app/dev/phase5a2/_directions/open-core/open-core.module.css",
] as const;
const candidateSources = candidateSourcePaths.map(readFrontend).join("\n");
const candidateStyles = candidateStylePaths.map(readFrontend).join("\n");

const renderCandidate: Readonly<
  Record<Phase5A2Candidate, (route: Phase5A2RouteState) => React.ReactNode>
> = {
  "source-fold": (route) => <SourceFold route={route} />,
  "evidence-register": (route) => <EvidenceRegister route={route} />,
  "open-core": (route) => <OpenCore route={route} />,
};

describe("Phase 5A.2 direction-selection contract", () => {
  it("fails closed in production and never depends on a public QA flag", () => {
    expect(isPhase5A2DirectionSelectionOpen({ nodeEnv: "development" })).toBe(true);
    expect(isPhase5A2DirectionSelectionOpen({ nodeEnv: "test" })).toBe(true);
    expect(isPhase5A2DirectionSelectionOpen({ nodeEnv: "production" })).toBe(false);
    expect(
      isPhase5A2DirectionSelectionOpen({
        nodeEnv: "production",
        directionSelection: "true",
      }),
    ).toBe(false);
    expect(
      isPhase5A2DirectionSelectionOpen({
        nodeEnv: "production",
        directionSelection: "1",
      }),
    ).toBe(true);

    const gate = readFrontend("src/app/dev/phase5a2/phase5a2-gate.ts");
    expect(gate).toContain("PHASE5A2_DIRECTION_SELECTION");
    expect(gate).not.toContain("NEXT_PUBLIC");
  });

  it("keeps candidate, surface, locale, theme, motion, state, and capture inputs closed", () => {
    expect(PHASE5A2_CANDIDATES).toHaveLength(3);
    expect(PHASE5A2_SURFACES).toHaveLength(6);

    for (const candidate of PHASE5A2_CANDIDATES) {
      for (const surface of PHASE5A2_SURFACES) {
        const route = resolvePhase5A2RouteState(candidate, surface, {});
        expect(route).not.toBeNull();
        expect(route).toMatchObject({
          candidate,
          surface,
          locale: "en",
          theme: "light",
          motion: "full",
          capture: false,
        });
      }
    }

    expect(
      resolvePhase5A2RouteState("source-fold", "landing", {
        locale: "pl",
        theme: "dark",
        motion: "reduced",
        state: "settled",
        capture: "1",
      }),
    ).toMatchObject({
      locale: "pl",
      theme: "dark",
      motion: "reduced",
      state: "settled",
      capture: true,
    });

    for (const invalidQuery of [
      { locale: "fr" },
      { locale: ["en", "pl"] },
      { theme: "system" },
      { motion: "auto" },
      { state: "matched" },
      { capture: "true" },
      { debug: "1" },
    ]) {
      expect(
        resolvePhase5A2RouteState("source-fold", "landing", invalidQuery),
      ).toBeNull();
    }

    expect(
      phase5A2ReviewHref("open-core", "product", "de", "dark", "reduced", "partial"),
    ).toBe(
      "/dev/phase5a2/open-core/product?locale=de&theme=dark&motion=reduced&state=partial",
    );
  });

  it("binds the frozen fixture hash to its exact serialized values", () => {
    const hash = createHash("sha256")
      .update(JSON.stringify(PHASE5A2_FIXTURE))
      .digest("hex");
    expect(hash).toBe(PHASE5A2_FIXTURE_SHA256);
    expect(PHASE5A2_FIXTURE).toMatchObject({
      productName: "North Grain Oat Drink — review fixture",
      ean: "5901234123457",
      observedOn: "2026-07-14",
      conceptDecisionScore: 72,
      nutritionPer100ml: {
        energyKj: 193,
        energyKcal: 46,
        fatG: 1.5,
        saturatesG: 0.2,
        carbohydratesG: 7.4,
        sugarsG: 3.2,
        fibreG: 0.8,
        proteinG: 1,
        saltG: 0.1,
      },
    });
  });

  it.each(PHASE5A2_CANDIDATES)(
    "renders all six %s surfaces as one V2 main landmark with one H1",
    (candidate) => {
      for (const surface of PHASE5A2_SURFACES) {
        const route = resolvePhase5A2RouteState(candidate, surface, {});
        if (!route) throw new Error("Default Phase 5A.2 route must resolve.");
        const markup = renderToStaticMarkup(renderCandidate[candidate](route));
        expect(markup).toContain(`data-phase5a2-candidate="${candidate}"`);
        expect(markup).toContain(`data-phase5a2-surface="${surface}"`);
        expect(markup).toContain('data-phase5a2-ready="true"');
        expect(markup).toContain('data-design-system="v2"');
        expect(markup.match(/<h1[ >]/gu)).toHaveLength(1);
        expect(markup).not.toContain("<img");
        expect(markup).not.toContain("<script");
      }
    },
  );

  it("puts the live scanner state before every fixed fixture preview", () => {
    for (const candidate of PHASE5A2_CANDIDATES) {
      const route = resolvePhase5A2RouteState(candidate, "scanner", {
        state: "matched",
      });
      if (!route) throw new Error("Matched scanner route must resolve.");
      const markup = renderToStaticMarkup(renderCandidate[candidate](route));
      const stateIndex = markup.indexOf("data-phase5a2-scanner");
      const fixtureIndex = markup.indexOf("data-phase5a2-fixture-reference");
      expect(stateIndex).toBeGreaterThan(0);
      expect(fixtureIndex).toBeGreaterThan(stateIndex);
    }

    expect(candidateSources).toContain("the\\u00a0conclusion");
    expect(candidateSources).toContain("z\\u00a0przestrzenią");
  });

  it("keeps candidate code deterministic, local, system-fonted, and outside 5A.1 artifacts", () => {
    const sharedSources = [
      "src/app/dev/phase5a2/_shared/MotionStudy.client.tsx",
      "src/app/dev/phase5a2/_shared/ProductLookup.client.tsx",
      "src/app/dev/phase5a2/_shared/ScannerStudy.client.tsx",
      "src/app/dev/phase5a2/_shared/fixture.ts",
    ]
      .map(readFrontend)
      .join("\n");
    const allPrototypeSources = `${candidateSources}\n${sharedSources}\n${candidateStyles}`;

    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "navigator.mediaDevices",
      "getUserMedia",
      "createClient(",
      "localStorage",
      "sessionStorage",
      "Date.now",
      "Math.random",
      "next/font",
      "@font-face",
      "fonts.googleapis",
      "fonts.gstatic",
      "phase5a1-catalog-candidates",
      "phase5a1-catalog-diagnostics",
      "capture-contract",
      "toHaveScreenshot",
    ]) {
      expect(allPrototypeSources).not.toContain(forbidden);
    }

    expect(candidateStyles.match(/@media \(forced-colors: active\)/gu)).toHaveLength(3);
    expect(candidateStyles.match(/@media \(prefers-reduced-motion: reduce\)/gu)).toHaveLength(3);
    expect(candidateStyles).toContain("var(--ds-type-family-sans)");
    for (const proposedFamily of [
      "Manrope",
      "Source Serif",
      "IBM Plex",
      "Atkinson Hyperlegible",
      "Newsreader",
    ]) {
      expect(candidateStyles).not.toContain(proposedFamily);
    }

    const lookup = readFrontend(
      "src/app/dev/phase5a2/_shared/ProductLookup.client.tsx",
    );
    expect(lookup).toContain("open={open}");
    expect(lookup).toContain("onOpenChange={setOpen}");
    expect(lookup).toContain("value={value}");
    expect(lookup).toContain("onValueChange={setValue}");
  });

  it("locks the three intentionally different path-only identity constructions", () => {
    for (const pathData of [
      "M7 15H36L51 30V52H23L7 36Z",
      "M22 8H45L57 20V43L46 54H22V31L34 19L22 8ZM46 15a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z",
      "M10 54V8H43L55 20V38",
      "M43 8V20H55",
      "M21 25H42M21 35H39M21 45H31",
      "M42 40a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z",
      "M43 8H20L8 20V44L20 56H44L56 44V25",
      "M40 18H24L18 24V40L24 46H40L46 40V31",
      "M36 27H30L27 30V36L30 39H36L39 36V34",
      "M52 11L56 15L52 19L48 15Z",
    ]) {
      expect(candidateSources).toContain(pathData);
    }

    expect(candidateSources).not.toContain("<circle");
    expect(candidateSources).not.toContain("<polygon");
    expect(candidateSources).not.toContain("<image");
    expect(candidateSources).not.toContain("<filter");
    expect(candidateSources).not.toContain("<linearGradient");
    expect(candidateSources).not.toContain('from "lucide-react"');
  });

  it("uses a server-only guarded route, no-index metadata, and conditional candidate modules", () => {
    const page = readFrontend(
      "src/app/dev/phase5a2/[candidate]/[surface]/page.tsx",
    );
    const layout = readFrontend("src/app/dev/phase5a2/layout.tsx");
    expect(page).toContain("phase5A2GateFromProcessEnvironment()");
    expect(page).toContain("notFound()");
    expect(page.match(/await import\(/gu)).toHaveLength(3);
    expect(page).not.toMatch(/^import .*_directions/mu);
    expect(layout).toContain("index: false");
    expect(layout).toContain("follow: false");
    expect(layout).toContain("noarchive: true");
    expect(layout).toContain("nocache: true");
  });

  it("matches the deterministic fixture by its EAN description", async () => {
    const user = userEvent.setup();
    const common = PHASE5A2_COMMON_MESSAGES.en;
    render(
      <main data-design-system="v2" data-theme="light">
        <ProductLookup
          copy={common.productLookup}
          ean={PHASE5A2_FIXTURE.ean}
          fixtureName={common.fixtureName}
        />
      </main>,
    );

    const lookup = screen.getByRole("combobox", { name: common.productLookup.label });
    await user.click(lookup);
    await user.type(lookup, PHASE5A2_FIXTURE.ean);

    expect(screen.getByRole("option")).toHaveTextContent(common.fixtureName);
    expect(screen.getByRole("option")).toHaveTextContent(PHASE5A2_FIXTURE.ean);
  });

  it("keeps one focused scanner action through user-driven states", async () => {
    const user = userEvent.setup();
    const common = PHASE5A2_COMMON_MESSAGES.en;
    const { container } = render(
      <ScannerStudy
        className="scanner-study"
        copy={common.scanner}
        direction="test-direction"
        ean={PHASE5A2_FIXTURE.ean}
        initialState="ready"
      />,
    );
    const study = container.querySelector<HTMLElement>("[data-phase5a2-scanner]");
    const action = screen.getByRole("button", { name: common.scanner.begin });

    await user.click(action);
    expect(study).toHaveAttribute("data-phase5a2-state", "recognized");
    expect(screen.getByRole("button", { name: common.scanner.buildResult })).toBe(action);
    expect(action).toHaveFocus();

    await user.click(action);
    expect(study).toHaveAttribute("data-phase5a2-state", "processing");
    expect(screen.getByRole("button", { name: common.scanner.cancel })).toBe(action);
    expect(action).toHaveFocus();

    await user.click(action);
    expect(study).toHaveAttribute("data-phase5a2-state", "ready");
    expect(screen.getByRole("button", { name: common.scanner.begin })).toBe(action);
    expect(action).toHaveFocus();
  });

  it("keeps a URL-initialized processing scanner state stable", async () => {
    vi.useFakeTimers();
    try {
      const common = PHASE5A2_COMMON_MESSAGES.en;
      const { container } = render(
        <ScannerStudy
          className="scanner-study"
          copy={common.scanner}
          direction="test-direction"
          ean={PHASE5A2_FIXTURE.ean}
          initialState="processing"
        />,
      );
      const study = container.querySelector<HTMLElement>("[data-phase5a2-scanner]");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(study).toHaveAttribute("data-phase5a2-state", "processing");
      expect(screen.getByRole("button", { name: common.scanner.cancel })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("focuses and announces manual scanner validation, then restores action focus", async () => {
    const user = userEvent.setup();
    const common = PHASE5A2_COMMON_MESSAGES.en;
    const { container } = render(
      <ScannerStudy
        className="scanner-study"
        copy={common.scanner}
        direction="test-direction"
        ean={PHASE5A2_FIXTURE.ean}
        initialState="not-found"
      />,
    );
    const study = container.querySelector<HTMLElement>("[data-phase5a2-scanner]");

    await user.click(screen.getByRole("button", { name: common.scanner.useManual }));
    const input = screen.getByRole("textbox", { name: common.scanner.manualLabel });
    await waitFor(() => expect(input).toHaveFocus());

    await user.clear(input);
    await user.type(input, "111");
    await user.click(screen.getByRole("button", { name: common.scanner.manualSubmit }));
    expect(study).toHaveAttribute("data-phase5a2-state", "manual");
    expect(screen.getByRole("alert")).toHaveTextContent(common.scanner.manualInvalid);
    expect(input).toHaveFocus();

    await user.clear(input);
    await user.type(input, PHASE5A2_FIXTURE.ean);
    await user.click(screen.getByRole("button", { name: common.scanner.manualSubmit }));
    expect(study).toHaveAttribute("data-phase5a2-state", "matched");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: common.scanner.retry })).toHaveFocus();
    });
  });

  it("announces motion stage changes without replacing the heading", async () => {
    const user = userEvent.setup();
    render(
      <MotionStudy
        className="motion-study"
        copy={{
          stages: [
            { id: "one", label: "Stage one", description: "First stage." },
            { id: "two", label: "Stage two", description: "Second stage." },
          ],
          previous: "Previous stage",
          next: "Next stage",
          restart: "Restart stages",
        }}
        direction="test-direction"
        initialStage={0}
        motionMode="reduced"
      />,
    );
    const heading = screen.getByRole("heading", { name: "Stage one" });
    expect(heading).toHaveAttribute("aria-live", "polite");
    expect(heading).toHaveAttribute("aria-atomic", "true");

    await user.click(screen.getByRole("button", { name: "Next stage" }));
    expect(screen.getByRole("heading", { name: "Stage two" })).toBe(heading);
  });

  it("offers full and reduced review modes with accessible chrome states", () => {
    const route = resolvePhase5A2RouteState("evidence-register", "home", {});
    if (!route) throw new Error("Default Phase 5A.2 route must resolve.");
    render(
      <ReviewFrame route={route}>
        <main>Candidate preview</main>
      </ReviewFrame>,
    );

    expect(screen.getByRole("link", { name: "Full" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Reduced" })).toHaveAttribute(
      "href",
      "/dev/phase5a2/evidence-register/home?locale=en&theme=light&motion=reduced&state=returning",
    );

    const chromeStyles = readFrontend("src/app/dev/phase5a2/_shared/review-frame.module.css");
    expect(chromeStyles).toContain("min-block-size: 2.75rem");
    expect(chromeStyles).toContain("background: Highlight");
    expect(chromeStyles).toContain("color: HighlightText");
  });

  it("pins a bounded review-only evidence matrix outside the Phase 5A.1 contract", () => {
    expect(DIRECTION_SELECTION_STILL_COUNT).toBe(21);
    expect(DIRECTION_SELECTION_VIDEO_COUNT).toBe(6);
    expect(DIRECTION_SELECTION_CONTACT_SHEET_COUNT).toBe(7);
    expect(DIRECTION_SELECTION_BINARY_COUNT).toBe(34);
    expect(DIRECTION_SELECTION_PACKAGE_FILE_COUNT).toBe(35);
    expect(DIRECTION_SELECTION_CANDIDATE_RELATIVE_PATHS).toHaveLength(27);
    expect(DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS).toHaveLength(35);
    expect(new Set(DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS).size).toBe(35);
    expect(
      DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS.every(
        (filename) =>
          !filename.includes("phase5a1-catalog-candidates") &&
          !filename.includes("phase5a1-catalog-diagnostics"),
      ),
    ).toBe(true);
  });

  it("keeps capture authenticated, opt-in, source-bound, egress-guarded, and sanitized", () => {
    const config = readFrontend("playwright.config.ts");
    const runner = readFrontend(
      "tooling/design-system/direction-selection/run.mts",
    );
    const verifier = readFrontend(
      "tooling/design-system/direction-selection/verify-candidates.mts",
    );
    const stager = readFrontend(
      "tooling/design-system/direction-selection/stage-evidence.mts",
    );
    const specifications = [
      "e2e/phase5a2-direction-selection-stills.spec.ts",
      "e2e/phase5a2-direction-selection-motion.spec.ts",
      "e2e/phase5a2-direction-selection-scanner.spec.ts",
    ]
      .map(readFrontend)
      .join("\n");
    const captureHelper = readFrontend(
      "e2e/helpers/phase5a2-direction-selection.ts",
    );

    expect(config).toContain(
      'const HAS_PHASE5A2_DIRECTION_REVIEW = enabled("PHASE5A2_DIRECTION_REVIEW")',
    );
    for (const project of [
      "phase5a2-direction-stills",
      "phase5a2-direction-motion",
      "phase5a2-direction-scanner",
    ]) {
      expect(config).toContain(`name: "${project}"`);
    }
    const projectBlock = config.slice(
      config.indexOf("const phase5a2DirectionStillsProject"),
      config.indexOf("const projects ="),
    );
    expect(projectBlock.match(/dependencies: \["auth-setup"\]/gu)).toHaveLength(4);
    expect(projectBlock.match(/serviceWorkers: "block"/gu)).toHaveLength(4);
    expect(projectBlock.match(/trace: "off"/gu)).toHaveLength(4);
    expect(projectBlock.match(/video: "off" as const/gu)).toHaveLength(4);
    expect(projectBlock).not.toContain('video: { mode: "on"');

    expect(runner).toContain('"local-authenticated"');
    expect(runner).toContain('PHASE5A2_DIRECTION_SELECTION: "1"');
    expect(runner).toContain('PHASE5A2_DIRECTION_REVIEW: "true"');
    expect(runner).toContain('NEXT_PUBLIC_QA_MODE: "0"');
    expect(runner).not.toContain('NEXT_PUBLIC_QA_MODE: "1"');
    expect(runner).toContain('"--workers=1"');
    expect(runner).toContain('git(frontendRoot, ["status", "--porcelain=v1", "--untracked-files=all"])');
    expect(runner).toContain('git(frontendRoot, ["rev-parse", "HEAD^{tree}"])');

    expect(specifications.match(/from "\.\/fixtures\/safe-test"/gu)).toHaveLength(3);
    expect(specifications).toContain("assertDirectionSelectionAxe(page)");
    expect(captureHelper).toContain('errors.push("pageerror")');
    expect(captureHelper).toContain('errors.push("console-error")');
    expect(captureHelper).not.toContain("error.message");
    expect(captureHelper).not.toContain("message.text()");
    expect(captureHelper).not.toContain(".exclude(");
    expect(captureHelper).not.toContain(".disableRules(");
    expect(captureHelper).toContain("await page.screencast.start({");
    expect(captureHelper).toContain("await firstFrame;");
    expect(specifications.match(/startDirectionSelectionRecording\(page, capture\)/gu))
      .toHaveLength(2);
    expect(specifications).not.toContain("page.video()");
    expect(verifier).toContain("runtime.sourceTreeSha !== expected.sourceTreeSha");
    expect(verifier).toContain('["status", "--porcelain=v1", "--untracked-files=all"]');
    expect(verifier).toContain('fail("source-provenance-mismatch")');
    expect(verifier).toContain("candidate-root-contents-invalid");
    expect(verifier).toContain("candidate-entry-symlink");
    expect(stager).toContain("productionBaseline: false");
    expect(stager).toContain("reviewOnly: true");
    expect(stager).toContain("assertOwnedPathAbsent(");
    expect(stager).toContain('"evidence-destination"');
    for (const source of [runner, verifier, stager, specifications, captureHelper]) {
      expect(source).not.toContain("phase5a1-catalog-candidates");
      expect(source).not.toContain("phase5a1-catalog-diagnostics");
    }
  });
});
