import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
import {
  GOLDEN_ASSET_BOARD_COUNT,
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
} from "../tooling/design-system/golden-reference/capture-contract";

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
    expect(GOLDEN_COMMITTED_BINARY_LIMIT_BYTES).toBe(15 * 1024 * 1024);
    expect(GOLDEN_FONT_TRANSFER_LIMIT_BYTES).toBe(100 * 1024);
  });

  it("uses path-only identity assets and an optical micro mark", () => {
    const master = renderToStaticMarkup(<GoldenMark label="TryVit symbol" />);
    const micro = renderToStaticMarkup(<GoldenMark label="TryVit symbol" size="micro" />);
    const wordmark = renderToStaticMarkup(<GoldenWordmark />);
    expect(master).toContain("data-golden-mark=\"master\"");
    expect(micro).toContain("data-golden-mark=\"micro\"");
    expect(micro).toContain("height=\"16\"");
    expect(master).not.toContain("<text");
    expect(micro).not.toContain("<text");
    expect(wordmark).not.toContain("<text");
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
  });
});
