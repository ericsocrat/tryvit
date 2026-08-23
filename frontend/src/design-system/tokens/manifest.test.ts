import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

import { buildGeneratedArtifacts, GENERATED_ARTIFACT_PATHS } from "./generate";
import { contrastContracts, tokenManifest } from "./manifest";
import {
  TOKEN_SECTION_ORDER,
  TOKEN_THEME_ORDER,
  type TokenManifest,
} from "./schema";
import { contrastRatio } from "./contrast";
import { resolveTokenValue, validateTokenManifest } from "./validation";

const repositoryRoot = resolve(__dirname, "../../../..");

function extractBlock(source: string, selector: string, offset = 0): string {
  const selectorStart = source.indexOf(selector, offset);
  if (selectorStart < 0) throw new Error(`Selector not found: ${selector}`);
  const openingBrace = source.indexOf("{", selectorStart + selector.length);
  if (openingBrace < 0) throw new Error(`Opening brace not found: ${selector}`);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  throw new Error(`Closing brace not found: ${selector}`);
}

function parseCustomProperties(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/^\s*(--[^:]+):\s*(.+);\s*$/gm)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

describe("Design System V2 token schema", () => {
  it("uses the approved section order and passes every validator", () => {
    expect(Object.keys(tokenManifest)).toEqual(TOKEN_SECTION_ORDER);
    expect(validateTokenManifest(tokenManifest)).toEqual([]);
  });

  it("keeps primitive values private and every V2 token theme-complete", () => {
    for (const definition of Object.values(tokenManifest.primitive)) {
      expect(definition.cssVariable).toMatch(/^--ds-/);
    }

    for (const section of [
      tokenManifest.primitive,
      tokenManifest.semanticV2,
      tokenManifest.componentV2,
      tokenManifest.domain,
    ]) {
      for (const definition of Object.values(section)) {
        expect(Object.keys(definition.values)).toEqual(TOKEN_THEME_ORDER);
        for (const theme of TOKEN_THEME_ORDER) {
          expect(definition.values[theme]).not.toBe("");
        }
      }
    }
  });

  it("detects duplicate CSS variables, missing references, and cycles", () => {
    const duplicate = {
      ...tokenManifest,
      semanticV2: {
        ...tokenManifest.semanticV2,
        duplicate: {
          ...tokenManifest.semanticV2["color.canvas"],
          cssVariable:
            tokenManifest.semanticV2["color.contentPrimary"].cssVariable,
        },
      },
    } as TokenManifest;
    expect(validateTokenManifest(duplicate).some((error) => error.includes("is shared"))).toBe(true);

    const missing = {
      ...tokenManifest,
      semanticV2: {
        ...tokenManifest.semanticV2,
        broken: {
          ...tokenManifest.semanticV2["color.canvas"],
          cssVariable: "--color-test-broken",
          values: {
            ...tokenManifest.semanticV2["color.canvas"].values,
            light: "{primitive.color.does-not-exist}",
          },
        },
      },
    } as TokenManifest;
    expect(validateTokenManifest(missing).some((error) => error.includes("missing token"))).toBe(true);

    const cycle = {
      ...tokenManifest,
      primitive: {
        ...tokenManifest.primitive,
        "color.oat.50": {
          ...tokenManifest.primitive["color.oat.50"],
          values: {
            ...tokenManifest.primitive["color.oat.50"].values,
            light: "{primitive.color.oat.50}",
          },
        },
      },
    } as TokenManifest;
    expect(validateTokenManifest(cycle).some((error) => error.includes("cycle"))).toBe(true);
  });
});

describe("V1 compatibility snapshot", () => {
  it("matches every current light and effective dark runtime value exactly", () => {
    const globals = readFileSync(
      resolve(repositoryRoot, "frontend/src/styles/globals.css"),
      "utf8",
    );
    const baseLayerOffset = globals.indexOf("@layer base");
    const light = parseCustomProperties(
      extractBlock(globals, ":root", baseLayerOffset),
    );
    const darkOverrides = parseCustomProperties(
      extractBlock(globals, '[data-theme="dark"]', baseLayerOffset),
    );
    const effectiveDark = { ...light, ...darkOverrides };
    const manifestLight = Object.fromEntries(
      Object.entries(tokenManifest.compatV1).map(([name, values]) => [
        name,
        values.light,
      ]),
    );
    const manifestDark = Object.fromEntries(
      Object.entries(tokenManifest.compatV1).map(([name, values]) => [
        name,
        values.dark,
      ]),
    );

    expect(Object.keys(light)).toHaveLength(131);
    expect(Object.keys(darkOverrides)).toHaveLength(91);
    expect(manifestLight).toEqual(light);
    expect(manifestDark).toEqual(effectiveDark);
  });
});

describe("Living Label contrast contracts", () => {
  it.each(["light", "dark"] as const)(
    "meets normal-text and meaningful UI thresholds in %s mode",
    (theme) => {
      for (const contract of contrastContracts) {
        const foreground = resolveTokenValue(
          tokenManifest,
          contract.foreground,
          theme,
        );
        const background = resolveTokenValue(
          tokenManifest,
          contract.background,
          theme,
        );
        const ratio = contrastRatio(foreground, background);
        expect(
          ratio,
          `${contract.name} (${foreground} on ${background})`,
        ).toBeGreaterThanOrEqual(contract.minimum);
        expect(contract.minimum).toBe(
          contract.purpose === "normalText" ? 4.5 : 3,
        );
      }
    },
  );
});

describe("deterministic generated artifacts", () => {
  it("is byte-stable and matches every checked-in artifact", () => {
    const first = buildGeneratedArtifacts();
    const second = buildGeneratedArtifacts();
    expect(second).toEqual(first);

    for (const artifactPath of GENERATED_ARTIFACT_PATHS) {
      expect(readFileSync(resolve(repositoryRoot, artifactPath), "utf8")).toBe(
        first[artifactPath],
      );
    }
  });

  it("pins deterministic generated artifacts to LF across checkout platforms", () => {
    const attributes = readFileSync(resolve(repositoryRoot, ".gitattributes"), "utf8");
    for (const artifactPath of [
      "frontend/src/design-system/generated/tokens.css",
      "frontend/src/design-system/generated/tokens.ts",
      "docs/assets/design-tokens.json",
    ]) {
      expect(attributes).toContain(`${artifactPath} text eol=lf`);
    }
  });

  it("emits only opt-in CSS scopes with no font or runtime-host binding", () => {
    const css = buildGeneratedArtifacts()[
      "frontend/src/design-system/generated/tokens.css"
    ];
    expect(css).toContain(':where([data-design-system="v2"])');
    expect(css).toContain(':where([data-design-system="v1"])');
    expect(css).toContain(
      '[data-theme="dark"] [data-design-system="v2"]:not([data-theme="light"], [data-theme="light"] *)',
    );
    expect(css).toContain(
      '[data-theme="dark"] [data-design-system="v1"]:not([data-theme="light"], [data-theme="light"] *)',
    );
    expect(css).toContain(
      '[data-design-system="v2"]:not([data-theme="light"], [data-theme="light"] *)',
    );
    expect(css).toContain(
      '[data-design-system="v1"]:not([data-theme="light"], [data-theme="light"] *)',
    );
    expect(css).not.toContain(
      '[data-design-system="v2"]:not([data-theme="light"]))',
    );
    expect(css).not.toMatch(/(^|\n)\s*:root\b/);
    expect(css).not.toContain("@font-face");
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\[data-design-system="v1"\][\s\S]*--duration-instant: 0ms;[\s\S]*--duration-slow: 0ms;/u,
    );
  });

  it("compiles semantic V2 Tailwind utilities without activating legacy aliases", async () => {
    const css = buildGeneratedArtifacts()[
      "frontend/src/design-system/generated/tokens.css"
    ];
    const compiler = await compile(`${css}\n@tailwind utilities;`);
    const compiled = compiler.build([
      "bg-canvas",
      "bg-surface-1",
      "text-content-primary",
      "border-border-default",
      "bg-background",
      "border-border",
    ]);

    expect(compiled).toContain(
      ".bg-canvas {\n  background-color: var(--ds-utility-color-canvas);",
    );
    expect(compiled).toContain(
      ".bg-surface-1 {\n  background-color: var(--ds-utility-color-surface-1);",
    );
    expect(compiled).toContain(
      ".text-content-primary {\n  color: var(--ds-utility-color-content-primary);",
    );
    expect(compiled).toContain(
      ".border-border-default {\n  border-color: var(--ds-utility-color-border-default);",
    );
    expect(compiled).not.toContain(".bg-background {");
    expect(compiled).not.toContain(".border-border {");
  });

  it("keeps the generated documentation sections in canonical order", () => {
    const docs = JSON.parse(
      buildGeneratedArtifacts()["docs/assets/design-tokens.json"],
    ) as Record<string, unknown>;
    expect(Object.keys(docs).slice(-5)).toEqual(TOKEN_SECTION_ORDER);
  });
});
