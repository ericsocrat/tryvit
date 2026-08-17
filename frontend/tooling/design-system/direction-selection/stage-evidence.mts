import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  DIRECTION_SELECTION_BINARY_COUNT,
  DIRECTION_SELECTION_CANDIDATES,
  DIRECTION_SELECTION_CONTACT_SHEETS,
  DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS,
  DIRECTION_SELECTION_MAX_PACKAGE_BYTES,
  DIRECTION_SELECTION_PACKAGE_FILE_COUNT,
  DIRECTION_SELECTION_STILLS,
  DIRECTION_SELECTION_VIDEOS,
  contactSheetRelativePath,
  directionSelectionRoute,
  getDirectionSelectionEvidenceRoot,
  stillRelativePath,
  videoRelativePath,
} from "./capture-contract.ts";
import { createDirectionSelectionContactLabelSvg } from "./contact-label.ts";
import {
  assertOwnedDirectory,
  assertOwnedPathAbsent,
  assertOwnedRegularFile,
  assertSafeDirectoryRoot,
  ensureOwnedDirectory,
  prepareOwnedFileTarget,
  publishOwnedDirectory,
  removeOwnedDirectory,
  sha256CanonicalLf,
} from "./evidence-safety.ts";
import {
  verifyDirectionSelectionCandidates,
  type VerifiedCandidateFile,
} from "./verify-candidates.mts";

interface StagedFile {
  readonly path: string;
  readonly kind: "still" | "motion-recording" | "contact-sheet";
  readonly bytes: number;
  readonly sha256: string;
  readonly candidate?: string;
  readonly surface?: string;
  readonly route?: string;
  readonly contentLocale?: string;
  readonly theme?: string;
  readonly motion?: string;
  readonly state?: string;
  readonly viewport?: Readonly<{ width: number; height: number }>;
  readonly encodedDimensions?: Readonly<{ width: number; height: number }>;
  readonly codec?: string;
  readonly durationMs?: number;
  readonly frameCount?: number;
  readonly keyFrameCount?: number;
  readonly clusterCount?: number;
}

function fail(code: string): never {
  throw new Error(`[P5A2_EVIDENCE] ${code}`);
}

function sha256(filename: string): string {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function outputPath(root: string, relativePath: string): string {
  return prepareOwnedFileTarget(root, relativePath, "stage-output");
}

async function createContactSheet(
  stageRoot: string,
  candidateRoot: string,
  contact: (typeof DIRECTION_SELECTION_CONTACT_SHEETS)[number],
): Promise<StagedFile> {
  const captures = DIRECTION_SELECTION_STILLS.filter(({ id }) => id === contact.id);
  if (captures.length !== DIRECTION_SELECTION_CANDIDATES.length) {
    fail("contact-sheet-source-count-invalid");
  }
  const scale = contact.width === 1440 ? 0.5 : 1;
  const cellWidth = Math.round(contact.width * scale);
  const cellHeight = Math.round(contact.height * scale);
  const labelHeight = 36;
  const composites: sharp.OverlayOptions[] = [];

  for (const [index, capture] of captures.entries()) {
    const source = assertOwnedRegularFile(
      candidateRoot,
      stillRelativePath(capture),
      "contact-sheet-source",
    );
    const input = await sharp(source)
      .resize(cellWidth, cellHeight, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    composites.push({ input, left: index * cellWidth, top: labelHeight });
    const label = String.fromCharCode(65 + index);
    composites.push({
      input: createDirectionSelectionContactLabelSvg(
        label as "A" | "B" | "C",
        cellWidth,
        labelHeight,
      ),
      left: index * cellWidth,
      top: 0,
    });
  }

  const relativePath = contactSheetRelativePath(contact);
  const filename = outputPath(stageRoot, relativePath);
  await sharp({
    create: {
      width: cellWidth * captures.length,
      height: cellHeight + labelHeight,
      channels: 4,
      background: "#161616",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: true, quality: 92, colours: 256, dither: 0.5 })
    .toFile(filename);
  const metadata = await sharp(filename).metadata();
  return {
    path: relativePath,
    kind: "contact-sheet",
    bytes: statSync(filename).size,
    sha256: sha256(filename),
    viewport: { width: contact.width, height: contact.height },
    encodedDimensions: {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    },
  };
}

function copyCandidateFile(
  stageRoot: string,
  candidateRoot: string,
  file: VerifiedCandidateFile,
): void {
  const source = assertOwnedRegularFile(candidateRoot, file.path, "candidate-copy-source");
  const destination = outputPath(stageRoot, file.path);
  copyFileSync(source, destination, fsConstants.COPYFILE_EXCL);
  if (statSync(destination).size !== file.bytes || sha256(destination) !== file.sha256) {
    fail("staged-copy-invalid");
  }
}

const verified = await verifyDirectionSelectionCandidates();
const frontendRoot = assertSafeDirectoryRoot(process.cwd(), "frontend-root");
const repositoryRoot = assertSafeDirectoryRoot(path.resolve(frontendRoot, ".."), "repository-root");
const destinationParent = ensureOwnedDirectory(
  repositoryRoot,
  ["docs", "phase5a2", "checkpoint-1"],
  "evidence-parent",
);
const destination = assertOwnedPathAbsent(
  destinationParent,
  ["evidence"],
  "evidence-destination",
);
if (destination !== getDirectionSelectionEvidenceRoot(repositoryRoot)) {
  fail("evidence-destination-invalid");
}
const stageRoot = mkdtempSync(path.join(destinationParent, ".phase5a2-evidence-staging-"));
const stageBasename = path.basename(stageRoot);
if (
  path.dirname(stageRoot) !== destinationParent ||
  !stageBasename.startsWith(".phase5a2-evidence-staging-")
) {
  fail("temporary-stage-invalid");
}
assertOwnedDirectory(destinationParent, [stageBasename], "temporary-stage");
let published = false;

try {
  for (const file of verified.files) copyCandidateFile(stageRoot, verified.root, file);

  const files: StagedFile[] = [];
  const candidateFiles = new Map(verified.files.map((file) => [file.path, file]));
  for (const capture of DIRECTION_SELECTION_STILLS) {
    const relativePath = stillRelativePath(capture);
    const file = candidateFiles.get(relativePath);
    if (!file) fail("still-record-missing");
    files.push({
      ...file,
      kind: "still",
      candidate: capture.candidate,
      surface: capture.surface,
      route: directionSelectionRoute(capture.candidate, capture),
      contentLocale: capture.locale,
      theme: capture.theme,
      motion: capture.motion,
      state: capture.state,
      viewport: { width: capture.width, height: capture.height },
      encodedDimensions: { width: capture.width, height: capture.height },
    });
  }
  for (const capture of DIRECTION_SELECTION_VIDEOS) {
    const relativePath = videoRelativePath(capture);
    const file = candidateFiles.get(relativePath);
    if (!file) fail("video-record-missing");
    const { video, ...verifiedFile } = file;
    if (!video) fail("video-metadata-missing");
    files.push({
      ...verifiedFile,
      kind: "motion-recording",
      candidate: capture.candidate,
      surface: capture.surface,
      route: directionSelectionRoute(capture.candidate, capture),
      contentLocale: capture.locale,
      theme: capture.theme,
      motion: capture.motion,
      state: capture.state,
      viewport: { width: capture.width, height: capture.height },
      encodedDimensions: { width: video.width, height: video.height },
      codec: video.codec,
      durationMs: video.durationMs,
      frameCount: video.frameCount,
      keyFrameCount: video.keyFrameCount,
      clusterCount: video.clusterCount,
    });
  }
  for (const contact of DIRECTION_SELECTION_CONTACT_SHEETS) {
    files.push(await createContactSheet(stageRoot, verified.root, contact));
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (files.length !== DIRECTION_SELECTION_BINARY_COUNT) {
    fail("binary-count-invalid");
  }

  const captureContractFilename = fileURLToPath(
    new URL("./capture-contract.ts", import.meta.url),
  );
  const manifest = {
    schemaVersion: 1,
    kind: "phase5a2-direction-selection-review-evidence",
    reviewOnly: true,
    productionBaseline: false,
    sourceSha: verified.runtime.sourceSha,
    sourceTreeSha: verified.runtime.sourceTreeSha,
    fixtureSha256: verified.runtime.fixtureSha256,
    captureContractSha256: sha256CanonicalLf(captureContractFilename),
    captureContractHashCanonicalization: "utf8-lf",
    runtime: {
      capture: {
        playwrightVersion: verified.runtime.playwrightVersion,
        browserName: verified.runtime.browserName,
        browserVersion: verified.runtime.browserVersion,
        browserLocale: verified.runtime.browserLocale,
        timezoneId: verified.runtime.timezoneId,
        deviceScaleFactor: 1,
        nodeVersion: verified.runtime.nodeVersion,
        osPlatform: verified.runtime.osPlatform,
        osArch: verified.runtime.osArch,
      },
      staging: {
        nodeVersion: process.version,
        osPlatform: process.platform,
        osArch: process.arch,
        sharpVersion: sharp.versions.sharp,
        libvipsVersion: sharp.versions.vips,
      },
    },
    counts: {
      candidates: DIRECTION_SELECTION_CANDIDATES.length,
      stills: DIRECTION_SELECTION_STILLS.length,
      motionRecordings: DIRECTION_SELECTION_VIDEOS.length,
      contactSheets: DIRECTION_SELECTION_CONTACT_SHEETS.length,
      binaryFiles: DIRECTION_SELECTION_BINARY_COUNT,
      packageFiles: DIRECTION_SELECTION_PACKAGE_FILE_COUNT,
    },
    authoredSources: [
      "frontend/src/app/dev/phase5a2/_directions/source-fold/SourceFold.tsx",
      "frontend/src/app/dev/phase5a2/_directions/source-fold/source-fold.module.css",
      "frontend/src/app/dev/phase5a2/_directions/evidence-register/EvidenceRegister.tsx",
      "frontend/src/app/dev/phase5a2/_directions/evidence-register/evidence-register.module.css",
      "frontend/src/app/dev/phase5a2/_directions/open-core/OpenCore.tsx",
      "frontend/src/app/dev/phase5a2/_directions/open-core/open-core.module.css",
    ],
    generatedBy: [
      "frontend/e2e/phase5a2-direction-selection-stills.spec.ts",
      "frontend/e2e/phase5a2-direction-selection-motion.spec.ts",
      "frontend/e2e/phase5a2-direction-selection-scanner.spec.ts",
      "frontend/tooling/design-system/direction-selection/stage-evidence.mts",
    ],
    files,
  };
  const manifestFilename = outputPath(stageRoot, "manifest.json");
  writeFileSync(manifestFilename, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  const stagedFiles = (function list(directory: string, root = directory): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail("staged-entry-reparse");
      if (entry.isDirectory()) return list(filename, root);
      if (entry.isFile()) return [path.relative(root, filename).split(path.sep).join("/")];
      fail("staged-entry-invalid");
    });
  })(stageRoot).sort();
  if (
    JSON.stringify(stagedFiles) !==
    JSON.stringify([...DIRECTION_SELECTION_EVIDENCE_RELATIVE_PATHS].sort())
  ) {
    fail("staged-file-matrix-invalid");
  }
  const packageBytes = stagedFiles.reduce(
    (sum, relativePath) =>
      sum + statSync(assertOwnedRegularFile(stageRoot, relativePath, "staged-package-file")).size,
    0,
  );
  if (packageBytes > DIRECTION_SELECTION_MAX_PACKAGE_BYTES) {
    fail("staged-package-size-invalid");
  }
  for (const file of files) {
    const filename = assertOwnedRegularFile(stageRoot, file.path, "staged-file");
    if (statSync(filename).size !== file.bytes || sha256(filename) !== file.sha256) {
      fail("staged-file-integrity-invalid");
    }
  }
  assertOwnedRegularFile(stageRoot, "manifest.json", "staged-manifest");

  const publishedDestination = publishOwnedDirectory(
    destinationParent,
    stageBasename,
    "evidence",
    "evidence-publication",
  );
  if (publishedDestination !== destination) fail("evidence-publication-invalid");
  published = true;
  process.stdout.write(
    `Phase 5A.2 evidence staged: ${DIRECTION_SELECTION_PACKAGE_FILE_COUNT} files, ${packageBytes} bytes.\n`,
  );
} finally {
  if (!published) {
    removeOwnedDirectory(
      destinationParent,
      [stageBasename],
      "temporary-stage-cleanup",
    );
  }
}
