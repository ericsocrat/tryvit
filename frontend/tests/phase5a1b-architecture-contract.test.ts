import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const frontendRoot = process.cwd();
const sourceRoot = path.join(frontendRoot, "src");
const guardedPhase5A2V2Importers = new Set([
  "src/app/dev/phase5a2/_directions/evidence-register/EvidenceRegister.tsx",
  "src/app/dev/phase5a2/_directions/open-core/OpenCore.tsx",
  "src/app/dev/phase5a2/_directions/source-fold/SourceFold.tsx",
  "src/app/dev/phase5a2/_shared/MotionStudy.client.tsx",
  "src/app/dev/phase5a2/_shared/ProductLookup.client.tsx",
  "src/app/dev/phase5a2/_shared/ScannerStudy.client.tsx",
]);
const canonicalV2ReviewRoutes = new Set([
  "/dev/components",
  "/dev/phase5a2/[candidate]/[surface]",
  "/dev/phase5a2/golden/[reference]",
  "/dev/phase5a2/golden-assets/[board]",
]);

function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function listFiles(root: string, extensions: ReadonlySet<string>): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, extensions));
    else if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files.sort(compareOrdinal);
}

function relative(filename: string): string {
  return path.relative(frontendRoot, filename).split(path.sep).join("/");
}

function isAdmittedV2ReviewSource(filename: string): boolean {
  const relativePath = relative(filename);
  return (
    relativePath.startsWith("src/app/dev/components/") ||
    relativePath.startsWith("src/app/dev/phase5a2/_golden/") ||
    relativePath.startsWith("src/app/dev/phase5a2/golden/") ||
    relativePath.startsWith("src/app/dev/phase5a2/golden-assets/") ||
    guardedPhase5A2V2Importers.has(relativePath)
  );
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/gu)]
    .map((match) => match[1]!)
    .sort(compareOrdinal);
}

describe("Phase 5A.1b architecture contract", () => {
  it("keeps production on V1 and bounds V2 imports to exact review sources", () => {
    const rootLayout = readFileSync(path.join(sourceRoot, "app", "layout.tsx"), "utf8");
    expect(rootLayout).toContain('data-design-system="v1"');

    const productionFiles = [
      ...listFiles(path.join(sourceRoot, "app"), new Set([".ts", ".tsx"])),
      ...listFiles(path.join(sourceRoot, "components"), new Set([".ts", ".tsx"])),
    ].filter((filename) => !isAdmittedV2ReviewSource(filename));
    const violations = productionFiles.flatMap((filename) =>
      importSpecifiers(readFileSync(filename, "utf8"))
        .filter((specifier) =>
          /^@\/design-system\/(?:icons|patterns|primitives)(?:\/|$)/u.test(specifier),
        )
        .map((specifier) => `${relative(filename)}:${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it("rejects V2 reachability outside admitted non-production review routes", () => {
    const inventory = JSON.parse(
      readFileSync(
        path.join(frontendRoot, "..", "docs", "phase5", "live-route-component-inventory.json"),
        "utf8",
      ),
    ) as {
      readonly schemaVersion: number;
      readonly modules: readonly {
        readonly path: string;
        readonly transitiveRouteConsumers: readonly {
          readonly routePath: string;
        }[];
      }[];
    };
    expect(inventory.schemaVersion).toBe(3);
    const violations = inventory.modules.flatMap((module) => {
      if (
        !/^frontend\/src\/design-system\/(?:icons|patterns|primitives)\//u.test(
          module.path,
        )
      ) {
        return [];
      }
      return module.transitiveRouteConsumers
        .filter((consumer) => !canonicalV2ReviewRoutes.has(consumer.routePath))
        .map((consumer) => `${module.path}:${consumer.routePath}`);
    });
    expect(violations).toEqual([]);
  });

  it("keeps the Phase 5A.2 V2 admission private and fail-closed", () => {
    const phase5A2Root = path.join(sourceRoot, "app", "dev", "phase5a2");
    const gate = readFileSync(path.join(phase5A2Root, "phase5a2-gate.ts"), "utf8");
    const pages = [
      readFileSync(path.join(phase5A2Root, "page.tsx"), "utf8"),
      readFileSync(
        path.join(phase5A2Root, "[candidate]", "[surface]", "page.tsx"),
        "utf8",
      ),
    ];

    expect(gate).toContain('environment.nodeEnv !== "production"');
    expect(gate).toContain('environment.directionSelection === "1"');
    expect(gate).not.toContain("NEXT_PUBLIC");
    for (const page of pages) {
      expect(page).toContain('export const dynamic = "force-dynamic"');
      expect(page).toContain("phase5A2GateFromProcessEnvironment()");
      expect(page).toContain("notFound()");
    }

    const goldenGate = readFileSync(
      path.join(phase5A2Root, "_golden", "golden-gate.ts"),
      "utf8",
    );
    const goldenPages = [
      readFileSync(path.join(phase5A2Root, "golden", "[reference]", "page.tsx"), "utf8"),
      readFileSync(path.join(phase5A2Root, "golden-assets", "[board]", "page.tsx"), "utf8"),
    ];
    expect(goldenGate).toContain('environment.PHASE5A2_DIRECTION_SELECTION === "1"');
    expect(goldenGate).toContain("phase5A2GateFromProcessEnvironment(environment)");
    expect(goldenGate).not.toContain("NEXT_PUBLIC");
    for (const page of goldenPages) {
      expect(page).toContain('export const dynamic = "force-dynamic"');
      expect(page).toContain("phase5A2GoldenGateFromProcessEnvironment()");
      expect(page).toContain("notFound()");
    }
  });

  it("keeps the five consumer-required common entries as explicit V1 facades", () => {
    const expected = new Map([
      ["Button.tsx", "@/design-system/compat-v1/Button"],
      ["Card.tsx", "@/design-system/compat-v1/Card"],
      ["ConfirmDialog.tsx", "@/design-system/compat-v1/ConfirmDialog"],
      ["EmptyState.tsx", "@/design-system/compat-v1/EmptyState"],
      ["InfoTooltip.tsx", "@/design-system/compat-v1/InfoTooltip"],
    ]);
    for (const [filename, specifier] of expected) {
      const source = readFileSync(path.join(sourceRoot, "components", "common", filename), "utf8");
      expect(importSpecifiers(source), filename).toContain(specifier);
      expect(source, filename).not.toContain('data-design-system="v2"');
    }
  });

  it("contains icon and raw-visual drift inside the canonical V2 boundary", () => {
    const v2Roots = [
      path.join(sourceRoot, "design-system", "icons"),
      path.join(sourceRoot, "design-system", "patterns"),
      path.join(sourceRoot, "design-system", "primitives"),
      path.join(sourceRoot, "app", "dev", "components", "catalog"),
    ];
    const implementationFiles = v2Roots.flatMap((root) =>
      listFiles(root, new Set([".ts", ".tsx", ".css"])),
    );
    const lucideViolations: string[] = [];
    const svgViolations: string[] = [];
    const transitionViolations: string[] = [];
    const rawColorViolations: string[] = [];
    for (const filename of implementationFiles) {
      const source = readFileSync(filename, "utf8");
      const file = relative(filename);
      if (
        file !== "src/design-system/icons/registry.tsx" &&
        importSpecifiers(source).includes("lucide-react")
      ) {
        lucideViolations.push(file);
      }
      if (filename.endsWith(".tsx") && /<svg\b/iu.test(source)) svgViolations.push(file);
      if (/\btransition-all\b|transition-property\s*:\s*all\b/iu.test(source)) {
        transitionViolations.push(file);
      }
      if (
        filename.endsWith(".css") &&
        /(?:#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\()/iu.test(source)
      ) {
        rawColorViolations.push(file);
      }
    }
    expect(lucideViolations).toEqual([]);
    expect(svgViolations).toEqual([]);
    expect(transitionViolations).toEqual([]);
    expect(rawColorViolations).toEqual([]);
    expect(existsSync(path.join(sourceRoot, "design-system", "primitives", "index.ts"))).toBe(
      false,
    );
  });

  it("uses only generated design tokens or explicitly owned runtime variables in V2 CSS", () => {
    const generated = readFileSync(
      path.join(sourceRoot, "design-system", "generated", "tokens.css"),
      "utf8",
    );
    const cssFiles = [
      ...listFiles(path.join(sourceRoot, "design-system", "icons"), new Set([".css"])),
      ...listFiles(path.join(sourceRoot, "design-system", "patterns"), new Set([".css"])),
      ...listFiles(path.join(sourceRoot, "design-system", "primitives"), new Set([".css"])),
    ];
    const missing = cssFiles.flatMap((filename) => {
      const source = readFileSync(filename, "utf8");
      return [...source.matchAll(/var\((--[a-z0-9-]+)/giu)]
        .map((match) => match[1]!)
        .filter(
          (variable) =>
            !generated.includes(`${variable}:`) &&
            !source.includes(`${variable}:`) &&
            !variable.startsWith("--radix-") &&
            !variable.startsWith("--ds-runtime-"),
        )
        .map((variable) => `${relative(filename)}:${variable}`);
    });
    expect([...new Set(missing)].sort(compareOrdinal)).toEqual([]);
  });

  it("keeps browser boundaries at the six canonical interaction entries", () => {
    const primitiveFiles = listFiles(
      path.join(sourceRoot, "design-system", "primitives"),
      new Set([".ts", ".tsx"]),
    ).filter((filename) => !/\.(?:test|type-contract)\.tsx?$/u.test(filename));
    const clientEntries = primitiveFiles
      .filter((filename) => {
        const source = readFileSync(filename, "utf8");
        return /^\uFEFF?["']use client["'];?/u.test(source);
      })
      .map(relative);

    expect(clientEntries).toEqual([
      "src/design-system/primitives/Combobox/Combobox.tsx",
      "src/design-system/primitives/Field/IndeterminateCheckbox.client.tsx",
      "src/design-system/primitives/Menu/Menu.tsx",
      "src/design-system/primitives/Overlay/Overlay.tsx",
      "src/design-system/primitives/Tabs/Tabs.tsx",
      "src/design-system/primitives/Tooltip/Tooltip.tsx",
    ]);
  });
});
