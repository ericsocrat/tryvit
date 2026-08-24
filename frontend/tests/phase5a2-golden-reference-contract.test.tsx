import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GOLDEN_DEFAULT_STATE,
  GOLDEN_REFERENCE_STATES,
  PHASE5A2_GOLDEN_REFERENCES,
  isGoldenReference,
  resolveGoldenRouteState,
} from "@/app/dev/phase5a2/_golden/contract";
import {
  GOLDEN_DOMAIN_GLYPHS,
  GoldenGlyph,
} from "@/app/dev/phase5a2/_golden/GoldenGlyph";
import {
  GOLDEN_IDENTITY_ASSET_CONTRACT,
  GoldenMark,
  GoldenWordmark,
} from "@/app/dev/phase5a2/_golden/GoldenIdentity";
import { phase5A2GoldenGateFromProcessEnvironment } from "@/app/dev/phase5a2/_golden/golden-gate";
import {
  GOLDEN_ASSET_BOARD_COUNT,
  GOLDEN_ASSET_BOARD_EVIDENCE_COUNT,
  GOLDEN_COMMITTED_BINARY_LIMIT_BYTES,
  GOLDEN_CORE_STILL_COUNT,
  GOLDEN_CORE_STILLS,
  GOLDEN_FONT_TRANSFER_LIMIT_BYTES,
  GOLDEN_FORCED_COLORS_STILL_COUNT,
  GOLDEN_GERMAN_DESKTOP_STILLS,
  GOLDEN_LOCALIZED_STILL_COUNT,
  GOLDEN_MOTION_RECORDING_COUNT,
  GOLDEN_MOTION_RECORDINGS,
  GOLDEN_POLISH_MOBILE_STILLS,
  GOLDEN_STATE_CONTACT_SHEET_COUNT,
  GOLDEN_STATE_CAPTURE_COUNT,
  GOLDEN_STATE_CAPTURES,
  GOLDEN_JOURNEYS,
} from "@/../tooling/design-system/golden-reference/capture-contract";
import { GOLDEN_ASSET_BOARDS as RUNTIME_ASSET_BOARDS } from "@/app/dev/phase5a2/_golden/asset-contract";
import { GoldenAssetBoardView } from "@/app/dev/phase5a2/_golden/GoldenAssetBoard";
import {
  GOLDEN_FONT_ASSAY,
  GOLDEN_FONT_ASSAY_PACKET_FILES,
  GOLDEN_TYPE_SCALE,
} from "@/app/dev/phase5a2/_golden/font-assay";

const repositoryRoot = path.resolve(process.cwd(), "..");

describe("Phase 5A.2 Golden Reference contract", () => {
  it("admits exactly six selected-hybrid references with finite states", () => {
    expect(PHASE5A2_GOLDEN_REFERENCES).toEqual([
      "landing",
      "authentication",
      "home",
      "search",
      "product",
      "scanner",
    ]);
    expect(Object.keys(GOLDEN_REFERENCE_STATES)).toEqual(PHASE5A2_GOLDEN_REFERENCES);
    for (const reference of PHASE5A2_GOLDEN_REFERENCES) {
      expect(isGoldenReference(reference)).toBe(true);
      expect(GOLDEN_REFERENCE_STATES[reference]).toContain(GOLDEN_DEFAULT_STATE[reference]);
      expect(new Set(GOLDEN_REFERENCE_STATES[reference]).size).toBe(
        GOLDEN_REFERENCE_STATES[reference].length,
      );
    }
    expect(isGoldenReference("identity")).toBe(false);
    expect(isGoldenReference("source-fold")).toBe(false);
  });

  it("fails closed for unknown, repeated, or extra route input", () => {
    expect(resolveGoldenRouteState("landing", {})).toEqual({
      reference: "landing",
      locale: "en",
      theme: "light",
      motion: "full",
      state: "ready",
      capture: false,
    });
    expect(resolveGoldenRouteState("landing", { state: "unknown-state" })).toBeNull();
    expect(resolveGoldenRouteState("landing", { locale: ["en", "pl"] })).toBeNull();
    expect(resolveGoldenRouteState("landing", { debug: "1" })).toBeNull();
    expect(resolveGoldenRouteState("landing", { capture: "true" })).toBeNull();
  });

  it("freezes the finite evidence counts and budgets", () => {
    expect(GOLDEN_CORE_STILLS).toHaveLength(GOLDEN_CORE_STILL_COUNT);
    expect(GOLDEN_CORE_STILL_COUNT).toBe(36);
    expect(GOLDEN_POLISH_MOBILE_STILLS).toHaveLength(6);
    expect(GOLDEN_GERMAN_DESKTOP_STILLS).toHaveLength(6);
    expect(
      GOLDEN_POLISH_MOBILE_STILLS.length + GOLDEN_GERMAN_DESKTOP_STILLS.length,
    ).toBe(GOLDEN_LOCALIZED_STILL_COUNT);
    expect(GOLDEN_FORCED_COLORS_STILL_COUNT).toBe(6);
    expect(GOLDEN_STATE_CONTACT_SHEET_COUNT).toBe(6);
    expect(GOLDEN_MOTION_RECORDINGS).toHaveLength(GOLDEN_MOTION_RECORDING_COUNT);
    expect(GOLDEN_MOTION_RECORDING_COUNT).toBe(12);
    expect(GOLDEN_ASSET_BOARD_COUNT).toBe(7);
    expect(GOLDEN_ASSET_BOARD_EVIDENCE_COUNT).toBe(8);
    expect(GOLDEN_STATE_CAPTURES).toHaveLength(GOLDEN_STATE_CAPTURE_COUNT);
    expect(GOLDEN_STATE_CAPTURE_COUNT).toBe(59);
    expect(GOLDEN_JOURNEYS).toHaveLength(6);
    expect(GOLDEN_JOURNEYS.map((journey) => journey.reference)).toEqual(
      PHASE5A2_GOLDEN_REFERENCES,
    );
    expect(RUNTIME_ASSET_BOARDS).toHaveLength(GOLDEN_ASSET_BOARD_COUNT);
    expect(GOLDEN_COMMITTED_BINARY_LIMIT_BYTES).toBe(15 * 1024 * 1024);
    expect(GOLDEN_FONT_TRANSFER_LIMIT_BYTES).toBe(100 * 1024);
  });

  it("uses path-only identity assets and an optical micro mark", () => {
    const master = renderToStaticMarkup(<GoldenMark label="TryVit symbol" />);
    const micro = renderToStaticMarkup(<GoldenMark label="TryVit symbol" size="micro" />);
    const twentyPixel = renderToStaticMarkup(<GoldenMark label="TryVit symbol" size={20} />);
    const wordmark = renderToStaticMarkup(<GoldenWordmark />);
    expect(master).toContain("data-golden-mark=\"master\"");
    expect(micro).toContain("data-golden-mark=\"micro\"");
    expect(micro).toContain("height=\"16\"");
    expect(twentyPixel).toContain("data-golden-mark=\"micro\"");
    expect(twentyPixel).toContain("height=\"20\"");
    expect(master).not.toContain("<text");
    expect(micro).not.toContain("<text");
    expect(wordmark).not.toContain("<text");
    expect(wordmark).toContain('viewBox="0 0 96 24"');
    expect(wordmark).not.toContain('viewBox="0 0 112 24"');
    expect(GOLDEN_IDENTITY_ASSET_CONTRACT.wordmarkCasing).toBe("TryVit");
    expect(GOLDEN_IDENTITY_ASSET_CONTRACT.prohibitedMasterFormats).toContain("raster");
  });

  it("keeps one bounded original domain-glyph grammar", () => {
    expect(GOLDEN_DOMAIN_GLYPHS).toEqual([
      "source",
      "observed",
      "derived",
      "context",
      "decision",
      "confidence",
      "unknown",
      "scanner",
      "compare",
    ]);
    for (const name of GOLDEN_DOMAIN_GLYPHS) {
      const markup = renderToStaticMarkup(<GoldenGlyph label={name} name={name} />);
      expect(markup).toContain(`data-golden-glyph=\"${name}\"`);
      expect(markup).not.toContain("<text");
    }
  });

  it("binds the review-only font comparison to exact official sources and bytes", () => {
    expect(GOLDEN_FONT_ASSAY.status).toBe("comparison-ready-decision-pending");
    expect(GOLDEN_FONT_ASSAY.productionAdoption).toBe(false);
    expect(GOLDEN_FONT_ASSAY.sources.manrope.commit).toBe(
      "6f81ebecdf65e4463b798cc07b16a4f8d5216917",
    );
    expect(GOLDEN_FONT_ASSAY.sources.sourceSerif4.commit).toBe(
      "2823e993c53fca27c5c8749f529b56a5a7c77b6b",
    );
    expect(GOLDEN_FONT_ASSAY.sources.sourceSerif4.reservedFontNames).toEqual(["Source"]);
    expect(GOLDEN_FONT_ASSAY.sources.sourceSerif4.derivedFamilyName).toBe(
      "TryVit Assay Serif",
    );

    let transferredBytes = 0;
    for (const font of GOLDEN_FONT_ASSAY.files) {
      const fontPath = path.join(
        process.cwd(),
        "src",
        "app",
        "dev",
        "phase5a2",
        "_golden",
        font.path,
      );
      const bytes = readFileSync(fontPath);
      expect(statSync(fontPath).size, font.path).toBe(font.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), font.path).toBe(font.sha256);
      transferredBytes += bytes.length;
    }
    expect(transferredBytes).toBe(GOLDEN_FONT_ASSAY.transferBytes);
    expect(transferredBytes).toBeLessThanOrEqual(GOLDEN_FONT_ASSAY.transferLimitBytes);
    expect(GOLDEN_FONT_ASSAY_PACKET_FILES).toHaveLength(5);
    expect(GOLDEN_FONT_ASSAY.subsetting.deterministicRerunRequired).toBe(false);
    expect(GOLDEN_FONT_ASSAY.subsetting.deterministicRerunVerified).toBe(true);

    for (const source of [
      GOLDEN_FONT_ASSAY.sources.manrope,
      GOLDEN_FONT_ASSAY.sources.sourceSerif4,
    ]) {
      const licensePath = path.join(
        process.cwd(),
        "src",
        "app",
        "dev",
        "phase5a2",
        "_golden",
        source.licensePath,
      );
      const license = readFileSync(licensePath);
      expect(createHash("sha256").update(license).digest("hex")).toBe(source.licenseSha256);
      expect(license.toString("utf8")).toContain("SIL OPEN FONT LICENSE");
    }
  });

  it("renders four honest type sizes in both control and candidate columns", () => {
    expect(new Set(Object.values(GOLDEN_TYPE_SCALE)).size).toBe(4);
    const markup = renderToStaticMarkup(<GoldenAssetBoardView board="typography" theme="light" />);
    for (const [name, pixels] of Object.entries(GOLDEN_TYPE_SCALE)) {
      expect(markup).toContain(`data-golden-type-specimen="control-${name === "tabular" ? "tabular" : name}"`);
      expect(markup).toContain(`data-golden-type-specimen="candidate-${name === "tabular" ? "tabular" : name}"`);
      expect(markup).toContain(`/ ${pixels}`);
    }
    expect(markup).toContain(GOLDEN_FONT_ASSAY.proof.polish);
    expect(markup).toContain(GOLDEN_FONT_ASSAY.proof.german);
    expect(markup).toContain("production adoption prohibited");
  });

  it("preserves the frozen Checkpoint 1 LF-canonical manifest", () => {
    const manifestPath = path.join(
      repositoryRoot,
      "docs",
      "phase5a2",
      "checkpoint-1",
      "evidence",
      "manifest.json",
    );
    const canonical = readFileSync(manifestPath, "utf8").replace(/\r\n/gu, "\n");
    expect(createHash("sha256").update(canonical).digest("hex")).toBe(
      "9c10d0243b5208319fc8c3b1497ca9dae552f7fdfd899823ae2fca39f8993c1e",
    );
  });

  it("keeps Golden routes explicit-flag-only without changing the frozen gate", () => {
    const gate = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "app",
        "dev",
        "phase5a2",
        "_golden",
        "golden-gate.ts",
      ),
      "utf8",
    );
    expect(gate).toContain('environment.PHASE5A2_DIRECTION_SELECTION === "1"');
    expect(gate).toContain("phase5A2GateFromProcessEnvironment(environment)");
    expect(phase5A2GoldenGateFromProcessEnvironment({ NODE_ENV: "development" })).toBe(false);
    expect(phase5A2GoldenGateFromProcessEnvironment({
      NODE_ENV: "development",
      PHASE5A2_DIRECTION_SELECTION: "1",
    })).toBe(true);
    expect(phase5A2GoldenGateFromProcessEnvironment({ NODE_ENV: "production" })).toBe(false);
    expect(phase5A2GoldenGateFromProcessEnvironment({
      NODE_ENV: "production",
      PHASE5A2_DIRECTION_SELECTION: "1",
    })).toBe(true);
  });

  it("uses whole-page Axe without legacy exclusions or disabled rules", () => {
    const resilience = readFileSync(
      path.join(process.cwd(), "e2e", "phase5a2-golden-resilience.spec.ts"),
      "utf8",
    );
    expect(resilience).toContain("new AxeBuilder({ page }).analyze()");
    expect(resilience).not.toMatch(/\.exclude\(|\.include\(|\.disableRules\(|\.withTags\(|runOnly/u);
    expect(resilience).not.toContain("helpers/a11y");
  });

  it("keeps replacement-review blockers covered by executable evidence", () => {
    const source = (relativePath: string): string => readFileSync(
      path.join(process.cwd(), relativePath),
      "utf8",
    );
    const motion = source("e2e/phase5a2-golden-motion.spec.ts");
    const performance = source("e2e/phase5a2-golden-performance.spec.ts");
    const capture = source("e2e/phase5a2-golden-capture.spec.ts");
    const resilience = source("e2e/phase5a2-golden-resilience.spec.ts");
    const verifier = source("tooling/design-system/golden-reference/verify-candidates.mts");
    const stagedVerifier = source("tooling/design-system/golden-reference/verify-staged.mts");
    const product = source("src/app/dev/phase5a2/_golden/ProductReference.tsx");
    const authentication = source("src/app/dev/phase5a2/_golden/AuthenticationForm.client.tsx");
    const search = source("src/app/dev/phase5a2/_golden/SearchWorkspace.client.tsx");
    const scanner = source("src/app/dev/phase5a2/_golden/ScannerReference.client.tsx");
    expect(motion).toContain('data-golden-reference=\'home\'');
    expect(motion).toContain('data-golden-reference=\'product\'');
    expect(motion).toContain("element.innerText.replace(/\\s+/gu, \" \")");
    expect(performance).toContain("const SAMPLE_COUNT = 5");
    expect(capture).toContain("return { x: scrollX, y: scrollY }");
    expect(capture).toContain('expect(scroll).toEqual({ x: 0, y: 0 })');
    expect(performance).toContain('goldenOutputPath("performance.json")');
    expect(resilience).toContain('forcedColorAdjust).toBe("none")');
    expect(verifier).toContain("journey-terminal-invalid");
    expect(verifier).toContain("performance-contract-invalid");
    expect(verifier).toContain("journey-terminal-metadata-invalid");
    expect(stagedVerifier).toContain("staged-terminal-provenance-invalid");
    expect(product).toContain('productName: "Napój owsiany North Grain — rekord testowy"');
    expect(product).toContain('productName: "North Grain Hafergetränk — Prüfmuster"');
    expect(product).toContain("<h1>{copy.productName}</h1>");
    expect(motion).toContain("GOLDEN_ASYNC_STATE_ASSERT_MS");
    expect(motion).toContain("semanticAnnouncements");
    expect(resilience).toContain("liveIdentitySemantics");
    expect(verifier).toContain("resilience-live-identity-semantics-invalid");
    expect(stagedVerifier).toContain("semanticAnnouncements");
    for (const semanticSource of [authentication, search, scanner]) {
      expect(semanticSource).toContain("GOLDEN_ASYNC_STATE_DWELL_MS");
      expect(semanticSource).not.toContain('route.motion === "reduced" ? 0');
    }
    expect(search).toContain('data-golden-product-record=""');
    expect(search).not.toContain('<GoldenMark size="small" />');
    expect(product).toContain("provisionalScore={unknown ? undefined : 72}");
  });

  it("keeps a byte-level staged evidence verifier", () => {
    const verifier = readFileSync(
      path.join(
        process.cwd(),
        "tooling",
        "design-system",
        "golden-reference",
        "verify-staged.mts",
      ),
      "utf8",
    );
    expect(verifier).toContain("staged-root-contents-invalid");
    expect(verifier).toContain("staged-file-snapshot-invalid");
    expect(verifier).toContain("staged-packet-contract-invalid");
    expect(verifier).toContain("manifest-sensitive-content");
    expect(verifier).toContain("verifyPlaywrightWebm");
  });
});
