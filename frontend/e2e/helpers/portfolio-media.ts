import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export const PORTFOLIO_OUTPUT_ENV = "TRYVIT_PORTFOLIO_OUTPUT_DIR";
export const PORTFOLIO_CAPTURE_TOGGLE = "PORTFOLIO_MEDIA_CAPTURE";

export const DESKTOP_VIEWPORT = Object.freeze({ width: 1440, height: 1000 });
export const MOBILE_VIEWPORT = Object.freeze({ width: 390, height: 844 });
export const SCANNER_EAN = "9062300130833";

export const PORTFOLIO_FILENAMES = Object.freeze({
  productDetail: "tryvit-product-detail-desktop.png",
  comparison: "tryvit-comparison-desktop.png",
  scanner: "tryvit-scan-mobile.png",
});

type PortfolioFilename = (typeof PORTFOLIO_FILENAMES)[keyof typeof PORTFOLIO_FILENAMES];

function failure(reason: string): Error {
  return new Error(`[PORTFOLIO_CAPTURE] ${reason}`);
}

function comparable(filename: string): string {
  return process.platform === "win32" ? filename.toLowerCase() : filename;
}

function pathIsWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function requirePlainDirectory(directory: string, label: string): void {
  let metadata;
  try {
    metadata = lstatSync(directory);
  } catch {
    throw failure(`${label}-unavailable`);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw failure(`${label}-invalid`);
  }
}

/**
 * Accept only the fixed evidence directory next to the current repository.
 * Every directory must already exist and be a plain directory so capture can
 * never create or follow a redirected output tree.
 */
export function validatePortfolioOutputDirectory(
  requested: string | undefined,
  repositoryRoot: string,
): string {
  if (!requested || !path.isAbsolute(requested)) {
    throw failure("output-directory-absolute-required");
  }
  if (!path.isAbsolute(repositoryRoot)) {
    throw failure("repository-root-absolute-required");
  }

  const repositoryLexical = path.resolve(repositoryRoot);
  const approvedWorkspaceLexical = path.join(
    path.dirname(repositoryLexical),
    "_portfolio_evidence_preflight",
  );
  const screenshotRootLexical = path.join(approvedWorkspaceLexical, "screenshots");
  const expectedLexical = path.join(screenshotRootLexical, "tryvit-functional");
  const requestedLexical = path.resolve(requested);

  if (comparable(requestedLexical) !== comparable(expectedLexical)) {
    throw failure("output-directory-not-approved");
  }

  for (const [directory, label] of [
    [repositoryLexical, "repository-root"],
    [approvedWorkspaceLexical, "evidence-workspace"],
    [screenshotRootLexical, "screenshot-root"],
    [expectedLexical, "output-directory"],
  ] as const) {
    requirePlainDirectory(directory, label);
  }

  const repository = realpathSync.native(repositoryLexical);
  const approvedWorkspace = realpathSync.native(approvedWorkspaceLexical);
  const outputDirectory = realpathSync.native(requestedLexical);
  const expected = realpathSync.native(expectedLexical);

  if (comparable(outputDirectory) !== comparable(expected)) {
    throw failure("output-directory-canonical-mismatch");
  }
  if (!pathIsWithin(approvedWorkspace, outputDirectory) || outputDirectory === approvedWorkspace) {
    throw failure("output-directory-outside-evidence-workspace");
  }
  if (pathIsWithin(repository, outputDirectory)) {
    throw failure("output-directory-inside-repository");
  }

  return outputDirectory;
}

export function requireRuntimeProductId(
  value: string | undefined,
  variableName: "QA_PRODUCT_ID" | "QA_PRODUCT_NO_ALT",
): string {
  if (!value || !/^[1-9][0-9]*$/u.test(value)) {
    throw failure(`${variableName.toLowerCase()}-positive-runtime-id-required`);
  }
  return value;
}

export function productRoute(productId: string): string {
  return `/app/product/${requireRuntimeProductId(productId, "QA_PRODUCT_ID")}`;
}

export function comparisonRoute(productId: string, peerProductId: string): string {
  const first = requireRuntimeProductId(productId, "QA_PRODUCT_ID");
  const second = requireRuntimeProductId(peerProductId, "QA_PRODUCT_NO_ALT");
  if (first === second) throw failure("comparison-runtime-ids-must-differ");
  return `/app/compare?ids=${first},${second}`;
}

export function portfolioScreenshotPath(
  outputDirectory: string,
  filename: PortfolioFilename,
): string {
  const target = path.join(outputDirectory, filename);
  if (!pathIsWithin(outputDirectory, target) || path.dirname(target) !== outputDirectory) {
    throw failure("screenshot-target-invalid");
  }
  return target;
}

export function readPngDimensions(filename: string): { width: number; height: number } {
  const bytes = readFileSync(filename);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw failure("screenshot-is-not-png");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}
