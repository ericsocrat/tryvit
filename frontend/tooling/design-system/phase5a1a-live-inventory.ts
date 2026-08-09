import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "@typescript/typescript6";

const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;
const ROUTE_MODULE_NAMES = new Set([
  "page",
  "layout",
  "loading",
  "error",
  "not-found",
  "global-error",
  "route",
]);

export const LIVE_INVENTORY_REPORT_RELATIVE_PATH =
  "docs/phase5/live-route-component-inventory.json";

export type ModuleClassification =
  | "route-module"
  | "app-support-module"
  | "shared-component-module"
  | "design-system-module";

export interface ProductionModule {
  readonly path: string;
  readonly classification: ModuleClassification;
  readonly routeModuleKind: string | null;
  readonly routePath: string | null;
  readonly hasUseClientDirective: boolean;
  readonly directModuleImports: readonly string[];
  readonly directConsumers: readonly string[];
}

export type VisualDebtCategory =
  | "legacy-card"
  | "legacy-input-field"
  | "arbitrary-shadow"
  | "arbitrary-radius"
  | "arbitrary-duration"
  | "arbitrary-animation"
  | "arbitrary-tracking"
  | "transition-all";

export interface VisualDebtOccurrence {
  readonly path: string;
  readonly value: string;
  readonly count: number;
}

export interface VisualDebtRatchet {
  readonly category: VisualDebtCategory;
  readonly occurrences: readonly VisualDebtOccurrence[];
}

export interface LiveRouteComponentInventory {
  readonly schemaVersion: 1;
  readonly kind: "phase5a1a-live-route-component-inventory";
  readonly provenance: {
    readonly baseSha: string;
    readonly baseReference: "merge-base HEAD origin/main";
    readonly sourceFingerprint: string;
  };
  readonly sourceRoots: readonly [
    "frontend/src/app",
    "frontend/src/components",
    "frontend/src/design-system",
  ];
  readonly moduleCounts: Readonly<Record<ModuleClassification, number>> & { readonly total: number };
  readonly modules: readonly ProductionModule[];
  readonly visualDebtRatchets: readonly VisualDebtRatchet[];
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function relativePath(repositoryRoot: string, absolutePath: string): string {
  return toPosix(path.relative(repositoryRoot, absolutePath));
}

function isProductionSource(filename: string): boolean {
  return (
    SOURCE_EXTENSIONS.some((extension) => filename.endsWith(extension)) &&
    !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filename) &&
    !filename.endsWith(".d.ts")
  );
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolutePath));
    else if (entry.isFile() && isProductionSource(entry.name)) files.push(absolutePath);
  }
  return files.sort(compareOrdinal);
}

function appRoutePath(appRoot: string, filename: string): string {
  const relative = path.relative(appRoot, filename);
  const segments = path.dirname(relative).split(path.sep).filter(Boolean);
  const urlSegments = segments.filter(
    (segment) => !/^\(.+\)$/u.test(segment) && !segment.startsWith("@"),
  );
  return urlSegments.length === 0 ? "/" : `/${urlSegments.join("/")}`;
}

function classifyModule(appRoot: string, designSystemRoot: string, filename: string): {
  classification: ModuleClassification;
  routeModuleKind: string | null;
  routePath: string | null;
} {
  const underApp = filename === appRoot || filename.startsWith(`${appRoot}${path.sep}`);
  if (!underApp) {
    const underDesignSystem =
      filename === designSystemRoot || filename.startsWith(`${designSystemRoot}${path.sep}`);
    return {
      classification: underDesignSystem ? "design-system-module" : "shared-component-module",
      routeModuleKind: null,
      routePath: null,
    };
  }
  const basename = path.basename(filename, path.extname(filename));
  if (ROUTE_MODULE_NAMES.has(basename)) {
    return {
      classification: "route-module",
      routeModuleKind: basename,
      routePath: appRoutePath(appRoot, filename),
    };
  }
  return { classification: "app-support-module", routeModuleKind: null, routePath: null };
}

function hasUseClientDirective(source: string): boolean {
  const file = ts.createSourceFile("module.tsx", source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

function moduleSpecifiers(source: string, filename: string): string[] {
  const specifiers = new Set<string>();
  const scriptKind = filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, false, scriptKind);
  for (const statement of file.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.add(statement.moduleSpecifier.text);
    }
  }
  return [...specifiers].sort(compareOrdinal);
}

function resolveLocalImport(
  frontendRoot: string,
  importer: string,
  specifier: string,
  productionFiles: ReadonlySet<string>,
): string | null {
  let sourceStem: string | null = null;
  if (specifier.startsWith("@/")) sourceStem = path.join(frontendRoot, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) sourceStem = path.resolve(path.dirname(importer), specifier);
  if (!sourceStem) return null;

  const candidates = SOURCE_EXTENSIONS.map((extension) => `${sourceStem}${extension}`);
  candidates.push(...SOURCE_EXTENSIONS.map((extension) => path.join(sourceStem, `index${extension}`)));
  if (SOURCE_EXTENSIONS.some((extension) => sourceStem.endsWith(extension))) candidates.unshift(sourceStem);
  return candidates.find((candidate) => productionFiles.has(candidate)) ?? null;
}

function directModuleImports(
  frontendRoot: string,
  filename: string,
  source: string,
  productionFiles: ReadonlySet<string>,
): string[] {
  const imports = new Set<string>();
  for (const specifier of moduleSpecifiers(source, filename)) {
    const resolved = resolveLocalImport(
      frontendRoot,
      filename,
      specifier,
      productionFiles,
    );
    if (resolved) imports.add(resolved);
  }
  return [...imports].sort(compareOrdinal);
}

function addOccurrence(
  occurrences: Map<VisualDebtCategory, Map<string, number>>,
  category: VisualDebtCategory,
  filename: string,
  value: string,
  count: number,
): void {
  if (count === 0) return;
  const byValue = occurrences.get(category) ?? new Map<string, number>();
  occurrences.set(category, byValue);
  const key = `${filename}\u0000${value}`;
  byValue.set(key, (byValue.get(key) ?? 0) + count);
}

function occurrencesForRegex(
  source: string,
  expression: RegExp,
): Map<string, number> {
  const values = new Map<string, number>();
  for (const match of source.matchAll(expression)) {
    const value = match[0];
    values.set(value, (values.get(value) ?? 0) + 1);
  }
  return values;
}

function classTokenCount(source: string, token: string): number {
  const attributes = /\b(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/gu;
  let count = 0;
  for (const match of source.matchAll(attributes)) {
    count += (match[1] ?? match[2] ?? match[3] ?? "")
      .split(/\s+/u)
      .filter((value) => value === token).length;
  }
  return count;
}

function cssSelectorCount(source: string, selector: string): number {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [...source.matchAll(new RegExp(`${escaped}(?![A-Za-z0-9_-])`, "gu"))].length;
}

export function scanVisualDebt(repositoryRoot: string): readonly VisualDebtRatchet[] {
  const sourceRoot = path.join(repositoryRoot, "frontend", "src");
  const files = listFiles(sourceRoot).concat(
    listCssFiles(sourceRoot),
  ).sort(compareOrdinal);
  const occurrences = new Map<VisualDebtCategory, Map<string, number>>();
  const patterns: readonly [VisualDebtCategory, RegExp][] = [
    ["arbitrary-shadow", /\bshadow-\[[^\]\r\n]+\]/gu],
    ["arbitrary-radius", /\brounded-\[[^\]\r\n]+\]/gu],
    ["arbitrary-duration", /\bduration-\[[^\]\r\n]+\]/gu],
    ["arbitrary-animation", /\banimate-\[[^\]\r\n]+\]/gu],
    ["arbitrary-tracking", /\btracking-\[[^\]\r\n]+\]/gu],
    ["transition-all", /\btransition-all\b/gu],
  ];
  for (const filename of files) {
    const source = readFileSync(filename, "utf8");
    const relative = relativePath(repositoryRoot, filename);
    const isCss = filename.endsWith(".css");
    for (const token of ["card", "input-field"] as const) {
      const count = isCss ? cssSelectorCount(source, `.${token}`) : classTokenCount(source, token);
      addOccurrence(
        occurrences,
        token === "card" ? "legacy-card" : "legacy-input-field",
        relative,
        `.${token}`,
        count,
      );
    }
    for (const [category, expression] of patterns) {
      for (const [value, count] of occurrencesForRegex(source, expression)) {
        addOccurrence(occurrences, category, relative, value, count);
      }
    }
  }
  return ([
    "legacy-card",
    "legacy-input-field",
    "arbitrary-shadow",
    "arbitrary-radius",
    "arbitrary-duration",
    "arbitrary-animation",
    "arbitrary-tracking",
    "transition-all",
  ] as const).map((category) => ({
    category,
    occurrences: [...(occurrences.get(category) ?? new Map<string, number>()).entries()]
      .map(([key, count]) => {
        const [filename, value] = key.split("\u0000");
        return { path: filename, value, count };
      })
      .sort(
        (left, right) =>
          compareOrdinal(left.path, right.path) || compareOrdinal(left.value, right.value),
      ),
  }));
}

function listCssFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listCssFiles(absolutePath));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(absolutePath);
  }
  return files.sort(compareOrdinal);
}

type BaseProvenance = Pick<LiveRouteComponentInventory["provenance"], "baseSha" | "baseReference">;

export function gitProvenance(repositoryRoot: string): BaseProvenance {
  const git = (arguments_: readonly string[]) =>
    execFileSync("git", arguments_, { cwd: repositoryRoot, encoding: "utf8" }).trim();
  return {
    baseSha: git(["merge-base", "HEAD", "origin/main"]),
    baseReference: "merge-base HEAD origin/main",
  };
}

export function buildLiveRouteComponentInventory(
  repositoryRoot: string,
  baseProvenance = gitProvenance(repositoryRoot),
): LiveRouteComponentInventory {
  const frontendRoot = path.join(repositoryRoot, "frontend");
  const appRoot = path.join(frontendRoot, "src", "app");
  const componentRoot = path.join(frontendRoot, "src", "components");
  const designSystemRoot = path.join(frontendRoot, "src", "design-system");
  const files = [...listFiles(appRoot), ...listFiles(componentRoot), ...listFiles(designSystemRoot)].sort(
    (left, right) => compareOrdinal(relativePath(repositoryRoot, left), relativePath(repositoryRoot, right)),
  );
  const productionFiles = new Set(files);
  const rawModules = files.map((filename) => {
    const source = readFileSync(filename, "utf8");
    return {
      filename,
      ...classifyModule(appRoot, designSystemRoot, filename),
      hasUseClientDirective: hasUseClientDirective(source),
      imports: directModuleImports(frontendRoot, filename, source, productionFiles),
    };
  });
  const consumers = new Map<string, Set<string>>();
  for (const sourceModule of rawModules) {
    for (const imported of sourceModule.imports) {
      const direct = consumers.get(imported) ?? new Set<string>();
      direct.add(sourceModule.filename);
      consumers.set(imported, direct);
    }
  }
  const modules = rawModules.map((sourceModule) => ({
    path: relativePath(repositoryRoot, sourceModule.filename),
    classification: sourceModule.classification,
    routeModuleKind: sourceModule.routeModuleKind,
    routePath: sourceModule.routePath,
    hasUseClientDirective: sourceModule.hasUseClientDirective,
    directModuleImports: sourceModule.imports.map((item) => relativePath(repositoryRoot, item)),
    directConsumers: [...(consumers.get(sourceModule.filename) ?? new Set<string>())]
      .map((item) => relativePath(repositoryRoot, item))
      .sort(compareOrdinal),
  }));
  const counts = {
    total: modules.length,
    "route-module": modules.filter((module) => module.classification === "route-module").length,
    "app-support-module": modules.filter((module) => module.classification === "app-support-module").length,
    "shared-component-module": modules.filter(
      (module) => module.classification === "shared-component-module",
    ).length,
    "design-system-module": modules.filter(
      (module) => module.classification === "design-system-module",
    ).length,
  } as const;
  const visualDebtRatchets = scanVisualDebt(repositoryRoot);
  const sourceFingerprint = createHash("sha256")
    .update(stableJson({ modules, visualDebtRatchets }), "utf8")
    .digest("hex");
  return {
    schemaVersion: 1,
    kind: "phase5a1a-live-route-component-inventory",
    provenance: { ...baseProvenance, sourceFingerprint },
    sourceRoots: [
      "frontend/src/app",
      "frontend/src/components",
      "frontend/src/design-system",
    ],
    moduleCounts: counts,
    modules,
    visualDebtRatchets,
  };
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort(compareOrdinal)
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function inventoryChecksum(inventory: LiveRouteComponentInventory): string {
  return createHash("sha256").update(stableJson(inventory), "utf8").digest("hex");
}

export function writeLiveRouteComponentInventory(
  repositoryRoot: string,
  inventory = buildLiveRouteComponentInventory(repositoryRoot),
): LiveRouteComponentInventory {
  const output = path.join(repositoryRoot, LIVE_INVENTORY_REPORT_RELATIVE_PATH);
  if (!statSync(path.dirname(output)).isDirectory()) throw new Error("live-inventory-output-parent-missing");
  writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  return inventory;
}

export function assertShrinkOnlyVisualDebt(
  baseline: readonly VisualDebtRatchet[],
  current: readonly VisualDebtRatchet[],
): void {
  const baselineCategories = new Map(baseline.map((item) => [item.category, item]));
  const currentCategories = new Map(current.map((item) => [item.category, item]));
  for (const category of currentCategories.keys()) {
    if (!baselineCategories.has(category)) throw new Error(`visual-debt-unclassified-category:${category}`);
  }
  for (const [category, baselineCategory] of baselineCategories) {
    const currentCategory = currentCategories.get(category);
    if (!currentCategory) throw new Error(`visual-debt-unclassified-category:${category}`);
    const maxima = new Map(
      baselineCategory.occurrences.map((item) => [`${item.path}\u0000${item.value}`, item.count]),
    );
    for (const item of currentCategory.occurrences) {
      const key = `${item.path}\u0000${item.value}`;
      const maximum = maxima.get(key);
      if (maximum === undefined) {
        throw new Error(`visual-debt-new-occurrence:${category}:${item.path}:${item.value}`);
      }
      if (item.count > maximum) {
        throw new Error(`visual-debt-count-increased:${category}:${item.path}:${item.value}`);
      }
    }
  }
}
