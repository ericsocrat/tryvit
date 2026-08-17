import {
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import path from "node:path";

const DEV_ROUTE_TYPES_IMPORT = 'import "./.next/dev/types/routes.d.ts";';
const BUILD_ROUTE_TYPES_IMPORT = 'import "./.next/types/routes.d.ts";';
const NEXT_BUILD_SOURCE_STATUS = " M frontend/next-env.d.ts";

function canonicalContents(routeTypesImport: string, eol: "\n" | "\r\n"): string {
  return [
    '/// <reference types="next" />',
    '/// <reference types="next/image-types/global" />',
    routeTypesImport,
    "",
    "// NOTE: This file should not be edited",
    "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
    "",
  ].join(eol);
}

export interface NextEnvSourceSnapshot {
  readonly frontendRoot: string;
  readonly sourceBytes: Buffer;
  readonly expectedBuildBytes: Buffer;
}

function fail(code: string): never {
  throw new Error(`[P5A2_EVIDENCE] ${code}`);
}

function comparable(candidate: string): string {
  const normalized = path.normalize(candidate);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function metadata(candidate: string): Stats {
  try {
    return lstatSync(candidate);
  } catch {
    fail("next-env-source-target-invalid");
  }
}

function expectedBuildBytes(sourceBytes: Buffer): Buffer {
  const contents = sourceBytes.toString("utf8");
  if (!Buffer.from(contents, "utf8").equals(sourceBytes)) {
    fail("next-env-source-encoding-invalid");
  }
  if (contents.replace(/\r\n?/gu, "\n") !== canonicalContents(DEV_ROUTE_TYPES_IMPORT, "\n")) {
    fail("next-env-source-contract-invalid");
  }
  const firstNewline = contents.indexOf("\n", 1);
  const generatedEol = firstNewline !== -1 && contents[firstNewline - 1] === "\r"
    ? "\r\n"
    : "\n";
  return Buffer.from(canonicalContents(BUILD_ROUTE_TYPES_IMPORT, generatedEol), "utf8");
}

function sourceFilename(frontendRoot: string): string {
  const root = path.resolve(frontendRoot);
  const rootEntry = metadata(root);
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    fail("next-env-source-root-invalid");
  }
  const resolvedRoot = realpathSync.native(root);
  if (comparable(resolvedRoot) !== comparable(root)) {
    fail("next-env-source-root-reparse");
  }
  const filename = path.join(resolvedRoot, "next-env.d.ts");
  const entry = metadata(filename);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("next-env-source-target-invalid");
  }
  const resolvedFilename = realpathSync.native(filename);
  if (
    comparable(path.dirname(resolvedFilename)) !== comparable(resolvedRoot) ||
    comparable(resolvedFilename) !== comparable(filename)
  ) {
    fail("next-env-source-target-reparse");
  }
  return resolvedFilename;
}

export function captureNextEnvSourceSnapshot(frontendRoot: string): NextEnvSourceSnapshot {
  const filename = sourceFilename(frontendRoot);
  const sourceBytes = readFileSync(filename);
  return {
    frontendRoot: path.dirname(filename),
    sourceBytes,
    expectedBuildBytes: expectedBuildBytes(sourceBytes),
  };
}

export function restoreNextEnvSourceSnapshot(
  snapshot: NextEnvSourceSnapshot,
  sourceStatus: () => string,
): "unchanged" | "restored" {
  const filename = sourceFilename(snapshot.frontendRoot);
  const currentBytes = readFileSync(filename);
  const currentStatus = sourceStatus();
  if (currentBytes.equals(snapshot.sourceBytes)) {
    if (currentStatus !== "") fail("source-worktree-mutated-during-review");
    return "unchanged";
  }
  if (
    currentStatus !== NEXT_BUILD_SOURCE_STATUS ||
    !currentBytes.equals(snapshot.expectedBuildBytes)
  ) {
    fail("next-env-source-mutation-unexpected");
  }

  writeFileSync(filename, snapshot.sourceBytes);
  const restoredFilename = sourceFilename(snapshot.frontendRoot);
  if (
    !readFileSync(restoredFilename).equals(snapshot.sourceBytes) ||
    sourceStatus() !== ""
  ) {
    fail("next-env-source-restore-invalid");
  }
  return "restored";
}

export function withNextEnvSourceRestoration<T>(
  snapshot: NextEnvSourceSnapshot,
  action: () => T,
  sourceStatus: () => string,
): T {
  try {
    return action();
  } finally {
    restoreNextEnvSourceSnapshot(snapshot, sourceStatus);
  }
}
