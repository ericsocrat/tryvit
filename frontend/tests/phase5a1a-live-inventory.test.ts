import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertShrinkOnlyVisualDebt,
  buildLiveRouteComponentInventory,
  scanVisualDebt,
  type VisualDebtRatchet,
} from "@/../tooling/design-system/phase5a1a-live-inventory";

const repositoryRoot = path.resolve(process.cwd(), "..");

function write(root: string, relative: string, contents: string): void {
  const filename = path.join(root, relative);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, contents, "utf8");
}

function emptyRatchets(): VisualDebtRatchet[] {
  return [
    "legacy-card",
    "legacy-input-field",
    "arbitrary-shadow",
    "arbitrary-radius",
    "arbitrary-duration",
    "arbitrary-animation",
    "arbitrary-tracking",
    "transition-all",
  ].map((category) => ({ category, occurrences: [] })) as VisualDebtRatchet[];
}

describe("Phase 5A.1a live route/component inventory", () => {
  it("classifies route and component modules, valid directives, and local consumers", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-inventory-"));
    try {
      write(
        root,
        "frontend/src/app/(marketing)/page.tsx",
        '"use strict";\n"use client";\nimport Widget from "@/components/Widget";\nexport default Widget;\n',
      );
      write(
        root,
        "frontend/src/app/late.tsx",
        'import Widget from "@/components/Widget";\n"use client";\nexport default Widget;\n',
      );
      write(root, "frontend/src/components/Widget.tsx", "export default function Widget() { return null; }\n");
      write(
        root,
        "frontend/src/styles/globals.css",
        ".card { box-shadow: none; }\n.example { @apply transition-all shadow-[0_1px_2px_black]; }\n",
      );
      const inventory = buildLiveRouteComponentInventory(root, {
        baseSha: "b".repeat(40),
        baseReference: "merge-base HEAD origin/main",
      });
      expect(inventory.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "frontend/src/app/(marketing)/page.tsx",
            classification: "route-module",
            routeModuleKind: "page",
            routePath: "/",
            hasUseClientDirective: true,
            directModuleImports: ["frontend/src/components/Widget.tsx"],
          }),
          expect.objectContaining({
            path: "frontend/src/app/late.tsx",
            classification: "app-support-module",
            hasUseClientDirective: false,
          }),
          expect.objectContaining({
            path: "frontend/src/components/Widget.tsx",
            classification: "shared-component-module",
            directConsumers: [
              "frontend/src/app/(marketing)/page.tsx",
              "frontend/src/app/late.tsx",
            ],
          }),
        ]),
      );
      expect(inventory.provenance.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/u);
      expect(inventory.visualDebtRatchets.find((item) => item.category === "legacy-card"))
        .toMatchObject({
          occurrences: [{ path: "frontend/src/styles/globals.css", value: ".card", count: 1 }],
        });
      expect(
        inventory.visualDebtRatchets.find((item) => item.category === "arbitrary-shadow"),
      ).toMatchObject({
        occurrences: [
          {
            path: "frontend/src/styles/globals.css",
            value: "shadow-[0_1px_2px_black]",
            count: 1,
          },
        ],
      });
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("enforces exact path/value/count maxima while permitting debt reductions", () => {
    const baseline = emptyRatchets();
    baseline[0] = {
      category: "legacy-card",
      occurrences: [{ path: "frontend/src/app/page.tsx", value: ".card", count: 2 }],
    };
    const reduced = structuredClone(baseline);
    reduced[0] = {
      category: "legacy-card",
      occurrences: [{ path: "frontend/src/app/page.tsx", value: ".card", count: 1 }],
    };
    expect(() => assertShrinkOnlyVisualDebt(baseline, reduced)).not.toThrow();

    const increased = structuredClone(baseline);
    increased[0] = {
      category: "legacy-card",
      occurrences: [{ path: "frontend/src/app/page.tsx", value: ".card", count: 3 }],
    };
    expect(() => assertShrinkOnlyVisualDebt(baseline, increased)).toThrow(
      "visual-debt-count-increased:legacy-card:frontend/src/app/page.tsx:.card",
    );

    const newPath = structuredClone(baseline);
    newPath[0] = {
      category: "legacy-card",
      occurrences: [{ path: "frontend/src/components/New.tsx", value: ".card", count: 1 }],
    };
    expect(() => assertShrinkOnlyVisualDebt(baseline, newPath)).toThrow(
      "visual-debt-new-occurrence:legacy-card:frontend/src/components/New.tsx:.card",
    );

    const unclassified = [
      ...baseline,
      { category: "unclassified" as "legacy-card", occurrences: [] },
    ];
    expect(() => assertShrinkOnlyVisualDebt(baseline, unclassified)).toThrow(
      "visual-debt-unclassified-category:unclassified",
    );
  });

  it("keeps the committed report current and ratchets its production debt only downward", () => {
    const committed = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "docs", "phase5", "live-route-component-inventory.json"),
        "utf8",
      ),
    );
    expect(committed.provenance.baseSha).toMatch(/^[0-9a-f]{40}$/u);
    expect(committed.provenance.baseReference).toBe("merge-base HEAD origin/main");
    // PR jobs intentionally use shallow, merge-ref checkouts where
    // `origin/main` need not exist. Graph drift is independent of checkout
    // topology, so retain the generated provenance while recomputing content.
    const current = buildLiveRouteComponentInventory(repositoryRoot, {
      baseSha: committed.provenance.baseSha,
      baseReference: committed.provenance.baseReference,
    });
    expect(current).toEqual(committed);
    expect(() => assertShrinkOnlyVisualDebt(committed.visualDebtRatchets, scanVisualDebt(repositoryRoot))).not.toThrow();
  });
});
