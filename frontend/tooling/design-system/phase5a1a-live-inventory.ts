import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  ftruncateSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import ts from "@typescript/typescript6";

const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;
const RESOLVABLE_LOCAL_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".json",
] as const;
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
  "route-module" | "app-support-module" | "shared-component-module" | "design-system-module";

export type RuntimeBoundary = "client-entry" | "client-reachable" | "server-only";

export type RedesignPhase =
  "5A.1a" | "5A.1b" | "5A.3" | "5B" | "5C.1" | "5C.2" | "5D" | "5E" | "5F";

export type ModuleDisposition = "migrate-to-v2" | "retain-v2" | "retain-behavior";

export type DesignSystemStatus = "v1" | "v2" | "mixed";

export type MigrationGate =
  | "already-v2-contract"
  | "phase-5a1b-entry-and-facade-verification"
  | "approved-5a2-golden-reference-and-authorized-phase-entry"
  | "behavior-regression-verification";

export type RemovalGate =
  | "replacement-or-route-removal-approved-and-zero-transitive-route-consumers"
  | "explicit-retirement-approval-and-behavior-consumers-migrated";

export interface RouteConsumer {
  readonly modulePath: string;
  readonly routeModuleKind: string;
  readonly routePath: string;
}

export interface ModuleLegacyDebt {
  readonly category: VisualDebtCategory;
  readonly occurrences: readonly Omit<VisualDebtOccurrence, "path">[];
}

export interface ProductionModule {
  readonly path: string;
  readonly classification: ModuleClassification;
  readonly routeModuleKind: string | null;
  readonly routePath: string | null;
  readonly hasUseClientDirective: boolean;
  readonly runtimeBoundary: RuntimeBoundary;
  readonly directModuleImports: readonly string[];
  readonly directConsumers: readonly string[];
  readonly transitiveRouteConsumers: readonly RouteConsumer[];
  readonly targetRedesignPhases: readonly RedesignPhase[];
  readonly disposition: ModuleDisposition;
  readonly migrationGate: MigrationGate;
  readonly removalGate: RemovalGate;
  readonly designSystemStatus: DesignSystemStatus;
  readonly classifiedLegacyDebt: readonly ModuleLegacyDebt[];
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

export interface RuntimeBoundaryViolation {
  readonly importer: string;
  readonly specifier: string;
  readonly resolvedPath: string;
  readonly forbiddenRoot: string;
}

export interface RuntimeBoundaryAudit {
  readonly scannedRoot: "frontend/src";
  readonly forbiddenRoots: readonly [
    "docs",
    "frontend/docs",
    "frontend/e2e",
    "frontend/tests",
    "frontend/tooling",
  ];
  readonly inspectedModuleCount: number;
  readonly violations: readonly RuntimeBoundaryViolation[];
  readonly sourceFingerprint: string;
}

export interface LiveRouteComponentInventory {
  readonly schemaVersion: 2;
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
  readonly moduleCounts: Readonly<Record<ModuleClassification, number>> & {
    readonly total: number;
  };
  readonly modules: readonly ProductionModule[];
  readonly visualDebtRatchets: readonly VisualDebtRatchet[];
  readonly runtimeBoundaryAudit: RuntimeBoundaryAudit;
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
    if (entry.isDirectory() && ["__tests__", "__mocks__"].includes(entry.name)) continue;
    if (entry.isDirectory()) files.push(...listFiles(absolutePath));
    else if (entry.isFile() && isProductionSource(entry.name)) files.push(absolutePath);
  }
  return files.sort(compareOrdinal);
}

function appRoutePath(appRoot: string, filename: string): string {
  const relative = path.relative(appRoot, filename);
  const segments = path
    .dirname(relative)
    .split(path.sep)
    .filter((segment) => Boolean(segment) && segment !== ".");
  const urlSegments = segments.filter(
    (segment) => !/^\(.+\)$/u.test(segment) && !segment.startsWith("@"),
  );
  return urlSegments.length === 0 ? "/" : `/${urlSegments.join("/")}`;
}

function classifyModule(
  appRoot: string,
  designSystemRoot: string,
  filename: string,
): {
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
  const file = ts.createSourceFile(
    "module.tsx",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

function sourceFile(source: string, filename: string): ts.SourceFile {
  const scriptKind = filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, false, scriptKind);
}

function isLiteralDynamicImport(node: ts.Node): node is ts.CallExpression & {
  arguments: ts.NodeArray<ts.StringLiteral>;
} {
  return (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  );
}

function isLiteralRequire(node: ts.Node): node is ts.CallExpression & {
  arguments: ts.NodeArray<ts.StringLiteral>;
} {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  );
}

function moduleSpecifiers(source: string, filename: string): string[] {
  const specifiers = new Set<string>();
  const file = sourceFile(source, filename);
  for (const statement of file.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.add(statement.moduleSpecifier.text);
    }
  }
  const visit = (node: ts.Node): void => {
    if (isLiteralDynamicImport(node) || isLiteralRequire(node)) {
      specifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...specifiers].sort(compareOrdinal);
}

function runtimeModuleSpecifiers(source: string, filename: string): string[] {
  const specifiers = new Set<string>();
  const file = sourceFile(source, filename);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const namedBindings = clause?.namedBindings;
      const hasRuntimeBinding =
        !clause ||
        (!clause.isTypeOnly &&
          (Boolean(clause.name) ||
            !namedBindings ||
            ts.isNamespaceImport(namedBindings) ||
            namedBindings.elements.some((element) => !element.isTypeOnly)));
      if (hasRuntimeBinding) specifiers.add(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause;
      const hasRuntimeBinding =
        !node.isTypeOnly &&
        (!clause ||
          ts.isNamespaceExport(clause) ||
          clause.elements.some((element) => !element.isTypeOnly));
      if (hasRuntimeBinding) specifiers.add(node.moduleSpecifier.text);
    } else if (isLiteralDynamicImport(node) || isLiteralRequire(node)) {
      specifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...specifiers].sort(compareOrdinal);
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function scanRuntimeBoundaryAudit(repositoryRoot: string): RuntimeBoundaryAudit {
  const frontendRoot = path.join(repositoryRoot, "frontend");
  const srcRoot = path.join(frontendRoot, "src");
  const forbiddenRoots = [
    ["docs", path.join(repositoryRoot, "docs")],
    ["frontend/docs", path.join(frontendRoot, "docs")],
    ["frontend/e2e", path.join(frontendRoot, "e2e")],
    ["frontend/tests", path.join(frontendRoot, "tests")],
    ["frontend/tooling", path.join(frontendRoot, "tooling")],
  ] as const;
  const files = listFiles(srcRoot);
  const inspectedEdges: { importer: string; specifier: string; resolvedPath: string | null }[] = [];
  const violations: RuntimeBoundaryViolation[] = [];
  for (const filename of files) {
    const importer = relativePath(repositoryRoot, filename);
    const source = readFileSync(filename, "utf8");
    for (const specifier of runtimeModuleSpecifiers(source, filename)) {
      const sourceStem = localImportStem(frontendRoot, filename, specifier);
      if (!sourceStem) continue;
      const resolved = resolveExistingLocalImport(frontendRoot, filename, specifier);
      inspectedEdges.push({
        importer,
        specifier,
        resolvedPath: resolved ? relativePath(repositoryRoot, resolved) : null,
      });
      if (!resolved) continue;
      for (const [forbiddenRoot, absoluteRoot] of forbiddenRoots) {
        if (!isWithin(absoluteRoot, resolved)) continue;
        violations.push({
          importer,
          specifier,
          resolvedPath: relativePath(repositoryRoot, resolved),
          forbiddenRoot,
        });
      }
    }
  }
  const orderedViolations = violations.sort(
    (left, right) =>
      compareOrdinal(left.importer, right.importer) ||
      compareOrdinal(left.specifier, right.specifier) ||
      compareOrdinal(left.resolvedPath, right.resolvedPath) ||
      compareOrdinal(left.forbiddenRoot, right.forbiddenRoot),
  );
  const sourceFingerprint = createHash("sha256")
    .update(
      stableJson({
        inspectedFiles: files.map((filename) => relativePath(repositoryRoot, filename)),
        inspectedEdges,
        violations: orderedViolations,
      }),
      "utf8",
    )
    .digest("hex");
  return {
    scannedRoot: "frontend/src",
    forbiddenRoots: ["docs", "frontend/docs", "frontend/e2e", "frontend/tests", "frontend/tooling"],
    inspectedModuleCount: files.length,
    violations: orderedViolations,
    sourceFingerprint,
  };
}

export function assertNoForbiddenRuntimeImports(audit: RuntimeBoundaryAudit): void {
  const violation = audit.violations[0];
  if (!violation) return;
  throw new Error(
    `forbidden-runtime-import:${violation.importer}:${violation.specifier}:${violation.resolvedPath}`,
  );
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
  candidates.push(
    ...SOURCE_EXTENSIONS.map((extension) => path.join(sourceStem, `index${extension}`)),
  );
  if (SOURCE_EXTENSIONS.some((extension) => sourceStem.endsWith(extension)))
    candidates.unshift(sourceStem);
  return candidates.find((candidate) => productionFiles.has(candidate)) ?? null;
}

function localImportStem(frontendRoot: string, importer: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return path.resolve(frontendRoot, "src", specifier.slice(2));
  }
  if (specifier.startsWith(".")) return path.resolve(path.dirname(importer), specifier);
  return null;
}

function resolveExistingLocalImport(
  frontendRoot: string,
  importer: string,
  specifier: string,
): string | null {
  const sourceStem = localImportStem(frontendRoot, importer, specifier);
  if (!sourceStem) return null;
  const candidates = [sourceStem];
  const sourceExtension = path.extname(sourceStem);
  if (!RESOLVABLE_LOCAL_EXTENSIONS.some((extension) => extension === sourceExtension)) {
    candidates.push(
      ...RESOLVABLE_LOCAL_EXTENSIONS.map((extension) => `${sourceStem}${extension}`),
      ...RESOLVABLE_LOCAL_EXTENSIONS.map((extension) => path.join(sourceStem, `index${extension}`)),
    );
  }
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  );
}

function directModuleImports(
  frontendRoot: string,
  filename: string,
  source: string,
  productionFiles: ReadonlySet<string>,
): string[] {
  const imports = new Set<string>();
  for (const specifier of moduleSpecifiers(source, filename)) {
    const resolved = resolveLocalImport(frontendRoot, filename, specifier, productionFiles);
    if (resolved) imports.add(resolved);
  }
  return [...imports].sort(compareOrdinal);
}

function runtimeDirectModuleImports(
  frontendRoot: string,
  filename: string,
  source: string,
  productionFiles: ReadonlySet<string>,
): string[] {
  const imports = new Set<string>();
  for (const specifier of runtimeModuleSpecifiers(source, filename)) {
    const resolved = resolveLocalImport(frontendRoot, filename, specifier, productionFiles);
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

function occurrencesForRegex(source: string, expression: RegExp): Map<string, number> {
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
  const files = listFiles(sourceRoot).concat(listCssFiles(sourceRoot)).sort(compareOrdinal);
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
  return (
    [
      "legacy-card",
      "legacy-input-field",
      "arbitrary-shadow",
      "arbitrary-radius",
      "arbitrary-duration",
      "arbitrary-animation",
      "arbitrary-tracking",
      "transition-all",
    ] as const
  ).map((category) => ({
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

interface RawProductionModule {
  readonly filename: string;
  readonly classification: ModuleClassification;
  readonly routeModuleKind: string | null;
  readonly routePath: string | null;
  readonly hasUseClientDirective: boolean;
  readonly imports: readonly string[];
  readonly runtimeImports: readonly string[];
}

export function gitProvenance(repositoryRoot: string): BaseProvenance {
  const git = (arguments_: readonly string[]) =>
    execFileSync("git", arguments_, { cwd: repositoryRoot, encoding: "utf8" }).trim();
  return {
    baseSha: git(["merge-base", "HEAD", "origin/main"]),
    baseReference: "merge-base HEAD origin/main",
  };
}

function transitiveRouteConsumers(
  repositoryRoot: string,
  sourceModule: RawProductionModule,
  modulesByFilename: ReadonlyMap<string, RawProductionModule>,
  consumers: ReadonlyMap<string, ReadonlySet<string>>,
): RouteConsumer[] {
  const routes = new Map<string, RouteConsumer>();
  const visited = new Set<string>();
  const pending = [sourceModule.filename];
  while (pending.length > 0) {
    const filename = pending.shift();
    if (!filename || visited.has(filename)) continue;
    visited.add(filename);
    const candidate = modulesByFilename.get(filename);
    if (
      candidate?.classification === "route-module" &&
      candidate.routeModuleKind &&
      candidate.routePath
    ) {
      const modulePath = relativePath(repositoryRoot, filename);
      routes.set(modulePath, {
        modulePath,
        routeModuleKind: candidate.routeModuleKind,
        routePath: candidate.routePath,
      });
    }
    pending.push(...[...(consumers.get(filename) ?? [])].sort(compareOrdinal));
  }
  return [...routes.values()].sort(
    (left, right) =>
      compareOrdinal(left.modulePath, right.modulePath) ||
      compareOrdinal(left.routePath, right.routePath) ||
      compareOrdinal(left.routeModuleKind, right.routeModuleKind),
  );
}

function routeRedesignPhase(route: RouteConsumer): RedesignPhase {
  const routePath = route.routePath;
  if (routePath === "/dev/components" || routePath.startsWith("/dev/components/")) return "5A.1b";
  if (routePath === "/api" || routePath.startsWith("/api/")) return "5F";
  if (routePath === "/onboarding" || routePath.startsWith("/onboarding/")) return "5D";
  if (!routePath.startsWith("/app")) return "5A.3";
  if (routePath === "/app") {
    return route.routeModuleKind === "page" ? "5D" : "5B";
  }
  if (routePath.startsWith("/app/admin")) return "5F";
  if (routePath.startsWith("/app/scan") || routePath.startsWith("/app/image-search")) return "5E";
  if (routePath.startsWith("/app/search/saved") || routePath.startsWith("/app/compare/saved")) {
    return "5D";
  }
  if (routePath.startsWith("/app/search") || routePath.startsWith("/app/categories")) {
    return "5C.1";
  }
  if (
    routePath.startsWith("/app/product") ||
    routePath.startsWith("/app/ingredient") ||
    routePath.startsWith("/app/compare")
  ) {
    return "5C.2";
  }
  return "5D";
}

function pathFallbackPhase(modulePath: string): RedesignPhase {
  if (modulePath.startsWith("frontend/src/app/dev/components/")) return "5A.1b";
  if (modulePath.startsWith("frontend/src/app/app/admin/")) return "5F";
  if (
    modulePath.startsWith("frontend/src/app/app/scan/") ||
    modulePath.startsWith("frontend/src/app/app/image-search/")
  ) {
    return "5E";
  }
  if (
    modulePath.startsWith("frontend/src/app/app/search/") ||
    modulePath.startsWith("frontend/src/app/app/categories/")
  ) {
    return "5C.1";
  }
  if (
    modulePath.startsWith("frontend/src/app/app/product/") ||
    modulePath.startsWith("frontend/src/app/app/ingredient/") ||
    modulePath.startsWith("frontend/src/app/app/compare/")
  ) {
    return "5C.2";
  }
  if (
    modulePath.startsWith("frontend/src/app/app/") ||
    modulePath.startsWith("frontend/src/app/onboarding/")
  ) {
    return "5D";
  }
  if (modulePath.startsWith("frontend/src/app/")) return "5A.3";
  return "5F";
}

function designSystemStatus(modulePath: string): DesignSystemStatus {
  if (modulePath.startsWith("frontend/src/design-system/")) return "v2";
  if (modulePath.startsWith("frontend/src/app/dev/components/")) return "mixed";
  return "v1";
}

function isBehaviorOnlyModule(sourceModule: RawProductionModule): boolean {
  if (sourceModule.routeModuleKind === "route") return true;
  return /\/(?:robots|sitemap|sw)\.tsx?$/u.test(toPosix(sourceModule.filename));
}

function governanceForModule(
  repositoryRoot: string,
  sourceModule: RawProductionModule,
  routes: readonly RouteConsumer[],
): Pick<
  ProductionModule,
  "targetRedesignPhases" | "disposition" | "migrationGate" | "removalGate" | "designSystemStatus"
> {
  const modulePath = relativePath(repositoryRoot, sourceModule.filename);
  const status = designSystemStatus(modulePath);
  const behaviorOnly = isBehaviorOnlyModule(sourceModule);
  let targetRedesignPhases: RedesignPhase[];
  if (status === "v2") targetRedesignPhases = ["5A.1a"];
  else if (
    modulePath.startsWith("frontend/src/components/common/") ||
    modulePath.startsWith("frontend/src/app/dev/components/")
  ) {
    targetRedesignPhases = ["5A.1b"];
  } else {
    targetRedesignPhases = [...new Set(routes.map(routeRedesignPhase))].sort(compareOrdinal);
    if (targetRedesignPhases.length === 0) targetRedesignPhases = [pathFallbackPhase(modulePath)];
  }

  const disposition: ModuleDisposition =
    status === "v2" ? "retain-v2" : behaviorOnly ? "retain-behavior" : "migrate-to-v2";
  const migrationGate: MigrationGate =
    disposition === "retain-v2"
      ? "already-v2-contract"
      : disposition === "retain-behavior"
        ? "behavior-regression-verification"
        : targetRedesignPhases.includes("5A.1b")
          ? "phase-5a1b-entry-and-facade-verification"
          : "approved-5a2-golden-reference-and-authorized-phase-entry";
  const removalGate: RemovalGate =
    disposition === "retain-behavior"
      ? "explicit-retirement-approval-and-behavior-consumers-migrated"
      : "replacement-or-route-removal-approved-and-zero-transitive-route-consumers";
  return {
    targetRedesignPhases,
    disposition,
    migrationGate,
    removalGate,
    designSystemStatus: status,
  };
}

function moduleLegacyDebt(
  modulePath: string,
  visualDebtRatchets: readonly VisualDebtRatchet[],
): ModuleLegacyDebt[] {
  return visualDebtRatchets.flatMap((ratchet) => {
    const occurrences = ratchet.occurrences
      .filter((occurrence) => occurrence.path === modulePath)
      .map(({ value, count }) => ({ value, count }));
    return occurrences.length === 0 ? [] : [{ category: ratchet.category, occurrences }];
  });
}

function clientReachableModules(rawModules: readonly RawProductionModule[]): ReadonlySet<string> {
  const modulesByFilename = new Map(rawModules.map((module) => [module.filename, module]));
  const reachable = new Set<string>();
  const pending = rawModules
    .filter((module) => module.hasUseClientDirective)
    .map((module) => module.filename)
    .sort(compareOrdinal);
  while (pending.length > 0) {
    const filename = pending.shift();
    if (!filename || reachable.has(filename)) continue;
    reachable.add(filename);
    const dependency = modulesByFilename.get(filename);
    if (dependency) pending.push(...dependency.runtimeImports);
  }
  return reachable;
}

export function buildLiveRouteComponentInventory(
  repositoryRoot: string,
  baseProvenance = gitProvenance(repositoryRoot),
): LiveRouteComponentInventory {
  const frontendRoot = path.join(repositoryRoot, "frontend");
  const srcRoot = path.join(frontendRoot, "src");
  const appRoot = path.join(frontendRoot, "src", "app");
  const componentRoot = path.join(frontendRoot, "src", "components");
  const designSystemRoot = path.join(frontendRoot, "src", "design-system");
  const inventoryFiles = [
    ...listFiles(appRoot),
    ...listFiles(componentRoot),
    ...listFiles(designSystemRoot),
  ].sort((left, right) =>
    compareOrdinal(relativePath(repositoryRoot, left), relativePath(repositoryRoot, right)),
  );
  const runtimeBoundaryAudit = scanRuntimeBoundaryAudit(repositoryRoot);
  assertNoForbiddenRuntimeImports(runtimeBoundaryAudit);
  const graphFiles = listFiles(srcRoot);
  const graphFileSet = new Set(graphFiles);
  const inventoryFileSet = new Set(inventoryFiles);
  const graphModules: RawProductionModule[] = graphFiles.map((filename) => {
    const source = readFileSync(filename, "utf8");
    return {
      filename,
      ...classifyModule(appRoot, designSystemRoot, filename),
      hasUseClientDirective: hasUseClientDirective(source),
      imports: directModuleImports(frontendRoot, filename, source, graphFileSet),
      runtimeImports: runtimeDirectModuleImports(frontendRoot, filename, source, graphFileSet),
    };
  });
  const rawModules = graphModules.filter((sourceModule) =>
    inventoryFileSet.has(sourceModule.filename),
  );
  const consumers = new Map<string, Set<string>>();
  for (const sourceModule of graphModules) {
    for (const imported of sourceModule.imports) {
      const direct = consumers.get(imported) ?? new Set<string>();
      direct.add(sourceModule.filename);
      consumers.set(imported, direct);
    }
  }
  const modulesByFilename = new Map(
    graphModules.map((sourceModule) => [sourceModule.filename, sourceModule]),
  );
  const clientReachable = clientReachableModules(graphModules);
  const visualDebtRatchets = scanVisualDebt(repositoryRoot);
  const modules = rawModules.map((sourceModule): ProductionModule => {
    const modulePath = relativePath(repositoryRoot, sourceModule.filename);
    const routes = transitiveRouteConsumers(
      repositoryRoot,
      sourceModule,
      modulesByFilename,
      consumers,
    );
    return {
      path: modulePath,
      classification: sourceModule.classification,
      routeModuleKind: sourceModule.routeModuleKind,
      routePath: sourceModule.routePath,
      hasUseClientDirective: sourceModule.hasUseClientDirective,
      runtimeBoundary: sourceModule.hasUseClientDirective
        ? "client-entry"
        : clientReachable.has(sourceModule.filename)
          ? "client-reachable"
          : "server-only",
      directModuleImports: sourceModule.imports.map((item) => relativePath(repositoryRoot, item)),
      directConsumers: [...(consumers.get(sourceModule.filename) ?? new Set<string>())]
        .map((item) => relativePath(repositoryRoot, item))
        .sort(compareOrdinal),
      transitiveRouteConsumers: routes,
      ...governanceForModule(repositoryRoot, sourceModule, routes),
      classifiedLegacyDebt: moduleLegacyDebt(modulePath, visualDebtRatchets),
    };
  });
  const counts = {
    total: modules.length,
    "route-module": modules.filter((module) => module.classification === "route-module").length,
    "app-support-module": modules.filter((module) => module.classification === "app-support-module")
      .length,
    "shared-component-module": modules.filter(
      (module) => module.classification === "shared-component-module",
    ).length,
    "design-system-module": modules.filter(
      (module) => module.classification === "design-system-module",
    ).length,
  } as const;
  const sourceFingerprint = createHash("sha256")
    .update(stableJson({ modules, visualDebtRatchets, runtimeBoundaryAudit }), "utf8")
    .digest("hex");
  return {
    schemaVersion: 2,
    kind: "phase5a1a-live-route-component-inventory",
    provenance: { ...baseProvenance, sourceFingerprint },
    sourceRoots: ["frontend/src/app", "frontend/src/components", "frontend/src/design-system"],
    moduleCounts: counts,
    modules,
    visualDebtRatchets,
    runtimeBoundaryAudit,
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
  if (!statSync(path.dirname(output)).isDirectory())
    throw new Error("live-inventory-output-parent-missing");
  const lock = `${output}.lock`;
  let lockDescriptor: number;
  try {
    lockDescriptor = openSync(lock, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("live-inventory-writer-locked");
    }
    throw error;
  }
  try {
    const descriptor = openSync(output, "r+");
    try {
      const baseline = JSON.parse(readFileSync(descriptor, "utf8")) as {
        readonly visualDebtRatchets?: unknown;
      };
      if (!Array.isArray(baseline.visualDebtRatchets)) {
        throw new Error("live-inventory-visual-debt-baseline-invalid");
      }
      assertShrinkOnlyVisualDebt(
        baseline.visualDebtRatchets as readonly VisualDebtRatchet[],
        inventory.visualDebtRatchets,
      );
      const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
      const bytes = Buffer.from(serialized, "utf8");
      ftruncateSync(descriptor, 0);
      let written = 0;
      while (written < bytes.length) {
        const count = writeSync(
          descriptor,
          bytes,
          written,
          bytes.length - written,
          written,
        );
        if (count <= 0) throw new Error("live-inventory-write-incomplete");
        written += count;
      }
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  } finally {
    try {
      closeSync(lockDescriptor);
    } finally {
      unlinkSync(lock);
    }
  }
  return inventory;
}

export function assertShrinkOnlyVisualDebt(
  baseline: readonly VisualDebtRatchet[],
  current: readonly VisualDebtRatchet[],
): void {
  const baselineCategories = new Map(baseline.map((item) => [item.category, item]));
  const currentCategories = new Map(current.map((item) => [item.category, item]));
  for (const category of currentCategories.keys()) {
    if (!baselineCategories.has(category))
      throw new Error(`visual-debt-unclassified-category:${category}`);
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
