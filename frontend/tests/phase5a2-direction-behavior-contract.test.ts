import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const frontendRoot = process.cwd();
const readFrontend = (filename: string): string =>
  readFileSync(path.join(frontendRoot, filename), "utf8");

describe("Phase 5A.2 direction behavior admission contract", () => {
  it("keeps one authenticated Chromium project explicitly opt-in and artifact-free", () => {
    const config = readFrontend("playwright.config.ts");
    const projectStart = config.indexOf("const phase5a2DirectionBehaviorProject");
    const projectsStart = config.indexOf("const projects =", projectStart);
    expect(projectStart).toBeGreaterThan(0);
    expect(projectsStart).toBeGreaterThan(projectStart);
    const project = config.slice(projectStart, projectsStart);

    expect(config).toContain(
      'const HAS_PHASE5A2_DIRECTION_BEHAVIOR = enabled("PHASE5A2_DIRECTION_BEHAVIOR")',
    );
    expect(config).toContain(
      "HAS_PHASE5A2_DIRECTION_BEHAVIOR && LOCAL_AUTHENTICATED",
    );
    expect(project).toContain('name: "phase5a2-direction-behavior"');
    expect(project).toContain('dependencies: ["auth-setup"]');
    expect(project).toContain('browserName: "chromium"');
    expect(project).toContain('storageState: authStatePath("user.json")');
    expect(project).toContain('serviceWorkers: "block"');
    expect(project).toContain('trace: "off"');
    expect(project).toContain('screenshot: "off"');
    expect(project).toContain('video: "off"');
  });

  it("runs serially with the review while preserving the evidence verifier", () => {
    const runner = readFrontend("tooling/design-system/direction-selection/run.mts");
    expect(runner).toContain('PHASE5A2_DIRECTION_BEHAVIOR: "true"');
    expect(runner).toContain('"--project=phase5a2-direction-behavior"');
    expect(runner).toContain('"--workers=1"');
    expect(runner).toContain('"--reporter=list"');
    expect(runner).toContain('path.join(toolingDirectory, "verify-candidates.mts")');
    expect(runner.indexOf('"--project=phase5a2-direction-behavior"')).toBeLessThan(
      runner.indexOf('"--project=phase5a2-direction-stills"'),
    );
  });

  it("covers the bounded behavior matrix without output or raw runtime data", () => {
    const specification = readFrontend("e2e/phase5a2-direction-behavior.spec.ts");
    expect(specification).toContain('from "./fixtures/safe-test"');
    expect(specification).toContain("DIRECTION_SELECTION_STILLS");
    expect(specification).toContain("DIRECTION_SELECTION_CANDIDATES");
    expect(specification.match(/\btest\("/gu)).toHaveLength(5);
    expect(specification).toContain("test.describe.configure({ mode: \"serial\" })");
    expect(specification).toContain("forcedColors: \"active\"");
    expect(specification).toContain("TEXT_SPACING_STYLE");
    expect(specification).toContain("PerformanceObserver");
    expect(specification).toContain('includes("longtask")');
    expect(specification).toContain("PHASE5A2_FIXTURE.ean");
    expect(specification).toContain('data-phase5a2-state", "processing"');
    expect(specification).toContain("maximumMotionDuration");
    expect(specification).toContain("(?:e[+-]?\\d+)?");
    expect(specification).toContain("style.animationDelay");
    expect(specification).toContain("style.transitionDelay");
    for (const width of [320, 640, 768, 1024, 1280, 1440]) {
      expect(specification).toContain(`width: ${width}`);
    }
    expect(specification).toContain("{ width: 640, zoom: 2 }");

    for (const forbidden of [
      "candidateOutputPath",
      "mkdirSync",
      "writeFile",
      "appendFile",
      ".screenshot(",
      "toHaveScreenshot",
      "testInfo.attach",
      "message.text()",
      "error.message",
      "request.url()",
      "response.url()",
    ]) {
      expect(specification).not.toContain(forbidden);
    }
  });

  it("is part of design-system check without changing capture contracts", () => {
    const packageJson = readFrontend("package.json");
    const specification = readFrontend("e2e/phase5a2-direction-behavior.spec.ts");
    expect(packageJson).toContain("tests/phase5a2-direction-behavior-contract.test.ts");
    expect(specification).not.toContain("DIRECTION_SELECTION_STILL_COUNT");
    expect(specification).not.toContain("DIRECTION_SELECTION_VIDEO_COUNT");
    expect(specification).not.toContain("DIRECTION_SELECTION_CONTACT_SHEET_COUNT");
    expect(specification).not.toContain("capture-contract.ts");
  });
});
