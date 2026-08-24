import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

// Node executes this tooling directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import { GOLDEN_FONT_ASSAY, GOLDEN_TYPE_SCALE } from "../../../src/app/dev/phase5a2/_golden/font-assay.ts";

import {
  GOLDEN_ASSET_BOARDS,
  GOLDEN_CORE_STILLS,
  GOLDEN_DARK_ASSET_BOARDS,
  GOLDEN_FORCED_COLORS_STILLS,
  GOLDEN_FONT_TRANSFER_LIMIT_BYTES,
  GOLDEN_GERMAN_DESKTOP_STILLS,
  GOLDEN_JOURNEYS,
  GOLDEN_MAX_PNG_BYTES,
  GOLDEN_MAX_VIDEO_BYTES,
  GOLDEN_MOTION_RECORDINGS,
  GOLDEN_POLISH_MOBILE_STILLS,
  GOLDEN_REFERENCE_IDS,
  GOLDEN_STATE_CAPTURES,
  GOLDEN_VIDEO_MAX_DURATION_MS,
  GOLDEN_VIDEO_MIN_DURATION_MS,
  assetBoardRelativePath,
  coreStillRelativePath,
  darkAssetBoardRelativePath,
  forcedColorsStillRelativePath,
  goldenCandidateRoot,
  localizedStillRelativePath,
  motionRecordingRelativePath,
  motionTerminalStillRelativePath,
  stateStillRelativePath,
} from "./capture-contract.ts";
// Node executes this tooling directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import {
  assertOwnedDirectory,
  assertSafeDirectoryRoot,
  readOwnedRegularFile,
} from "../direction-selection/evidence-safety.ts";
// eslint-disable-next-line no-restricted-imports
import { verifyPlaywrightWebm } from "../direction-selection/webm-evidence.ts";

export interface VerifiedGoldenFile {
  readonly path: string;
  readonly kind: "still" | "state" | "board" | "video" | "terminal" | "runtime" | "journeys" | "performance" | "font-assay" | "resilience";
  readonly bytes: number;
  readonly sha256: string;
  readonly width?: number;
  readonly height?: number;
  readonly reference?: string;
  readonly state?: string;
  readonly locale?: string;
  readonly theme?: string;
  readonly motion?: string;
}

export interface VerifiedGoldenCandidates {
  readonly root: string;
  readonly runtime: Readonly<Record<string, unknown>>;
  readonly journeys: Readonly<Record<string, unknown>>;
  readonly performance: Readonly<Record<string, unknown>>;
  readonly fontAssay: Readonly<Record<string, unknown>>;
  readonly resilience: Readonly<Record<string, unknown>>;
  readonly files: readonly VerifiedGoldenFile[];
  readonly contents: ReadonlyMap<string, Buffer>;
}

function fail(code: string): never {
  throw new Error(`[P5A2_GOLDEN] ${code}`);
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function listFiles(root: string, directory = root): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail("candidate-entry-symlink");
    if (entry.isDirectory()) result.push(...listFiles(root, filename));
    else if (entry.isFile()) result.push(path.relative(root, filename).split(path.sep).join("/"));
    else fail("candidate-entry-invalid");
  }
  return result;
}

function parseJson(contents: Buffer, code: string): Readonly<Record<string, unknown>> {
  let value: unknown;
  try { value = JSON.parse(contents.toString("utf8")); } catch { fail(code); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Readonly<Record<string, unknown>>;
}

async function verifyPng(
  root: string,
  relativePath: string,
  width: number,
  height: number,
): Promise<{ contents: Buffer; bytes: number; sha256: string }> {
  const { contents } = readOwnedRegularFile(root, relativePath, "golden-png", GOLDEN_MAX_PNG_BYTES);
  if (contents.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail("png-signature-invalid");
  const metadata = await sharp(contents).metadata();
  if (metadata.width !== width || metadata.height !== height) fail("png-dimensions-invalid");
  return { contents, bytes: contents.length, sha256: sha256(contents) };
}

export async function verifyGoldenCandidates(frontendRoot = process.cwd()): Promise<VerifiedGoldenCandidates> {
  const safeFrontend = assertSafeDirectoryRoot(frontendRoot, "frontend-root");
  const root = assertOwnedDirectory(
    safeFrontend,
    ["test-results", "phase5a2-golden-candidates"],
    "golden-candidate-root",
  );
  if (root !== goldenCandidateRoot(safeFrontend)) fail("candidate-root-invalid");

  const pngs = [
    ...GOLDEN_CORE_STILLS.map((capture) => ({ path: coreStillRelativePath(capture), kind: "still" as const, ...capture })),
    ...GOLDEN_POLISH_MOBILE_STILLS.map((capture) => ({ path: localizedStillRelativePath(capture), kind: "still" as const, ...capture })),
    ...GOLDEN_GERMAN_DESKTOP_STILLS.map((capture) => ({ path: localizedStillRelativePath(capture), kind: "still" as const, ...capture })),
    ...GOLDEN_FORCED_COLORS_STILLS.map((capture) => ({ path: forcedColorsStillRelativePath(capture), kind: "still" as const, ...capture })),
    ...GOLDEN_STATE_CAPTURES.map((capture) => ({ path: stateStillRelativePath(capture), kind: "state" as const, ...capture })),
    ...GOLDEN_ASSET_BOARDS.map((board) => ({ path: assetBoardRelativePath(board), kind: "board" as const, width: 1440, height: 900, reference: board, state: "board", locale: "en", theme: "light", motion: "reduced" })),
    ...GOLDEN_DARK_ASSET_BOARDS.map((board) => ({ path: darkAssetBoardRelativePath(board), kind: "board" as const, width: 1440, height: 900, reference: board, state: "board", locale: "en", theme: "dark", motion: "reduced" })),
  ];
  const terminalPngs = GOLDEN_MOTION_RECORDINGS.map((capture) => ({
    path: motionTerminalStillRelativePath(capture),
    kind: "terminal" as const,
    width: capture.width,
    height: capture.height,
    recordingReference: capture.reference,
    mode: capture.mode,
    motion: capture.motion,
  }));
  const videos = GOLDEN_MOTION_RECORDINGS.map((capture) => ({
    path: motionRecordingRelativePath(capture),
    kind: "video" as const,
    ...capture,
  }));
  const expected = [
    ...pngs.map(({ path: filename }) => filename),
    ...terminalPngs.map(({ path: filename }) => filename),
    ...videos.map(({ path: filename }) => filename),
    "font-assay.json",
    "journeys.json",
    "performance.json",
    "resilience.json",
    "runtime.json",
  ].sort();
  if (JSON.stringify(listFiles(root).sort()) !== JSON.stringify(expected)) {
    fail("candidate-root-contents-invalid");
  }

  const contents = new Map<string, Buffer>();
  const files: VerifiedGoldenFile[] = [];
  for (const capture of pngs) {
    const verified = await verifyPng(root, capture.path, capture.width, capture.height);
    contents.set(capture.path, verified.contents);
    files.push({
      path: capture.path,
      kind: capture.kind,
      bytes: verified.bytes,
      sha256: verified.sha256,
      width: capture.width,
      height: capture.height,
      reference: capture.reference,
      state: capture.state,
      locale: capture.locale,
      theme: capture.theme,
      motion: capture.motion,
    });
  }
  for (const capture of videos) {
    const { contents: video } = readOwnedRegularFile(root, capture.path, "golden-video", GOLDEN_MAX_VIDEO_BYTES);
    verifyPlaywrightWebm(video, {
      expectedWidth: capture.width,
      expectedHeight: capture.height,
      minimumDurationMs: GOLDEN_VIDEO_MIN_DURATION_MS,
      maximumDurationMs: GOLDEN_VIDEO_MAX_DURATION_MS,
    });
    contents.set(capture.path, video);
    files.push({ path: capture.path, kind: "video", bytes: video.length, sha256: sha256(video), width: capture.width, height: capture.height, reference: capture.reference, state: capture.state, locale: capture.locale, theme: capture.theme, motion: capture.motion });
  }

  const runtimeContents = readOwnedRegularFile(root, "runtime.json", "golden-runtime", 64 * 1024).contents;
  const journeyContents = readOwnedRegularFile(root, "journeys.json", "golden-journeys", 256 * 1024).contents;
  const performanceContents = readOwnedRegularFile(root, "performance.json", "golden-performance", 2 * 1024 * 1024).contents;
  const fontAssayContents = readOwnedRegularFile(root, "font-assay.json", "golden-font-assay", 512 * 1024).contents;
  const resilienceContents = readOwnedRegularFile(root, "resilience.json", "golden-resilience", 512 * 1024).contents;
  const runtime = parseJson(runtimeContents, "runtime-format-invalid");
  const journeys = parseJson(journeyContents, "journeys-format-invalid");
  const performance = parseJson(performanceContents, "performance-format-invalid");
  const fontAssay = parseJson(fontAssayContents, "font-assay-format-invalid");
  const resilience = parseJson(resilienceContents, "resilience-format-invalid");
  if (
    runtime.schemaVersion !== 1 ||
    runtime.kind !== "phase5a2-golden-reference-runtime" ||
    runtime.sourceSha !== process.env.PHASE5A2_GOLDEN_SOURCE_SHA ||
    runtime.sourceTreeSha !== process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ||
    runtime.browserName !== "chromium" ||
    runtime.timezoneId !== "UTC" ||
    runtime.browserLocale !== "en-US"
  ) fail("runtime-contract-invalid");
  if (journeys.schemaVersion !== 1 || !Array.isArray(journeys.contracts) || !Array.isArray(journeys.actual) || journeys.actual.length !== 12) {
    fail("journeys-contract-invalid");
  }
  for (const [index, capture] of GOLDEN_MOTION_RECORDINGS.entries()) {
    const contract = GOLDEN_JOURNEYS.find(({ reference }) => reference === capture.reference);
    const actual = journeys.actual[index];
    if (!contract || !actual || typeof actual !== "object" || Array.isArray(actual)) {
      fail("journey-terminal-invalid");
    }
    const record = actual as Record<string, unknown>;
    const expectedAnnouncement = contract.terminal.announcement;
    const announcementValid = expectedAnnouncement === "none"
      ? record.announcement === null
      : typeof record.announcement === "string" && record.announcement.includes(expectedAnnouncement);
    if (
      record.recordingReference !== capture.reference ||
      record.mode !== capture.mode ||
      record.reference !== contract.terminal.reference ||
      record.liveState !== contract.terminal.state ||
      record.focus !== contract.terminal.focus ||
      typeof record.route !== "string" ||
      !record.route.startsWith(`/dev/phase5a2/golden/${contract.terminal.reference}?`) ||
      !announcementValid
    ) {
      fail("journey-terminal-invalid");
    }
    const terminal = terminalPngs[index];
    if (
      !terminal ||
      typeof record.reference !== "string" ||
      typeof record.liveState !== "string" ||
      (record.theme !== "light" && record.theme !== "dark")
    ) fail("journey-terminal-metadata-invalid");
    const terminalRoute = new URL(record.route as string, "http://golden.invalid");
    const locale = terminalRoute.searchParams.get("locale");
    if (locale !== "en" && locale !== "pl" && locale !== "de") {
      fail("journey-terminal-metadata-invalid");
    }
    const verifiedTerminal = await verifyPng(
      root,
      terminal.path,
      terminal.width,
      terminal.height,
    );
    contents.set(terminal.path, verifiedTerminal.contents);
    files.push({
      path: terminal.path,
      kind: terminal.kind,
      bytes: verifiedTerminal.bytes,
      sha256: verifiedTerminal.sha256,
      width: terminal.width,
      height: terminal.height,
      reference: record.reference,
      state: record.liveState,
      locale,
      theme: record.theme,
      motion: terminal.motion,
    });
  }
  if (
    performance.schemaVersion !== 1 ||
    performance.kind !== "phase5a2-golden-reference-performance" ||
    performance.reviewOnly !== true ||
    performance.productionCoreWebVitals !== false ||
    performance.sourceSha !== process.env.PHASE5A2_GOLDEN_SOURCE_SHA ||
    performance.sourceTreeSha !== process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ||
    !Array.isArray(performance.attempts) ||
    performance.attempts.length !== GOLDEN_REFERENCE_IDS.length * 5 ||
    !Array.isArray(performance.summaries) ||
    performance.summaries.length !== GOLDEN_REFERENCE_IDS.length ||
    !Array.isArray(performance.failures) ||
    performance.failures.length !== 0
  ) fail("performance-contract-invalid");
  if (
    fontAssay.schemaVersion !== 1 ||
    fontAssay.kind !== "phase5a2-golden-font-assay" ||
    fontAssay.sourceSha !== process.env.PHASE5A2_GOLDEN_SOURCE_SHA ||
    fontAssay.sourceTreeSha !== process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ||
    fontAssay.reviewOnly !== true ||
    fontAssay.productionAdoption !== false ||
    fontAssay.status !== GOLDEN_FONT_ASSAY.status ||
    fontAssay.transferLimitBytes !== GOLDEN_FONT_ASSAY.transferLimitBytes ||
    fontAssay.transferredBytes !== GOLDEN_FONT_ASSAY.transferBytes ||
    typeof fontAssay.fallbackCls !== "number" ||
    fontAssay.fallbackCls > 0.01 ||
    typeof fontAssay.tabularDigitWidthRangePx !== "number" ||
    fontAssay.tabularDigitWidthRangePx > 0.05 ||
    !Array.isArray(fontAssay.files) ||
    fontAssay.files.length !== GOLDEN_FONT_ASSAY.files.length ||
    !Array.isArray(fontAssay.computedTypeScale) ||
    fontAssay.computedTypeScale.length !== Object.keys(GOLDEN_TYPE_SCALE).length * 2
  ) fail("font-assay-contract-invalid");
  const expectedTypeScale = new Map(
    (["control", "candidate"] as const).flatMap((scope) =>
      Object.entries(GOLDEN_TYPE_SCALE).map(([name, pixels]) => [`${scope}-${name}`, pixels] as const),
    ),
  );
  for (const value of fontAssay.computedTypeScale as unknown[]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("font-assay-type-scale-invalid");
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.specimen !== "string" ||
      record.computedSize !== expectedTypeScale.get(record.specimen)
    ) fail("font-assay-type-scale-invalid");
  }
  if (
    resilience.schemaVersion !== 1 ||
    resilience.kind !== "phase5a2-golden-resilience-evidence" ||
    resilience.sourceSha !== process.env.PHASE5A2_GOLDEN_SOURCE_SHA ||
    resilience.sourceTreeSha !== process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ||
    resilience.reviewOnly !== true ||
    !Array.isArray(resilience.textSpacing) ||
    resilience.textSpacing.length !== GOLDEN_REFERENCE_IDS.length ||
    !Array.isArray(resilience.reflow) ||
    resilience.reflow.length !== GOLDEN_REFERENCE_IDS.length ||
    !Array.isArray(resilience.typography) ||
    resilience.typography.length !== 4
  ) fail("resilience-contract-invalid");
  for (const value of [...resilience.textSpacing, ...resilience.reflow] as unknown[]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("resilience-geometry-invalid");
    }
    const record = value as Record<string, unknown>;
    const overflow = "overflow" in record ? record.overflow : record.documentOverflow;
    if (typeof overflow !== "number" || overflow > 1) fail("resilience-geometry-invalid");
  }
  for (const [index, reference] of GOLDEN_REFERENCE_IDS.entries()) {
    const candidate = performance.summaries[index];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      fail("performance-summary-invalid");
    }
    const record = candidate as Record<string, unknown>;
    const font = record.fontBytes;
    if (
      record.reference !== reference ||
      record.status !== "complete" ||
      !font ||
      typeof font !== "object" ||
      Array.isArray(font) ||
      typeof (font as Record<string, unknown>).median !== "number" ||
      ((font as Record<string, unknown>).median as number) > GOLDEN_FONT_TRANSFER_LIMIT_BYTES
    ) fail("performance-summary-invalid");
  }
  contents.set("runtime.json", runtimeContents);
  contents.set("journeys.json", journeyContents);
  contents.set("performance.json", performanceContents);
  contents.set("font-assay.json", fontAssayContents);
  contents.set("resilience.json", resilienceContents);
  files.push({ path: "runtime.json", kind: "runtime", bytes: runtimeContents.length, sha256: sha256(runtimeContents) });
  files.push({ path: "journeys.json", kind: "journeys", bytes: journeyContents.length, sha256: sha256(journeyContents) });
  files.push({ path: "performance.json", kind: "performance", bytes: performanceContents.length, sha256: sha256(performanceContents) });
  files.push({ path: "font-assay.json", kind: "font-assay", bytes: fontAssayContents.length, sha256: sha256(fontAssayContents) });
  files.push({ path: "resilience.json", kind: "resilience", bytes: resilienceContents.length, sha256: sha256(resilienceContents) });
  return { root, runtime, journeys, performance, fontAssay, resilience, files, contents };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyGoldenCandidates();
  process.stdout.write("Phase 5A.2 Golden Reference candidates verified.\n");
}
