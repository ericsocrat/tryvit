import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import path from "node:path";

function fail(code: string, reason: string): never {
  throw new Error(`[P5A2_EVIDENCE] ${code}-${reason}`);
}

function comparable(candidate: string): string {
  const normalized = path.normalize(candidate).replace(/[\\/]+$/u, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function metadata(candidate: string): Stats | undefined {
  try {
    return lstatSync(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function assertSimpleSegments(segments: readonly string[], code: string): void {
  if (segments.length === 0) fail(code, "path-empty");
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\")
    ) {
      fail(code, "path-invalid");
    }
  }
}

function assertNoReparseSegments(candidate: string, code: string): void {
  const lexical = path.resolve(candidate);
  const parsed = path.parse(lexical);
  let cursor = parsed.root;
  for (const segment of path.relative(parsed.root, lexical).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    const entry = metadata(cursor);
    if (entry?.isSymbolicLink()) fail(code, "reparse");
  }
}

export function assertSafeDirectoryRoot(candidate: string, code: string): string {
  const lexical = path.resolve(candidate);
  assertNoReparseSegments(lexical, code);
  const entry = metadata(lexical);
  if (!entry || !entry.isDirectory() || entry.isSymbolicLink()) {
    fail(code, "directory-invalid");
  }
  const resolved = realpathSync.native(lexical);
  if (comparable(resolved) !== comparable(lexical)) fail(code, "reparse");
  return resolved;
}

function ownedDirectory(
  workspaceRoot: string,
  segments: readonly string[],
  code: string,
  create: boolean,
): string {
  assertSimpleSegments(segments, code);
  const root = assertSafeDirectoryRoot(workspaceRoot, `${code}-root`);
  let cursor = root;
  for (const segment of segments) {
    const candidate = path.join(cursor, segment);
    let entry = metadata(candidate);
    if (!entry && create) {
      mkdirSync(candidate);
      entry = metadata(candidate);
    }
    if (!entry || !entry.isDirectory() || entry.isSymbolicLink()) {
      fail(code, "directory-invalid");
    }
    const resolved = realpathSync.native(candidate);
    if (
      !isWithin(root, resolved) ||
      comparable(resolved) !== comparable(candidate)
    ) {
      fail(code, "reparse");
    }
    cursor = resolved;
  }
  return cursor;
}

export function ensureOwnedDirectory(
  workspaceRoot: string,
  segments: readonly string[],
  code: string,
): string {
  return ownedDirectory(workspaceRoot, segments, code, true);
}

export function assertOwnedDirectory(
  workspaceRoot: string,
  segments: readonly string[],
  code: string,
): string {
  return ownedDirectory(workspaceRoot, segments, code, false);
}

function relativeSegments(relativePath: string, code: string): string[] {
  if (path.isAbsolute(relativePath)) fail(code, "path-invalid");
  const segments = relativePath.split("/");
  assertSimpleSegments(segments, code);
  return segments;
}

export function prepareOwnedFileTarget(
  rootDirectory: string,
  relativePath: string,
  code: string,
): string {
  const segments = relativeSegments(relativePath, code);
  const root = assertSafeDirectoryRoot(rootDirectory, `${code}-root`);
  const parent = segments.length === 1
    ? root
    : ensureOwnedDirectory(root, segments.slice(0, -1), `${code}-parent`);
  const target = path.join(parent, segments.at(-1) as string);
  if (!isWithin(root, target)) fail(code, "path-invalid");
  const entry = metadata(target);
  if (entry) {
    if (entry.isSymbolicLink() || !entry.isFile()) fail(code, "target-invalid");
    const resolved = realpathSync.native(target);
    if (!isWithin(root, resolved) || comparable(resolved) !== comparable(target)) {
      fail(code, "reparse");
    }
    fail(code, "target-exists");
  }
  return target;
}

export function assertOwnedRegularFile(
  rootDirectory: string,
  relativePath: string,
  code: string,
): string {
  const segments = relativeSegments(relativePath, code);
  const root = assertSafeDirectoryRoot(rootDirectory, `${code}-root`);
  const parent = segments.length === 1
    ? root
    : assertOwnedDirectory(root, segments.slice(0, -1), `${code}-parent`);
  const target = path.join(parent, segments.at(-1) as string);
  if (!isWithin(root, target)) fail(code, "path-invalid");
  const entry = metadata(target);
  if (!entry) fail(code, "target-missing");
  if (entry.isSymbolicLink() || !entry.isFile()) fail(code, "target-invalid");
  const resolved = realpathSync.native(target);
  if (!isWithin(root, resolved) || comparable(resolved) !== comparable(target)) {
    fail(code, "reparse");
  }
  return target;
}

export interface OwnedRegularFileSnapshot {
  readonly contents: Buffer;
}

function sameFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode
  );
}

function sameFileSnapshot(left: BigIntStats, right: BigIntStats): boolean {
  return (
    sameFileIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function canonicalRegularFileSnapshot(
  root: string,
  target: string,
  code: string,
): BigIntStats {
  let resolved: string;
  try {
    resolved = realpathSync.native(target);
  } catch {
    fail(code, "target-raced");
  }
  if (!isWithin(root, resolved) || comparable(resolved) !== comparable(target)) {
    fail(code, "reparse");
  }

  let entry: BigIntStats;
  try {
    entry = lstatSync(resolved, { bigint: true });
  } catch {
    fail(code, "target-raced");
  }
  if (entry.isSymbolicLink() || !entry.isFile()) fail(code, "target-raced");
  return entry;
}

export function readOwnedRegularFile(
  rootDirectory: string,
  relativePath: string,
  code: string,
  maximumBytes = Number.MAX_SAFE_INTEGER,
): OwnedRegularFileSnapshot {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    fail(code, "size-limit-invalid");
  }
  const segments = relativeSegments(relativePath, code);
  const root = assertSafeDirectoryRoot(rootDirectory, `${code}-root`);
  const parent = segments.length === 1
    ? root
    : assertOwnedDirectory(root, segments.slice(0, -1), `${code}-parent`);
  const target = path.join(parent, segments.at(-1) as string);
  if (!isWithin(root, target)) fail(code, "path-invalid");

  let descriptor: number;
  try {
    const noFollow = typeof fsConstants.O_NOFOLLOW === "number"
      ? fsConstants.O_NOFOLLOW
      : 0;
    descriptor = openSync(target, fsConstants.O_RDONLY | noFollow);
  } catch {
    fail(code, "target-unreadable");
  }

  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || opened.size > BigInt(maximumBytes)) {
      fail(code, "target-invalid");
    }

    const entry = canonicalRegularFileSnapshot(root, target, code);
    if (!sameFileSnapshot(opened, entry)) {
      fail(code, "target-raced");
    }

    const expectedBytes = Number(opened.size);
    const contents = Buffer.alloc(expectedBytes);
    let offset = 0;
    while (offset < expectedBytes) {
      const bytesRead = readSync(
        descriptor,
        contents,
        offset,
        expectedBytes - offset,
        offset,
      );
      if (bytesRead === 0) fail(code, "target-raced");
      offset += bytesRead;
    }
    if (readSync(descriptor, Buffer.alloc(1), 0, 1, expectedBytes) !== 0) {
      fail(code, "target-raced");
    }
    const completed = fstatSync(descriptor, { bigint: true });
    const finalEntry = canonicalRegularFileSnapshot(root, target, code);
    if (
      !sameFileSnapshot(opened, completed) ||
      !sameFileSnapshot(completed, finalEntry) ||
      BigInt(contents.length) !== completed.size ||
      contents.length > maximumBytes
    ) {
      fail(code, "target-raced");
    }
    return { contents };
  } finally {
    closeSync(descriptor);
  }
}

export function assertOwnedPathAbsent(
  rootDirectory: string,
  segments: readonly string[],
  code: string,
): string {
  assertSimpleSegments(segments, code);
  const root = assertSafeDirectoryRoot(rootDirectory, `${code}-root`);
  const parent = segments.length === 1
    ? root
    : ensureOwnedDirectory(root, segments.slice(0, -1), `${code}-parent`);
  const target = path.join(parent, segments.at(-1) as string);
  if (!isWithin(root, target)) fail(code, "path-invalid");
  if (metadata(target)) fail(code, "target-exists");
  return target;
}

export function removeOwnedDirectory(
  workspaceRoot: string,
  segments: readonly string[],
  code: string,
): boolean {
  assertSimpleSegments(segments, code);
  const root = assertSafeDirectoryRoot(workspaceRoot, `${code}-root`);
  const parentSegments = segments.slice(0, -1);
  const parent = parentSegments.length === 0
    ? root
    : assertOwnedDirectory(root, parentSegments, `${code}-parent`);
  const target = path.join(parent, segments.at(-1) as string);
  const entry = metadata(target);
  if (!entry) return false;
  if (!entry.isDirectory() || entry.isSymbolicLink()) fail(code, "target-invalid");
  const resolved = realpathSync.native(target);
  if (
    !isWithin(root, resolved) ||
    comparable(resolved) !== comparable(target) ||
    comparable(resolved) === comparable(root)
  ) {
    fail(code, "target-unproven");
  }
  rmSync(resolved, { recursive: true, force: false });
  if (existsSync(resolved)) fail(code, "cleanup-incomplete");
  return true;
}

export function publishOwnedDirectory(
  parentDirectory: string,
  stageBasename: string,
  destinationBasename: string,
  code: string,
): string {
  assertSimpleSegments([stageBasename, destinationBasename], code);
  const parent = assertSafeDirectoryRoot(parentDirectory, `${code}-parent`);
  const stage = assertOwnedDirectory(parent, [stageBasename], `${code}-stage`);
  const destination = assertOwnedPathAbsent(
    parent,
    [destinationBasename],
    `${code}-destination`,
  );
  renameSync(stage, destination);
  return assertOwnedDirectory(parent, [destinationBasename], `${code}-published`);
}

export function sha256CanonicalLf(filename: string): string {
  const canonical = readFileSync(filename, "utf8").replace(/\r\n?/gu, "\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
