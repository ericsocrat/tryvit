import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// eslint-disable-next-line no-restricted-imports -- focused capture-infrastructure contract
import {
  comparisonRoute,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  portfolioScreenshotPath,
  PORTFOLIO_FILENAMES,
  productRoute,
  readPngDimensions,
  requireRuntimeProductId,
  SCANNER_EAN,
  validatePortfolioOutputDirectory,
} from "../e2e/helpers/portfolio-media";

const temporaryRoots: string[] = [];

async function captureWorkspace(): Promise<{
  root: string;
  repository: string;
  output: string;
}> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "tryvit-portfolio-capture-"));
  temporaryRoots.push(root);
  const repository = path.join(root, "_tryvit_portfolio_capture");
  const output = path.join(
    root,
    "_portfolio_evidence_preflight",
    "screenshots",
    "tryvit-functional",
  );
  await fs.mkdir(repository);
  await fs.mkdir(output, { recursive: true });
  return { root, repository, output };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      const resolved = path.resolve(root);
      expect(path.dirname(resolved)).toBe(path.resolve(tmpdir()));
      expect(path.basename(resolved)).toMatch(/^tryvit-portfolio-capture-/u);
      await fs.rm(resolved, { recursive: true, force: true });
    }),
  );
});

describe("portfolio media capture contract", () => {
  it("pins the exact desktop and mobile viewports", () => {
    expect(DESKTOP_VIEWPORT).toEqual({ width: 1440, height: 1000 });
    expect(MOBILE_VIEWPORT).toEqual({ width: 390, height: 844 });
  });

  it("builds product and comparison routes only from positive runtime IDs", () => {
    expect(productRoute("417")).toBe("/app/product/417");
    expect(comparisonRoute("417", "418")).toBe("/app/compare?ids=417,418");
    expect(() => requireRuntimeProductId(undefined, "QA_PRODUCT_ID")).toThrow(
      /positive-runtime-id-required/u,
    );
    expect(() => comparisonRoute("417", "417")).toThrow(/runtime-ids-must-differ/u);
  });

  it("pins the manual scanner to the generic synthetic EAN", () => {
    expect(SCANNER_EAN).toBe("9062300130833");
  });

  it("accepts only the canonical approved external output directory", async () => {
    const workspace = await captureWorkspace();
    const canonical = validatePortfolioOutputDirectory(workspace.output, workspace.repository);

    expect(canonical).toBe(await fs.realpath(workspace.output));
    expect(canonical.startsWith(await fs.realpath(workspace.repository))).toBe(false);
    expect(
      portfolioScreenshotPath(canonical, PORTFOLIO_FILENAMES.productDetail),
    ).toBe(path.join(canonical, "tryvit-product-detail-desktop.png"));
  });

  it("rejects relative, repository-internal, and sibling output paths", async () => {
    const workspace = await captureWorkspace();
    const internal = path.join(workspace.repository, "screenshots");
    const sibling = path.join(workspace.root, "unapproved");
    await fs.mkdir(internal);
    await fs.mkdir(sibling);

    expect(() => validatePortfolioOutputDirectory("screenshots", workspace.repository)).toThrow(
      /absolute-required/u,
    );
    expect(() => validatePortfolioOutputDirectory(internal, workspace.repository)).toThrow(
      /not-approved/u,
    );
    expect(() => validatePortfolioOutputDirectory(sibling, workspace.repository)).toThrow(
      /not-approved/u,
    );
  });

  it("reads dimensions from the PNG IHDR without resizing the image", async () => {
    const workspace = await captureWorkspace();
    const filename = path.join(workspace.root, "dimensions.png");
    const bytes = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
    bytes.writeUInt32BE(1440, 16);
    bytes.writeUInt32BE(1000, 20);
    await fs.writeFile(filename, bytes);

    expect(readPngDimensions(filename)).toEqual({ width: 1440, height: 1000 });
  });
});
