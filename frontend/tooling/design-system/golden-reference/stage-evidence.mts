import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  GOLDEN_COMMITTED_BINARY_LIMIT_BYTES,
  GOLDEN_REFERENCE_IDS,
  goldenEvidenceRoot,
  stateContactSheetRelativePath,
} from "./capture-contract.ts";
// Node executes this tooling directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import {
  assertOwnedDirectory,
  assertOwnedPathAbsent,
  assertSafeDirectoryRoot,
  ensureOwnedDirectory,
  prepareOwnedFileTarget,
  publishOwnedDirectory,
  removeOwnedDirectory,
  sha256CanonicalLf,
} from "../direction-selection/evidence-safety.ts";
import { verifyGoldenCandidates, type VerifiedGoldenFile } from "./verify-candidates.mts";

interface StagedFile {
  readonly path: string;
  readonly kind: string;
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

function fail(code: string): never {
  throw new Error(`[P5A2_GOLDEN] ${code}`);
}

function sha256(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function outputPath(root: string, relativePath: string): string {
  return prepareOwnedFileTarget(root, relativePath, "golden-stage-output");
}

function copyVerified(
  stageRoot: string,
  file: VerifiedGoldenFile,
  contents: Buffer,
): StagedFile {
  if (contents.length !== file.bytes || sha256(contents) !== file.sha256) {
    fail("candidate-copy-snapshot-invalid");
  }
  writeFileSync(outputPath(stageRoot, file.path), contents, { flag: "wx", mode: 0o600 });
  return { ...file };
}

function labelSvg(label: string, width: number, height: number): Buffer {
  const escaped = label.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#17271f"/><text x="12" y="22" fill="#fffaf0" font-family="Arial,sans-serif" font-size="14" font-weight="700">${escaped}</text></svg>`,
    "utf8",
  );
}

async function createStateContactSheet(
  stageRoot: string,
  candidateContents: ReadonlyMap<string, Buffer>,
  files: readonly VerifiedGoldenFile[],
  reference: (typeof GOLDEN_REFERENCE_IDS)[number],
): Promise<StagedFile> {
  const states = files.filter((file) => file.kind === "state" && file.reference === reference);
  if (states.length === 0) fail("contact-state-source-missing");
  const columns = 3;
  const cellWidth = 220;
  const imageHeight = Math.round(844 * (cellWidth / 390));
  const labelHeight = 34;
  const cellHeight = imageHeight + labelHeight;
  const rows = Math.ceil(states.length / columns);
  const composites: sharp.OverlayOptions[] = [];

  for (const [index, state] of states.entries()) {
    const source = candidateContents.get(state.path);
    if (!source) fail("contact-state-source-snapshot-missing");
    const left = (index % columns) * cellWidth;
    const top = Math.floor(index / columns) * cellHeight;
    composites.push({ input: labelSvg(state.state ?? "state", cellWidth, labelHeight), left, top });
    composites.push({
      input: await sharp(source).resize(cellWidth, imageHeight, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer(),
      left,
      top: top + labelHeight,
    });
  }

  const relativePath = stateContactSheetRelativePath(reference);
  const { data, info } = await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: "#f3ebdc",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: true, quality: 92, colours: 256 })
    .toBuffer({ resolveWithObject: true });
  writeFileSync(outputPath(stageRoot, relativePath), data, { flag: "wx", mode: 0o600 });
  return {
    path: relativePath,
    kind: "state-contact-sheet",
    bytes: data.length,
    sha256: sha256(data),
    width: info.width,
    height: info.height,
    reference,
  };
}

const verified = await verifyGoldenCandidates();
const frontendRoot = assertSafeDirectoryRoot(process.cwd(), "frontend-root");
const repositoryRoot = assertSafeDirectoryRoot(path.resolve(frontendRoot, ".."), "repository-root");
const destinationParent = ensureOwnedDirectory(
  repositoryRoot,
  ["docs", "phase5a2", "checkpoint-2"],
  "golden-evidence-parent",
);
const destinationPath = goldenEvidenceRoot(repositoryRoot);
const replacing = existsSync(destinationPath);
if (replacing && process.env.PHASE5A2_GOLDEN_REPLACE_EVIDENCE !== "true") {
  fail("evidence-destination-exists");
}
const destination = replacing
  ? assertOwnedDirectory(destinationParent, ["evidence"], "golden-existing-evidence")
  : assertOwnedPathAbsent(destinationParent, ["evidence"], "golden-evidence-destination");
if (destination !== goldenEvidenceRoot(repositoryRoot)) fail("evidence-destination-invalid");
const stageRoot = mkdtempSync(path.join(destinationParent, ".golden-evidence-staging-"));
const stageBasename = path.basename(stageRoot);
assertOwnedDirectory(destinationParent, [stageBasename], "golden-temporary-stage");
let published = false;
const backupBasename = `.golden-evidence-backup-${process.pid}`;
let backupCreated = false;

try {
  const retainedKinds = new Set(["still", "board", "video", "runtime", "journeys", "performance"]);
  const retained: StagedFile[] = [];
  for (const file of verified.files) {
    if (!retainedKinds.has(file.kind)) continue;
    const contents = verified.contents.get(file.path);
    if (!contents) fail("retained-snapshot-missing");
    retained.push(copyVerified(stageRoot, file, contents));
  }
  for (const reference of GOLDEN_REFERENCE_IDS) {
    retained.push(
      await createStateContactSheet(stageRoot, verified.contents, verified.files, reference),
    );
  }
  retained.sort((left, right) => left.path.localeCompare(right.path, "en"));
  const retainedBytes = retained.reduce((sum, file) => sum + file.bytes, 0);
  if (retainedBytes > GOLDEN_COMMITTED_BINARY_LIMIT_BYTES) fail("committed-packet-budget-exceeded");

  const manifest = {
    schemaVersion: 1,
    kind: "phase5a2-selected-hybrid-golden-reference-evidence",
    reviewOnly: true,
    productionBaseline: false,
    sourceSha: verified.runtime.sourceSha,
    sourceTreeSha: verified.runtime.sourceTreeSha,
    selectedHybrid: {
      brandAndExpression: "Source Fold",
      productAndEvidenceArchitecture: "Evidence Register",
      systemName: "Folded Label Register",
    },
    captureContractSha256: sha256CanonicalLf(
      fileURLToPath(new URL("./capture-contract.ts", import.meta.url)),
    ),
    captureContractHashCanonicalization: "utf8-lf",
    runtime: verified.runtime,
    counts: {
      coreStills: 36,
      localizedStills: 12,
      forcedColorsStills: 6,
      rawStateStills: 59,
      stateContactSheets: 6,
      motionRecordings: 12,
      terminalMotionStills: 12,
      assetBoards: 7,
      performanceReports: 1,
      retainedFiles: retained.length,
      rawFiles: verified.files.length,
    },
    retainedBytes,
    committedBinaryLimitBytes: GOLDEN_COMMITTED_BINARY_LIMIT_BYTES,
    fontBytes: 0,
    typographyDisposition: "system-stack-control-candidate-font-assay-blocked",
    journeys: verified.journeys,
    performance: verified.performance,
    rawFiles: verified.files,
    files: retained,
  };
  const manifestContents = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(outputPath(stageRoot, "manifest.json"), manifestContents, { flag: "wx", mode: 0o600 });
  if (replacing) {
    const backup = assertOwnedPathAbsent(
      destinationParent,
      [backupBasename],
      "golden-evidence-backup",
    );
    renameSync(destination, backup);
    backupCreated = true;
  }
  try {
    publishOwnedDirectory(
      destinationParent,
      stageBasename,
      path.basename(destination),
      "golden-evidence-publish",
    );
  } catch (error) {
    if (backupCreated && !existsSync(destination)) {
      renameSync(path.join(destinationParent, backupBasename), destination);
      backupCreated = false;
    }
    throw error;
  }
  published = true;
  if (backupCreated) {
    removeOwnedDirectory(
      destinationParent,
      [backupBasename],
      "golden-evidence-backup-cleanup",
    );
    backupCreated = false;
  }
  process.stdout.write(`${JSON.stringify({ sourceSha: manifest.sourceSha, sourceTreeSha: manifest.sourceTreeSha, retainedFiles: retained.length + 1, retainedBytes: retainedBytes + manifestContents.length, destination }, null, 2)}\n`);
} finally {
  if (!published) removeOwnedDirectory(destinationParent, [stageBasename], "golden-temporary-stage-cleanup");
}
