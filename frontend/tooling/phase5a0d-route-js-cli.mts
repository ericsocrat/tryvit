import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import {
  combineModeReports,
  compareRouteJsModeReports,
  compareRouteJsReports,
  compileModeReport,
  formatKiB,
  formatRouteJsComparisonMarkdown,
} from "./phase5a0d-route-js.ts";

function fail(code: string): never {
  throw new Error(`[P5_BUNDLE] ${code}`);
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const workingRoot = path.resolve(process.cwd());
const lexicalReportsRoot = path.join(workingRoot, "performance-reports");
const reportsRoot = path.join(realpathSync.native(workingRoot), "performance-reports");

function comparablePath(value: string): string {
  const withoutWindowsDevicePrefix =
    process.platform === "win32" && value.startsWith("\\\\?\\UNC\\")
      ? `\\\\${value.slice(8)}`
      : process.platform === "win32" && value.startsWith("\\\\?\\")
        ? value.slice(4)
        : value;
  const normalized = path.normalize(withoutWindowsDevicePrefix);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isExactRealPath(value: string): boolean {
  return comparablePath(realpathSync.native(value)) === comparablePath(value);
}

function assertReportsRoot(): void {
  const workingMetadata = lstatSync(workingRoot);
  if (!workingMetadata.isDirectory() || workingMetadata.isSymbolicLink()) {
    fail("working-directory-reparse");
  }
  if (!existsSync(reportsRoot)) {
    mkdirSync(reportsRoot);
  }
  const metadata = lstatSync(reportsRoot);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || !isExactRealPath(reportsRoot)) {
    fail("reports-root-reparse");
  }
}

function ownedPath(candidate: string, label: string): string {
  assertReportsRoot();
  const lexicalResolved = path.resolve(workingRoot, candidate);
  const relative = path.relative(lexicalReportsRoot, lexicalResolved);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail(`${label}-path-not-owned`);
  }
  const resolved = path.join(reportsRoot, relative);
  const parentRelative = path.relative(reportsRoot, path.dirname(resolved));
  let cursor = reportsRoot;
  for (const segment of parentRelative === "" ? [] : parentRelative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) continue;
    const metadata = lstatSync(cursor);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !isExactRealPath(cursor)) {
      fail(`${label}-path-reparse`);
    }
  }
  return resolved;
}

function ensureOwnedParent(resolved: string, label: string): void {
  const relative = path.relative(reportsRoot, path.dirname(resolved));
  let cursor = reportsRoot;
  for (const segment of relative === "" ? [] : relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) mkdirSync(cursor);
    const metadata = lstatSync(cursor);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !isExactRealPath(cursor)) {
      fail(`${label}-path-reparse`);
    }
  }
}

function ownedInputFile(candidate: string, label: string): string {
  const resolved = ownedPath(candidate, label);
  if (
    !existsSync(resolved) ||
    !lstatSync(resolved).isFile() ||
    lstatSync(resolved).isSymbolicLink() ||
    !isExactRealPath(resolved)
  ) {
    fail(`${label}-file-invalid`);
  }
  return resolved;
}

function ownedOutputFile(candidate: string, label: string, extension: ".json" | ".md"): string {
  const resolved = ownedPath(candidate, label);
  if (!resolved.endsWith(extension)) fail(`${label}-extension-invalid`);
  const parent = path.dirname(resolved);
  ensureOwnedParent(resolved, label);
  if (
    !lstatSync(parent).isDirectory() ||
    lstatSync(parent).isSymbolicLink() ||
    !isExactRealPath(parent) ||
    (existsSync(resolved) &&
      (!lstatSync(resolved).isFile() ||
        lstatSync(resolved).isSymbolicLink() ||
        !isExactRealPath(resolved)))
  ) {
    fail(`${label}-path-reparse`);
  }
  return resolved;
}

function assertKnownArguments(args: readonly string[], names: readonly string[]): void {
  const prefixes = names.map((name) => `--${name}=`);
  const receivedNames = args.map((argument) => argument.slice(0, argument.indexOf("=")));
  if (
    args.length !== names.length ||
    args.some(
      (argument) =>
        !prefixes.some((prefix) => argument.startsWith(prefix)) || argument.indexOf("=") <= 2,
    ) ||
    new Set(receivedNames).size !== receivedNames.length
  ) {
    fail("arguments-invalid");
  }
}

function readJsonFileNoFollow(file: string, label: string): unknown {
  let descriptor: number | undefined;
  let source: string;
  try {
    const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
    descriptor = openSync(file, constants.O_RDONLY | noFollow);
    const descriptorMetadata = fstatSync(descriptor, { bigint: true });
    const pathMetadata = lstatSync(file, { bigint: true });
    if (
      !descriptorMetadata.isFile() ||
      !pathMetadata.isFile() ||
      pathMetadata.isSymbolicLink() ||
      descriptorMetadata.dev !== pathMetadata.dev ||
      descriptorMetadata.ino !== pathMetadata.ino ||
      !isExactRealPath(file)
    ) {
      fail(`${label}-file-reparse`);
    }
    source = readFileSync(descriptor, "utf8");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[P5_BUNDLE]")) throw error;
    fail(`${label}-file-invalid`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  try {
    return JSON.parse(source);
  } catch {
    fail(`${label}-json-invalid`);
  }
}

function readJsonFiles(directory: string): unknown[] {
  if (
    !existsSync(directory) ||
    !lstatSync(directory).isDirectory() ||
    lstatSync(directory).isSymbolicLink() ||
    !isExactRealPath(directory)
  ) {
    fail("capture-directory-missing");
  }
  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".json"))
    .sort()
    .map((filename) => {
      const file = path.join(directory, filename);
      return readJsonFileNoFollow(file, "capture");
    });
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "compile-mode") {
    assertKnownArguments(args, ["mode", "capture-directory", "output"]);
    const mode = argumentValue(args, "mode");
    const captureDirectory = argumentValue(args, "capture-directory");
    const output = argumentValue(args, "output");
    if ((mode !== "public" && mode !== "local-authenticated") || !captureDirectory || !output) {
      fail("compile-mode-arguments-required");
    }
    const report = compileModeReport(
      readJsonFiles(ownedPath(captureDirectory, "capture-directory")),
      mode,
    );
    writeFileSync(
      ownedOutputFile(output, "mode-output", ".json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    return 0;
  }
  if (command === "combine") {
    assertKnownArguments(args, ["public", "local-authenticated", "output"]);
    const publicPath = argumentValue(args, "public");
    const authenticatedPath = argumentValue(args, "local-authenticated");
    const output = argumentValue(args, "output");
    if (!publicPath || !authenticatedPath || !output) fail("combine-arguments-required");
    const report = combineModeReports([
      readJsonFileNoFollow(ownedInputFile(publicPath, "public-input"), "public-input"),
      readJsonFileNoFollow(
        ownedInputFile(authenticatedPath, "authenticated-input"),
        "authenticated-input",
      ),
    ]);
    writeFileSync(
      ownedOutputFile(output, "combined-output", ".json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    for (const route of report.routes) {
      console.log(
        `${route.label}: total=${formatKiB(route.gzipBytes)} shared=${formatKiB(route.sharedGzipBytes)} route-owned=${formatKiB(route.routeOwnedGzipBytes)}`,
      );
    }
    console.log(`Report checksum: ${report.reportChecksum}`);
    return 0;
  }
  if (command === "compare") {
    assertKnownArguments(args, ["baseline", "current", "markdown"]);
    const baselinePath = argumentValue(args, "baseline");
    const currentPath = argumentValue(args, "current");
    const markdownPath = argumentValue(args, "markdown");
    if (!baselinePath || !currentPath || !markdownPath) fail("compare-inputs-required");
    const comparison = compareRouteJsReports(
      readJsonFileNoFollow(ownedInputFile(baselinePath, "baseline-input"), "baseline-input"),
      readJsonFileNoFollow(ownedInputFile(currentPath, "current-input"), "current-input"),
    );
    const markdown = formatRouteJsComparisonMarkdown(comparison);
    writeFileSync(ownedOutputFile(markdownPath, "markdown-output", ".md"), markdown, "utf8");
    console.log(markdown);
    return comparison.failed ? 1 : 0;
  }
  if (command === "compare-mode") {
    assertKnownArguments(args, ["baseline", "current", "markdown"]);
    const baselinePath = argumentValue(args, "baseline");
    const currentPath = argumentValue(args, "current");
    const markdownPath = argumentValue(args, "markdown");
    if (!baselinePath || !currentPath || !markdownPath) fail("compare-inputs-required");
    const comparison = compareRouteJsModeReports(
      readJsonFileNoFollow(ownedInputFile(baselinePath, "baseline-input"), "baseline-input"),
      readJsonFileNoFollow(ownedInputFile(currentPath, "current-input"), "current-input"),
    );
    const markdown = formatRouteJsComparisonMarkdown(comparison);
    writeFileSync(ownedOutputFile(markdownPath, "markdown-output", ".md"), markdown, "utf8");
    console.log(markdown);
    return comparison.failed ? 1 : 0;
  }
  fail("command-unrecognized");
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "[P5_BUNDLE] unknown-failure");
    process.exitCode = 1;
  });
