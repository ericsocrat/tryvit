import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertInventoryProvenanceAgainstCheckout,
  assertNoForbiddenRuntimeImports,
  assertShrinkOnlyVisualDebt,
  buildLiveRouteComponentInventory,
  LIVE_INVENTORY_BASE_SHA_ENV,
  scanVisualDebt,
  scanRuntimeBoundaryAudit,
  type VisualDebtRatchet,
  writeLiveRouteComponentInventory,
} from "@/../tooling/design-system/phase5a1a-live-inventory";

const repositoryRoot = path.resolve(process.cwd(), "..");

function write(root: string, relative: string, contents: string): void {
  const filename = path.join(root, relative);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, contents, "utf8");
}

function git(root: string, arguments_: readonly string[]): string {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitInventoryBaseline(root: string): string {
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "TryVit inventory contract"]);
  git(root, ["config", "user.email", "inventory-contract@tryvit.invalid"]);
  git(root, ["add", "--all"]);
  git(root, ["commit", "--no-gpg-sign", "-m", "test: establish inventory baseline"]);
  return git(root, ["rev-parse", "HEAD"]);
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
      write(
        root,
        "frontend/src/components/Widget.tsx",
        'import { loadLeaf } from "@/lib/bridge";\nexport { loadLeaf };\nexport default function Widget() { return <div className="card" />; }\n',
      );
      write(
        root,
        "frontend/src/components/Leaf.tsx",
        "export default function Leaf() { return null; }\n",
      );
      write(
        root,
        "frontend/src/lib/bridge.ts",
        'export async function loadLeaf() { return import("@/components/Leaf"); }\n',
      );
      write(
        root,
        "frontend/src/__tests__/setup.ts",
        'import "@/../tooling/test-only";\n',
      );
      write(
        root,
        "frontend/src/components/__mocks__/Widget.tsx",
        'export default function MockWidget() { return <div className="card" />; }\n',
      );
      write(root, "frontend/tooling/test-only.ts", "export const testOnly = true;\n");
      write(
        root,
        "frontend/src/styles/globals.css",
        ".card { box-shadow: none; }\n.example { @apply transition-all shadow-[0_1px_2px_black]; }\n",
      );
      const inventory = buildLiveRouteComponentInventory(root, {
        baseSha: "b".repeat(40),
        baseReference: "merge-base HEAD origin/main",
      });
      expect(inventory.schemaVersion).toBe(3);
      expect(inventory.kind).toBe("phase5-live-route-component-inventory");
      expect(inventory.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "frontend/src/app/(marketing)/page.tsx",
            classification: "route-module",
            routeModuleKind: "page",
            routePath: "/",
            hasUseClientDirective: true,
            runtimeBoundary: "client-entry",
            directModuleImports: ["frontend/src/components/Widget.tsx"],
            transitiveRouteConsumers: [
              {
                modulePath: "frontend/src/app/(marketing)/page.tsx",
                routeModuleKind: "page",
                routePath: "/",
              },
            ],
            targetRedesignPhases: ["5A.3"],
            disposition: "migrate-to-v2",
            migrationGate: "approved-5a2-golden-reference-and-authorized-phase-entry",
            removalGate:
              "replacement-or-route-removal-approved-and-zero-transitive-route-consumers",
            designSystemStatus: "v1",
          }),
          expect.objectContaining({
            path: "frontend/src/app/late.tsx",
            classification: "app-support-module",
            hasUseClientDirective: false,
            runtimeBoundary: "server-only",
          }),
          expect.objectContaining({
            path: "frontend/src/components/Widget.tsx",
            classification: "shared-component-module",
            runtimeBoundary: "client-reachable",
            directModuleImports: ["frontend/src/lib/bridge.ts"],
            directConsumers: ["frontend/src/app/(marketing)/page.tsx", "frontend/src/app/late.tsx"],
            transitiveRouteConsumers: [
              {
                modulePath: "frontend/src/app/(marketing)/page.tsx",
                routeModuleKind: "page",
                routePath: "/",
              },
            ],
            classifiedLegacyDebt: [
              {
                category: "legacy-card",
                occurrences: [{ value: ".card", count: 1 }],
              },
            ],
          }),
          expect.objectContaining({
            path: "frontend/src/components/Leaf.tsx",
            runtimeBoundary: "client-reachable",
            directConsumers: ["frontend/src/lib/bridge.ts"],
            transitiveRouteConsumers: [
              {
                modulePath: "frontend/src/app/(marketing)/page.tsx",
                routeModuleKind: "page",
                routePath: "/",
              },
            ],
          }),
        ]),
      );
      expect(inventory.provenance.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/u);
      expect(inventory.runtimeBoundaryAudit).toMatchObject({
        scannedRoot: "frontend/src",
        inspectedModuleCount: 5,
        violations: [],
      });
      expect(inventory.modules.map((module) => module.path)).not.toEqual(
        expect.arrayContaining([
          "frontend/src/__tests__/setup.ts",
          "frontend/src/components/__mocks__/Widget.tsx",
        ]),
      );
      expect(inventory.runtimeBoundaryAudit.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/u);
      expect(
        inventory.visualDebtRatchets.find((item) => item.category === "legacy-card"),
      ).toMatchObject({
        occurrences: [
          { path: "frontend/src/components/Widget.tsx", value: ".card", count: 1 },
          { path: "frontend/src/styles/globals.css", value: ".card", count: 1 },
        ],
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

  it("records symbol-aware compatibility-facade consumers instead of barrel-wide reach", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-facades-"));
    try {
      write(
        root,
        "frontend/src/app/page.tsx",
        'import { Button, Input } from "@/components/common";\nimport { InfoTooltip } from "@/components/common/InfoTooltip";\nimport { Wrapper } from "@/components/Wrapper";\nexport default function Page() { return <><Button>Save</Button><Input /><InfoTooltip /><Wrapper /></>; }\n',
      );
      write(
        root,
        "frontend/src/components/Wrapper.tsx",
        'import { Card } from "@/components/common/Card";\nexport function Wrapper() { return <Card />; }\n',
      );
      write(
        root,
        "frontend/src/components/common/index.ts",
        'export * from "./Button";\nexport * from "./Input";\n',
      );
      write(
        root,
        "frontend/src/components/common/Button.tsx",
        "export function Button({ children }: { children?: unknown }) { return children; }\nexport function ButtonLink() { return null; }\nexport function buttonClasses() { return ''; }\n",
      );
      write(
        root,
        "frontend/src/components/common/Card.tsx",
        "export function Card() { return null; }\n",
      );
      write(
        root,
        "frontend/src/components/common/InfoTooltip.tsx",
        "export function InfoTooltip() { return null; }\n",
      );
      write(
        root,
        "frontend/src/components/common/Input.tsx",
        "export function Input() { return null; }\n",
      );
      write(
        root,
        "frontend/src/design-system/primitives/Button/Button.tsx",
        "export function V2Button() { return null; }\n",
      );
      write(
        root,
        "frontend/src/design-system/tokens/manifest.ts",
        "export const manifest = {};\n",
      );

      const inventory = buildLiveRouteComponentInventory(root, {
        baseSha: "b".repeat(40),
        baseReference: "merge-base HEAD origin/main",
      });
      expect(inventory.compatibilityFacadeAudit.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/u);
      expect(inventory.compatibilityFacadeAudit.facades).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            facade: "Button",
            directConsumers: ["frontend/src/app/page.tsx"],
            transitiveRouteConsumers: [
              {
                modulePath: "frontend/src/app/page.tsx",
                routeModuleKind: "page",
                routePath: "/",
              },
            ],
          }),
          expect.objectContaining({
            facade: "Card",
            directConsumers: ["frontend/src/components/Wrapper.tsx"],
            transitiveRouteConsumers: [
              {
                modulePath: "frontend/src/app/page.tsx",
                routeModuleKind: "page",
                routePath: "/",
              },
            ],
          }),
          expect.objectContaining({
            facade: "InfoTooltip",
            directConsumers: ["frontend/src/app/page.tsx"],
          }),
          expect.objectContaining({ facade: "ConfirmDialog", directConsumers: [] }),
          expect.objectContaining({ facade: "EmptyState", directConsumers: [] }),
          expect.objectContaining({ facade: "IconBridge", directConsumers: [] }),
        ]),
      );
      expect(inventory.compatibilityFacadeAudit.facades.map((item) => item.facade)).not.toContain(
        "Input",
      );
      expect(inventory.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "frontend/src/design-system/primitives/Button/Button.tsx",
            targetRedesignPhases: ["5A.1b"],
            disposition: "retain-v2",
          }),
          expect.objectContaining({
            path: "frontend/src/design-system/tokens/manifest.ts",
            targetRedesignPhases: ["5A.1a"],
            disposition: "retain-v2",
          }),
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("fails closed when a runtime import escapes src into a forbidden local root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-boundary-"));
    try {
      write(
        root,
        "frontend/src/app/page.tsx",
        'import type { TypeOnly } from "@/../tooling/type-only";\nvoid import("@/../tooling/runtime-helper");\nexport default function Page(): TypeOnly { return null; }\n',
      );
      write(root, "frontend/tooling/runtime-helper.ts", "export const helper = true;\n");
      write(root, "frontend/tooling/type-only.ts", "export type TypeOnly = null;\n");

      const audit = scanRuntimeBoundaryAudit(root);
      expect(audit.violations).toEqual([
        {
          importer: "frontend/src/app/page.tsx",
          specifier: "@/../tooling/runtime-helper",
          resolvedPath: "frontend/tooling/runtime-helper.ts",
          forbiddenRoot: "frontend/tooling",
        },
      ]);
      expect(() => assertNoForbiddenRuntimeImports(audit)).toThrow(
        "forbidden-runtime-import:frontend/src/app/page.tsx:@/../tooling/runtime-helper:frontend/tooling/runtime-helper.ts",
      );
      expect(() =>
        buildLiveRouteComponentInventory(root, {
          baseSha: "b".repeat(40),
          baseReference: "merge-base HEAD origin/main",
        }),
      ).toThrow("forbidden-runtime-import");
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

    const relocated = structuredClone(baseline);
    relocated[0] = {
      category: "legacy-card",
      occurrences: [
        { path: "frontend/src/design-system/compat-v1/Card.tsx", value: ".card", count: 2 },
      ],
    };
    expect(() =>
      assertShrinkOnlyVisualDebt(baseline, relocated, [
        {
          fromPath: "frontend/src/app/page.tsx",
          toPath: "frontend/src/design-system/compat-v1/Card.tsx",
          reason: "verified-v1-compatibility-facade-relocation",
        },
      ]),
    ).not.toThrow();

    const relocatedBaseline = structuredClone(relocated);
    expect(() =>
      assertShrinkOnlyVisualDebt(relocatedBaseline, relocated, [
        {
          fromPath: "frontend/src/app/page.tsx",
          toPath: "frontend/src/design-system/compat-v1/Card.tsx",
          reason: "verified-v1-compatibility-facade-relocation",
        },
      ]),
    ).not.toThrow();

    relocated[0] = {
      category: "legacy-card",
      occurrences: [
        { path: "frontend/src/design-system/compat-v1/Card.tsx", value: ".card", count: 3 },
      ],
    };
    expect(() =>
      assertShrinkOnlyVisualDebt(baseline, relocated, [
        {
          fromPath: "frontend/src/app/page.tsx",
          toPath: "frontend/src/design-system/compat-v1/Card.tsx",
          reason: "verified-v1-compatibility-facade-relocation",
        },
      ]),
    ).toThrow(
      "visual-debt-count-increased:legacy-card:frontend/src/design-system/compat-v1/Card.tsx:.card",
    );

    relocated[0] = {
      category: "legacy-card",
      occurrences: [
        { path: "frontend/src/app/page.tsx", value: ".card", count: 1 },
        { path: "frontend/src/design-system/compat-v1/Card.tsx", value: ".card", count: 1 },
      ],
    };
    expect(() =>
      assertShrinkOnlyVisualDebt(baseline, relocated, [
        {
          fromPath: "frontend/src/app/page.tsx",
          toPath: "frontend/src/design-system/compat-v1/Card.tsx",
          reason: "verified-v1-compatibility-facade-relocation",
        },
      ]),
    ).toThrow("visual-debt-relocation-source-and-target:legacy-card:.card");
  });

  it("refuses to overwrite the generated baseline with newly introduced debt", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-ratchet-"));
    const provenance = {
      baseSha: "b".repeat(40),
      baseReference: "merge-base HEAD origin/main" as const,
    };
    try {
      write(root, "frontend/src/app/page.tsx", "export default function Page() { return null; }\n");
      mkdirSync(path.join(root, "docs", "phase5"), { recursive: true });
      const baseline = buildLiveRouteComponentInventory(root, provenance);
      const output = path.join(root, "docs", "phase5", "live-route-component-inventory.json");
      writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
      const baseSha = commitInventoryBaseline(root);

      write(
        root,
        "frontend/src/app/page.tsx",
        'export default function Page() { return <div className="card" />; }\n',
      );
      const increased = buildLiveRouteComponentInventory(root, {
        baseSha,
        baseReference: "merge-base HEAD origin/main",
      });
      expect(() =>
        writeLiveRouteComponentInventory(root, increased, { expectedBaseSha: baseSha }),
      ).toThrow(
        "visual-debt-new-occurrence:legacy-card:frontend/src/app/page.tsx:.card",
      );
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(baseline);
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("fails closed without touching the report while another writer holds the lock", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-lock-"));
    const provenance = {
      baseSha: "d".repeat(40),
      baseReference: "merge-base HEAD origin/main" as const,
    };
    try {
      write(root, "frontend/src/app/page.tsx", "export default function Page() { return null; }\n");
      mkdirSync(path.join(root, "docs", "phase5"), { recursive: true });
      const inventory = buildLiveRouteComponentInventory(root, provenance);
      const output = path.join(root, "docs", "phase5", "live-route-component-inventory.json");
      writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
      const baseSha = commitInventoryBaseline(root);
      const current = buildLiveRouteComponentInventory(root, {
        baseSha,
        baseReference: "merge-base HEAD origin/main",
      });
      writeFileSync(`${output}.lock`, "held", "utf8");

      expect(() =>
        writeLiveRouteComponentInventory(root, current, { expectedBaseSha: baseSha }),
      ).toThrow("live-inventory-writer-locked");
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(inventory);
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("does not let a PR-owned report bless debt above the Git base", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-ratchet-bypass-"));
    const provisional = {
      baseSha: "e".repeat(40),
      baseReference: "merge-base HEAD origin/main" as const,
    };
    try {
      write(
        root,
        "frontend/src/app/page.tsx",
        'export default function Page() { return <div className="card" />; }\n',
      );
      mkdirSync(path.join(root, "docs", "phase5"), { recursive: true });
      const baseline = buildLiveRouteComponentInventory(root, provisional);
      const output = path.join(root, "docs", "phase5", "live-route-component-inventory.json");
      writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
      const baseSha = commitInventoryBaseline(root);

      write(
        root,
        "frontend/src/app/page.tsx",
        'export default function Page() { return <><div className="card" /><div className="card" /></>; }\n',
      );
      const increased = buildLiveRouteComponentInventory(root, {
        baseSha,
        baseReference: "merge-base HEAD origin/main",
      });
      // Simulate the bypass: the mutable worktree snapshot is edited to carry
      // the increased maxima before generation runs.
      writeFileSync(output, `${JSON.stringify(increased, null, 2)}\n`, "utf8");

      expect(() =>
        writeLiveRouteComponentInventory(root, increased, { expectedBaseSha: baseSha }),
      ).toThrow(
        "visual-debt-count-increased:legacy-card:frontend/src/app/page.tsx:.card",
      );
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(increased);
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("rejects report provenance that does not match the independently resolved base", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-provenance-bypass-"));
    const provisional = {
      baseSha: "f".repeat(40),
      baseReference: "merge-base HEAD origin/main" as const,
    };
    try {
      write(root, "frontend/src/app/page.tsx", "export default function Page() { return null; }\n");
      mkdirSync(path.join(root, "docs", "phase5"), { recursive: true });
      const baseline = buildLiveRouteComponentInventory(root, provisional);
      const output = path.join(root, "docs", "phase5", "live-route-component-inventory.json");
      writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
      const baseSha = commitInventoryBaseline(root);
      const spoofed = buildLiveRouteComponentInventory(root, {
        baseSha: "a".repeat(40),
        baseReference: "merge-base HEAD origin/main",
      });

      expect(() =>
        writeLiveRouteComponentInventory(root, spoofed, { expectedBaseSha: baseSha }),
      ).toThrow(`live-inventory-provenance-base-mismatch:${"a".repeat(40)}:${baseSha}`);
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(baseline);
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  });

  it("verifies historical provenance when exact-main checks compare the committed report", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tryvit-live-main-provenance-"));
    const provisional = {
      baseSha: "c".repeat(40),
      baseReference: "merge-base HEAD origin/main" as const,
    };
    try {
      write(root, "frontend/src/app/page.tsx", "export default function Page() { return null; }\n");
      mkdirSync(path.join(root, "docs", "phase5"), { recursive: true });
      const baseline = buildLiveRouteComponentInventory(root, provisional);
      const output = path.join(root, "docs", "phase5", "live-route-component-inventory.json");
      writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
      const baseSha = commitInventoryBaseline(root);

      write(
        root,
        "frontend/src/components/New.tsx",
        "export function New() { return null; }\n",
      );
      const introduced = buildLiveRouteComponentInventory(root, {
        baseSha,
        baseReference: "merge-base HEAD origin/main",
      });
      writeFileSync(output, `${JSON.stringify(introduced, null, 2)}\n`, "utf8");
      git(root, ["add", "--all"]);
      git(root, ["commit", "--no-gpg-sign", "-m", "test: introduce current inventory"]);
      const exactMainSha = git(root, ["rev-parse", "HEAD"]);

      expect(
        assertInventoryProvenanceAgainstCheckout(root, introduced, exactMainSha),
      ).toMatchObject({ baseSha });
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
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
    const comparison = assertInventoryProvenanceAgainstCheckout(
      repositoryRoot,
      committed,
      process.env[LIVE_INVENTORY_BASE_SHA_ENV],
    );
    expect(() =>
      assertShrinkOnlyVisualDebt(
        comparison.inventory.visualDebtRatchets,
        scanVisualDebt(repositoryRoot),
        committed.visualDebtRelocations,
      ),
    ).not.toThrow();
  });
});
