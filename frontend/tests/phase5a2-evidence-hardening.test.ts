import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";

import { directionSelectionFrameHasVisualContent } from "@/../e2e/helpers/phase5a2-direction-selection";
import { createDirectionSelectionContactLabelSvg } from "@/../tooling/design-system/direction-selection/contact-label";
import {
  assertOwnedPathAbsent,
  ensureOwnedDirectory,
  prepareOwnedFileTarget,
  publishOwnedDirectory,
  readOwnedRegularFile,
  removeOwnedDirectory,
  sha256CanonicalLf,
} from "@/../tooling/design-system/direction-selection/evidence-safety";
import {
  captureNextEnvSourceSnapshot,
  restoreNextEnvSourceSnapshot,
  withNextEnvSourceRestoration,
} from "@/../tooling/design-system/direction-selection/next-env-source";
import { verifyPlaywrightWebm } from "@/../tooling/design-system/direction-selection/webm-evidence";

const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix = "tryvit-p5a2-hardening-"): string {
  const directory = realpathSync.native(mkdtempSync(path.join(tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

function nextEnvContents(
  mode: "build" | "development",
  eol: "\n" | "\r\n" = "\n",
): string {
  const routeTypes = mode === "development"
    ? ".next/dev/types/routes.d.ts"
    : ".next/types/routes.d.ts";
  return [
    '/// <reference types="next" />',
    '/// <reference types="next/image-types/global" />',
    `import "./${routeTypes}";`,
    "",
    "// NOTE: This file should not be edited",
    "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
    "",
  ].join(eol);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== realpathSync.native(tmpdir()) ||
      !path.basename(resolved).startsWith("tryvit-p5a2-")
    ) {
      throw new Error("Temporary test cleanup target is not owned.");
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});

function encodeSize(value: number): Buffer {
  for (let length = 1; length <= 4; length += 1) {
    const maximum = 2 ** (7 * length) - 1;
    if (value >= maximum) continue;
    const output = Buffer.alloc(length);
    let remaining = value;
    for (let index = length - 1; index >= 0; index -= 1) {
      output[index] = remaining & 0xff;
      remaining = Math.floor(remaining / 256);
    }
    output[0] = (output[0] as number) | (1 << (8 - length));
    return output;
  }
  throw new Error("Synthetic EBML element is too large.");
}

function element(id: string, contents: Buffer): Buffer {
  return Buffer.concat([Buffer.from(id, "hex"), encodeSize(contents.length), contents]);
}

function unsigned(id: string, value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;
  do {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  } while (remaining > 0);
  return element(id, Buffer.from(bytes));
}

function text(id: string, value: string): Buffer {
  return element(id, Buffer.from(value, "utf8"));
}

function float64(id: string, value: number): Buffer {
  const valueBytes = Buffer.alloc(8);
  valueBytes.writeDoubleBE(value);
  return element(id, valueBytes);
}

function jpegFrame(width: number, height: number): Buffer {
  const sof = Buffer.alloc(9);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 1;
  sof[6] = 1;
  sof[7] = 0x11;
  sof[8] = 0;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xc0, 0x00, 0x0b]),
    sof,
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
    Buffer.from([0x00, 0xff, 0xd9]),
  ]);
}

function vp8KeyFrame(width: number, height: number): Buffer {
  const frame = Buffer.alloc(10);
  frame[0] = 0x10;
  frame[3] = 0x9d;
  frame[4] = 0x01;
  frame[5] = 0x2a;
  frame.writeUInt16LE(width, 6);
  frame.writeUInt16LE(height, 8);
  return frame;
}

function simpleBlock(frame: Buffer, timecode = 0): Buffer {
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header.writeInt16BE(timecode, 1);
  header[3] = 0x80;
  return element("a3", Buffer.concat([header, frame]));
}

function syntheticWebm(
  codec: "V_MJPEG" | "V_VP8",
  width: number,
  height: number,
  frameWidth = width,
  frameHeight = height,
): Buffer {
  const frame = codec === "V_MJPEG"
    ? jpegFrame(frameWidth, frameHeight)
    : vp8KeyFrame(frameWidth, frameHeight);
  const ebml = element("1a45dfa3", text("4282", "webm"));
  const info = element(
    "1549a966",
    Buffer.concat([unsigned("2ad7b1", 1_000_000), float64("4489", 1_500)]),
  );
  const video = element(
    "e0",
    Buffer.concat([unsigned("b0", width), unsigned("ba", height)]),
  );
  const track = element(
    "ae",
    Buffer.concat([
      unsigned("d7", 1),
      unsigned("83", 1),
      text("86", codec),
      video,
    ]),
  );
  const tracks = element("1654ae6b", track);
  const firstCluster = element(
    "1f43b675",
    Buffer.concat([unsigned("e7", 0), simpleBlock(frame)]),
  );
  const secondCluster = element(
    "1f43b675",
    Buffer.concat([unsigned("e7", 750), simpleBlock(frame)]),
  );
  const segment = element(
    "18538067",
    Buffer.concat([info, tracks, firstCluster, secondCluster]),
  );
  return Buffer.concat([ebml, segment]);
}

const videoOptions = {
  expectedWidth: 390,
  expectedHeight: 844,
  minimumDurationMs: 1_000,
  maximumDurationMs: 5_000,
};

describe("Phase 5A.2 evidence filesystem containment", () => {
  it("creates only bounded regular targets and rejects traversal", () => {
    const root = temporaryDirectory();
    const owned = ensureOwnedDirectory(root, ["test-results", "candidate"], "test-owned");
    const target = prepareOwnedFileTarget(owned, "stills/candidate.png", "test-file");
    writeFileSync(target, "fixture", { flag: "wx" });
    expect(readFileSync(target, "utf8")).toBe("fixture");
    expect(() => prepareOwnedFileTarget(owned, "../escape", "test-file")).toThrow(
      /path-invalid/u,
    );
  });

  it("rejects a reparse ancestor before cleanup or writing", () => {
    const root = temporaryDirectory();
    const outside = temporaryDirectory("tryvit-p5a2-outside-");
    const sentinel = path.join(outside, "sentinel.txt");
    writeFileSync(sentinel, "preserve", "utf8");
    symlinkSync(
      outside,
      path.join(root, "test-results"),
      process.platform === "win32" ? "junction" : "dir",
    );

    expect(() =>
      ensureOwnedDirectory(root, ["test-results", "candidate"], "test-reparse"),
    ).toThrow(/reparse/u);
    expect(() =>
      removeOwnedDirectory(root, ["test-results", "candidate"], "test-reparse"),
    ).toThrow(/reparse/u);
    expect(() =>
      readOwnedRegularFile(root, "test-results/sentinel.txt", "test-reparse", 64),
    ).toThrow(/reparse/u);
    expect(readFileSync(sentinel, "utf8")).toBe("preserve");
    unlinkSync(path.join(root, "test-results"));
  });

  it("publishes a verified sibling directory with one rename", () => {
    const root = temporaryDirectory();
    const parent = ensureOwnedDirectory(root, ["docs", "checkpoint"], "test-parent");
    const stage = mkdtempSync(path.join(parent, ".phase5a2-evidence-staging-"));
    const target = prepareOwnedFileTarget(stage, "manifest.json", "test-stage");
    writeFileSync(target, "{}\n", { flag: "wx" });
    const published = publishOwnedDirectory(
      parent,
      path.basename(stage),
      "evidence",
      "test-publish",
    );

    expect(existsSync(stage)).toBe(false);
    expect(readFileSync(path.join(published, "manifest.json"), "utf8")).toBe("{}\n");
    expect(() => assertOwnedPathAbsent(parent, ["evidence"], "test-absent")).toThrow(
      /target-exists/u,
    );
  });

  it("reads bounded evidence from one verified descriptor snapshot", () => {
    const root = temporaryDirectory();
    const owned = ensureOwnedDirectory(root, ["test-results", "candidate"], "test-owned");
    const filename = prepareOwnedFileTarget(owned, "recording.webm", "test-snapshot");
    const expected = Buffer.from("verified evidence", "utf8");
    writeFileSync(filename, expected, { flag: "wx" });

    expect(
      readOwnedRegularFile(owned, "recording.webm", "test-snapshot", expected.length),
    ).toEqual({ contents: expected });
    expect(() =>
      readOwnedRegularFile(owned, "recording.webm", "test-snapshot", expected.length - 1),
    ).toThrow(/target-invalid/u);
  });

  it("canonicalizes checkout line endings before hashing", () => {
    const root = temporaryDirectory();
    const lf = path.join(root, "lf.ts");
    const crlf = path.join(root, "crlf.ts");
    writeFileSync(lf, "export const value = 1;\n", "utf8");
    writeFileSync(crlf, "export const value = 1;\r\n", "utf8");
    expect(sha256CanonicalLf(lf)).toBe(sha256CanonicalLf(crlf));
  });
});

describe("Phase 5A.2 generated Next source restoration", () => {
  it.each(["\n", "\r\n"] as const)(
    "restores the exact tracked bytes after the bounded %j build mutation",
    (eol) => {
      const root = temporaryDirectory();
      const filename = path.join(root, "next-env.d.ts");
      const original = Buffer.from(nextEnvContents("development", eol), "utf8");
      writeFileSync(filename, original);
      const snapshot = captureNextEnvSourceSnapshot(root);
      writeFileSync(filename, nextEnvContents("build", eol), "utf8");
      let statusChecks = 0;

      expect(
        restoreNextEnvSourceSnapshot(snapshot, () => {
          statusChecks += 1;
          return statusChecks === 1 ? " M frontend/next-env.d.ts" : "";
        }),
      ).toBe("restored");
      expect(readFileSync(filename)).toEqual(original);
      expect(statusChecks).toBe(2);
    },
  );

  it("restores a Git-clean mixed-EOL source after Next canonicalizes it", () => {
    const root = temporaryDirectory();
    const filename = path.join(root, "next-env.d.ts");
    const original = Buffer.from(
      nextEnvContents("development", "\r\n").replace(
        'import "./.next/dev/types/routes.d.ts";\r\n\r\n',
        'import "./.next/dev/types/routes.d.ts";\n\r\n',
      ),
      "utf8",
    );
    writeFileSync(filename, original);
    const snapshot = captureNextEnvSourceSnapshot(root);
    writeFileSync(filename, nextEnvContents("build", "\r\n"), "utf8");
    let statusChecks = 0;

    expect(
      restoreNextEnvSourceSnapshot(snapshot, () => {
        statusChecks += 1;
        return statusChecks === 1 ? " M frontend/next-env.d.ts" : "";
      }),
    ).toBe("restored");
    expect(readFileSync(filename)).toEqual(original);
  });

  it("accepts an unchanged clean source snapshot without writing", () => {
    const root = temporaryDirectory();
    const filename = path.join(root, "next-env.d.ts");
    const original = Buffer.from(nextEnvContents("development"), "utf8");
    writeFileSync(filename, original);
    const snapshot = captureNextEnvSourceSnapshot(root);

    expect(restoreNextEnvSourceSnapshot(snapshot, () => "")).toBe("unchanged");
    expect(readFileSync(filename)).toEqual(original);
  });

  it("restores the exact generated mutation when the owned child fails", () => {
    const root = temporaryDirectory();
    const filename = path.join(root, "next-env.d.ts");
    const original = Buffer.from(nextEnvContents("development"), "utf8");
    writeFileSync(filename, original);
    const snapshot = captureNextEnvSourceSnapshot(root);
    let statusChecks = 0;

    expect(() =>
      withNextEnvSourceRestoration(
        snapshot,
        () => {
          writeFileSync(filename, nextEnvContents("build"), "utf8");
          throw new Error("owned-child-failed");
        },
        () => {
          statusChecks += 1;
          return statusChecks === 1 ? " M frontend/next-env.d.ts" : "";
        },
      ),
    ).toThrow("owned-child-failed");
    expect(readFileSync(filename)).toEqual(original);
    expect(statusChecks).toBe(2);
  });

  it("refuses unexpected content without overwriting it", () => {
    const root = temporaryDirectory();
    const filename = path.join(root, "next-env.d.ts");
    writeFileSync(filename, nextEnvContents("development"), "utf8");
    const snapshot = captureNextEnvSourceSnapshot(root);
    const unexpected = Buffer.from("developer change\n", "utf8");
    writeFileSync(filename, unexpected);

    expect(() =>
      restoreNextEnvSourceSnapshot(snapshot, () => " M frontend/next-env.d.ts"),
    ).toThrow(/next-env-source-mutation-unexpected/u);
    expect(readFileSync(filename)).toEqual(unexpected);
  });

  it("refuses the generated mutation when another source path changed", () => {
    const root = temporaryDirectory();
    const filename = path.join(root, "next-env.d.ts");
    writeFileSync(filename, nextEnvContents("development"), "utf8");
    const snapshot = captureNextEnvSourceSnapshot(root);
    const buildBytes = Buffer.from(nextEnvContents("build"), "utf8");
    writeFileSync(filename, buildBytes);

    expect(() =>
      restoreNextEnvSourceSnapshot(
        snapshot,
        () => " M frontend/next-env.d.ts\n M frontend/src/app/page.tsx",
      ),
    ).toThrow(/next-env-source-mutation-unexpected/u);
    expect(readFileSync(filename)).toEqual(buildBytes);
  });

  it("fails if the worktree is not clean after restoring the exact mutation", () => {
    const root = temporaryDirectory();
    const filename = path.join(root, "next-env.d.ts");
    const original = Buffer.from(nextEnvContents("development"), "utf8");
    writeFileSync(filename, original);
    const snapshot = captureNextEnvSourceSnapshot(root);
    writeFileSync(filename, nextEnvContents("build"), "utf8");

    expect(() =>
      restoreNextEnvSourceSnapshot(snapshot, () => " M frontend/next-env.d.ts"),
    ).toThrow(/next-env-source-restore-invalid/u);
    expect(readFileSync(filename)).toEqual(original);
  });

  it("rejects missing, duplicate, and non-regular generated source contracts", () => {
    for (const contents of [
      "// route import missing\n",
      `${nextEnvContents("development")}import "./.next/dev/types/routes.d.ts";\n`,
    ]) {
      const root = temporaryDirectory();
      writeFileSync(path.join(root, "next-env.d.ts"), contents, "utf8");
      expect(() => captureNextEnvSourceSnapshot(root)).toThrow(
        /next-env-source-contract-invalid/u,
      );
    }

    const nonRegularRoot = temporaryDirectory();
    ensureOwnedDirectory(nonRegularRoot, ["next-env.d.ts"], "test-next-env-directory");
    expect(() => captureNextEnvSourceSnapshot(nonRegularRoot)).toThrow(/target-invalid/u);
  });
});

describe("Phase 5A.2 contact-label determinism", () => {
  it("uses paths rather than host fonts", () => {
    const first = createDirectionSelectionContactLabelSvg("A", 720, 36);
    const second = createDirectionSelectionContactLabelSvg("A", 720, 36);
    const candidateB = createDirectionSelectionContactLabelSvg("B", 720, 36);
    const source = first.toString("utf8");
    expect(source).toContain("<path");
    expect(source).not.toContain("<text");
    expect(source).not.toContain("font-");
    expect(createHash("sha256").update(first).digest("hex")).toBe(
      createHash("sha256").update(second).digest("hex"),
    );
    expect(first.equals(candidateB)).toBe(false);
  });
});

describe("Phase 5A.2 Playwright WebM verification", () => {
  it("validates complete V_MJPEG clusters using JPEG frame dimensions", () => {
    expect(verifyPlaywrightWebm(syntheticWebm("V_MJPEG", 390, 844), videoOptions)).toEqual({
      codec: "V_MJPEG",
      width: 390,
      height: 844,
      durationMs: 1_500,
      frameCount: 2,
      keyFrameCount: 2,
      clusterCount: 2,
    });
  });

  it("also validates the V_VP8 codec emitted by current Playwright", () => {
    expect(verifyPlaywrightWebm(syntheticWebm("V_VP8", 390, 844), videoOptions)).toMatchObject({
      codec: "V_VP8",
      width: 390,
      height: 844,
      frameCount: 2,
      keyFrameCount: 2,
    });
  });

  it("rejects truncated clusters, forged signatures, and frame dimension drift", () => {
    const complete = syntheticWebm("V_MJPEG", 390, 844);
    expect(() => verifyPlaywrightWebm(complete.subarray(0, complete.length - 1), videoOptions))
      .toThrow(/(?:element-truncated|segment-invalid)/u);
    expect(() => verifyPlaywrightWebm(Buffer.from("1a45dfa3", "hex"), videoOptions))
      .toThrow(/container-truncated/u);
    expect(() =>
      verifyPlaywrightWebm(syntheticWebm("V_MJPEG", 390, 844, 391, 844), videoOptions),
    ).toThrow(/jpeg-dimensions-mismatch/u);
  });
});

describe("Phase 5A.2 recording contract wiring", () => {
  it("rejects uniform prepaint frames and admits rendered content", async () => {
    const uniform = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    }).jpeg().toBuffer();
    const rendered = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{
        input: Buffer.from(
          '<svg width="16" height="16"><rect width="16" height="16" fill="#123456"/></svg>',
        ),
        left: 8,
        top: 8,
      }])
      .jpeg()
      .toBuffer();

    await expect(directionSelectionFrameHasVisualContent(uniform)).resolves.toBe(false);
    await expect(directionSelectionFrameHasVisualContent(rendered)).resolves.toBe(true);
  });

  const frontendRoot = process.cwd();
  const readFrontend = (relativePath: string): string =>
    readFileSync(path.join(frontendRoot, relativePath), "utf8");

  it("holds scanner states and settles the whole motion surface", () => {
    const helper = readFrontend("e2e/helpers/phase5a2-direction-selection.ts");
    const motion = readFrontend("e2e/phase5a2-direction-selection-motion.spec.ts");
    const scanner = readFrontend("e2e/phase5a2-direction-selection-scanner.spec.ts");
    expect(helper).toContain("element.parentElement");
    expect(helper).toContain("surface.getAnimations({ subtree: true })");
    expect(helper).toContain("full-motion-animation-missing");
    expect(motion.match(/settleDirectionSelectionMotionSurface\(study\)/gu)).toHaveLength(2);
    expect(motion).toContain("focus({ preventScroll: true })");
    expect(motion).toContain("motion-control-focus-failed");
    expect(motion).toContain("motion-viewport-shift");
    expect(motion).toContain('locator(".phase5a2-motion-actions")).toBeInViewport({ ratio: 1 })');
    expect(motion).not.toContain("await next.click()");
    expect(motion).not.toContain("await restart.click()");
    expect(scanner.match(/holdDirectionSelectionVideoState\(page\)/gu)).toHaveLength(5);
  });

  it("starts each screencast only after the admitted surface is complete", () => {
    const config = readFrontend("playwright.config.ts");
    const helper = readFrontend("e2e/helpers/phase5a2-direction-selection.ts");
    const motion = readFrontend("e2e/phase5a2-direction-selection-motion.spec.ts");
    const scanner = readFrontend("e2e/phase5a2-direction-selection-scanner.spec.ts");
    const projectBlock = config.slice(
      config.indexOf("const phase5a2DirectionStillsProject"),
      config.indexOf("const phase5a3LandingEvidenceProject"),
    );
    const recordingStart = "startDirectionSelectionRecording(page, capture)";

    expect(projectBlock.match(/video: "off" as const/gu)).toHaveLength(5);
    expect(projectBlock).not.toContain("video: { mode: \"on\"");
    expect(helper).toContain("await page.screencast.start({");
    expect(helper).toContain("await firstFrame;");
    expect(helper).toContain("route-ready-invalid");
    expect(helper).toContain("recording-first-frame-invalid");
    expect(helper).toContain("recording-first-frame-uniform");
    expect(helper).toContain("directionSelectionFrameHasVisualContent(data)");
    expect(helper).toContain("DIRECTION_SELECTION_RECORDING_FIRST_FRAME_TIMEOUT_MS");
    expect(helper).toContain("recording-first-frame-timeout");
    expect(helper).toContain("clearTimeout(firstFrameTimeout)");
    expect(helper).toContain("data[0] !== 0xff");
    expect(helper).toContain("data[1] !== 0xd8");
    expect(helper).toContain("await page.screencast.stop();");
    expect(motion.indexOf(recordingStart)).toBeGreaterThan(
      motion.indexOf("assertDirectionSelectionAxe(page)"),
    );
    expect(motion.indexOf(recordingStart)).toBeGreaterThan(
      motion.indexOf("motion-stage-missing"),
    );
    expect(motion.indexOf(recordingStart)).toBeLessThan(
      motion.indexOf("holdDirectionSelectionVideoState(page)"),
    );
    expect(scanner.indexOf(recordingStart)).toBeGreaterThan(
      scanner.indexOf("assertDirectionSelectionAxe(page)"),
    );
    expect(scanner.indexOf(recordingStart)).toBeGreaterThan(
      scanner.indexOf('toHaveAttribute("data-phase5a2-state", "ready")'),
    );
    expect(scanner.indexOf(recordingStart)).toBeLessThan(
      scanner.indexOf("holdDirectionSelectionVideoState(page)"),
    );
    for (const specification of [motion, scanner]) {
      expect(specification).toContain("} finally {");
      expect(specification).toContain("await recording.stop();");
      expect(specification).toContain("if (sequenceError === undefined) throw stopError;");
    }
    expect(motion).not.toContain("page.video()");
    expect(scanner).not.toContain("page.video()");
  });

  it("keeps the full-motion runner and hardens media and publication verification", () => {
    const runner = readFrontend("tooling/design-system/direction-selection/run.mts");
    const safety = readFrontend("tooling/design-system/direction-selection/evidence-safety.ts");
    const verifier = readFrontend("tooling/design-system/direction-selection/verify-candidates.mts");
    const stager = readFrontend("tooling/design-system/direction-selection/stage-evidence.mts");
    expect(runner).toContain('NEXT_PUBLIC_QA_MODE: "0"');
    expect(runner).not.toContain('NEXT_PUBLIC_QA_MODE: "1"');
    expect(runner).toContain("captureNextEnvSourceSnapshot");
    expect(runner).toContain("withNextEnvSourceRestoration");
    expect(runner).toContain("return result.stdout.trimEnd()");
    expect(runner.lastIndexOf("withNextEnvSourceRestoration(")).toBeLessThan(
      runner.indexOf('path.join(toolingDirectory, "verify-candidates.mts")'),
    );
    expect(runner).not.toMatch(/git[^\n]*(?:checkout|restore)/u);
    expect(safety).toContain("O_NOFOLLOW");
    expect(safety).toContain("fstatSync(descriptor, { bigint: true })");
    expect(safety).toContain("lstatSync(resolved, { bigint: true })");
    expect(safety).toContain("readSync(");
    expect(safety).toContain("closeSync(descriptor)");
    expect(verifier).toContain("verifyPlaywrightWebm");
    expect(verifier).toContain("readOwnedRegularFile");
    expect(verifier).toContain("fileContents");
    expect(verifier).not.toContain("readFileSync(filename)");
    expect(verifier).not.toContain("statSync(filename)");
    expect(verifier).not.toContain("sharp(filename)");
    expect(stager).toContain("sha256CanonicalLf");
    expect(stager).toContain("publishOwnedDirectory");
    expect(stager).toContain("verified.fileContents");
    expect(stager).toContain("readOwnedRegularFile");
    expect(stager).toContain("sharp.cache(false)");
    expect(stager).toContain("sharp.versions.vips");
    expect(stager).not.toContain("<text");
    expect(stager).not.toContain("cpSync(");
    expect(stager).not.toContain("copyFileSync");
  });
});
