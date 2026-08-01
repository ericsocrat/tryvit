import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = existsSync(path.join(process.cwd(), ".github"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const workflowsRoot = path.join(repoRoot, ".github", "workflows");
const packageScripts = JSON.parse(
  readFileSync(path.join(repoRoot, "frontend", "package.json"), "utf8"),
).scripts as Record<string, string>;
const runnerSources = {
  prScreenshots: readFileSync(path.join(repoRoot, "RUN_PR_SCREENSHOTS.ps1"), "utf8"),
  screenshots: readFileSync(path.join(repoRoot, "RUN_SCREENSHOTS.ps1"), "utf8"),
};
const safetyCliSource = readFileSync(
  path.join(repoRoot, "frontend", "e2e", "scripts", "visual-safety-cli.mts"),
  "utf8",
);

function readWorkflow(name: string): string {
  return readFileSync(path.join(workflowsRoot, name), "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jobSection(workflow: string, jobName: string): string {
  const jobPattern = new RegExp(`^  ${escapeRegExp(jobName)}:\\s*$`, "m");
  const match = jobPattern.exec(workflow);
  if (!match) throw new Error(`Missing workflow job: ${jobName}`);

  const tail = workflow.slice(match.index + match[0].length);
  const nextJob = /^  [A-Za-z0-9_-]+:\s*$/m.exec(tail);
  return workflow.slice(
    match.index,
    nextJob ? match.index + match[0].length + nextJob.index : undefined,
  );
}

const workflowSources = {
  prScreenshots: readWorkflow("pr-screenshots.yml"),
  prGate: readWorkflow("pr-gate.yml"),
  mainGate: readWorkflow("main-gate.yml"),
  qualityGate: readWorkflow("quality-gate.yml"),
  nightly: readWorkflow("nightly.yml"),
  lighthouse: readWorkflow("lighthouse-ci.yml"),
};

const browserJobs = {
  prScreenshots: jobSection(workflowSources.prScreenshots, "capture"),
  prGate: jobSection(workflowSources.prGate, "e2e-smoke"),
  mainGate: jobSection(workflowSources.mainGate, "e2e"),
  qualityGate: jobSection(workflowSources.qualityGate, "quality_gate"),
  nightly: jobSection(workflowSources.nightly, "comprehensive"),
  lighthouse: jobSection(workflowSources.lighthouse, "lighthouse"),
};

const hostedSupabasePatterns: RegExp[] = [
  /^\s*NEXT_PUBLIC_SUPABASE_URL:/m,
  /^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY:/m,
  /^\s*SUPABASE_SERVICE_ROLE_KEY:/m,
  /^\s*SUPABASE_URL:/m,
  /^\s*SUPABASE_SERVICE_KEY:/m,
  /^\s*QA_TEST_EMAIL:/m,
  /^\s*QA_TEST_PASSWORD:/m,
  /^\s*STAGING_URL:/m,
  /^\s*STAGING_SERVICE_KEY:/m,
  /SUPABASE_URL_STAGING/,
  /SUPABASE_ANON_KEY_STAGING/,
  /SUPABASE_SERVICE_ROLE_KEY_STAGING/,
  /\.supabase\.co/i,
];

describe("browser workflow visual-safety contract", () => {
  it("declares the complete visual-safety script contract", () => {
    for (const script of [
      "visual-safety:preflight",
      "visual-safety:assert",
      "visual-safety:build",
      "visual-safety:serve",
      "visual-safety:public",
      "visual-safety:local-authenticated",
      "visual-safety:lighthouse",
      "visual-safety:public-lighthouse",
    ]) {
      expect(packageScripts).toHaveProperty(script);
    }
  });

  it.each(Object.entries(browserJobs))(
    "%s has no hosted Supabase configuration or safety masking",
    (_name, job) => {
      for (const forbidden of hostedSupabasePatterns) {
        expect(job).not.toMatch(forbidden);
      }
      expect(job).not.toContain("continue-on-error: true");
    },
  );

  it.each(Object.entries(browserJobs))(
    "%s uses explicit public preflight and mandatory final assertion",
    (_name, job) => {
      const firstBrowserCommand = [
        job.indexOf("visual-safety:public"),
        job.indexOf("visual-safety:lighthouse"),
      ].filter((index) => index >= 0);
      const lastBrowserCommand = Math.max(
        job.lastIndexOf("visual-safety:public"),
        job.lastIndexOf("visual-safety:local-authenticated"),
        job.lastIndexOf("visual-safety:lighthouse"),
      );

      expect(job).toContain("VISUAL_SAFETY_MODE: public");
      expect(job).toMatch(/VISUAL_SAFETY_APP_ORIGIN: http:\/\/(?:localhost|127\.0\.0\.1):\d+/);
      expect(job).toMatch(/BASE_URL: http:\/\/(?:localhost|127\.0\.0\.1):\d+/);
      expect(job).toContain("npm run visual-safety:preflight");
      expect(Math.min(...firstBrowserCommand)).toBeGreaterThan(
        job.indexOf("npm run visual-safety:preflight"),
      );
      expect(job.lastIndexOf("npm run visual-safety:assert")).toBeGreaterThan(lastBrowserCommand);
    },
  );

  it("preserves failure status for every browser command piped through tee", () => {
    for (const job of Object.values(browserJobs)) {
      const lines = job.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        if (line.includes("visual-safety:") && line.includes("| tee")) {
          expect(lines.slice(Math.max(0, index - 2), index)).toContain("          set -o pipefail");
        }
      }
    }
  });

  it.each(Object.entries(browserJobs))(
    "%s does not upload browser artifacts before its final safety assertion",
    (_name, job) => {
      const firstUpload = job.indexOf("actions/upload-artifact");
      if (firstUpload >= 0) {
        expect(firstUpload).toBeGreaterThan(job.lastIndexOf("npm run visual-safety:assert"));
      }
    },
  );

  it.each([
    ["quality gate", browserJobs.qualityGate],
    ["nightly", browserJobs.nightly],
  ])("%s keeps authenticated coverage blocking and local-emulator-only", (_name, job) => {
    expect(job).toContain("VISUAL_SAFETY_MODE: local-authenticated");
    expect(job).toContain("npm run visual-safety:local-authenticated");
    expect(job).toMatch(/local emulator/i);
    expect(job).toMatch(/blocking/i);
    expect(job).not.toMatch(/skip(?:ped|ping).*auth/i);
  });

  it("keeps PR screenshots public and states that auth coverage is separate", () => {
    expect(browserJobs.prScreenshots).toContain(
      "npm run visual-safety:public -- --project=pr-screenshots",
    );
    expect(browserJobs.prScreenshots).not.toContain("visual-safety:local-authenticated");
    expect(browserJobs.prScreenshots).toMatch(
      /Authenticated PR screenshots require the explicit local-emulator-only runner/,
    );
  });

  it("keeps Lighthouse local, guarded, and off temporary public storage", () => {
    expect(browserJobs.lighthouse).toContain("npm run visual-safety:lighthouse -- mobile");
    expect(browserJobs.lighthouse).toContain("npx playwright install --with-deps chromium");
    expect(browserJobs.lighthouse.indexOf("npx playwright install --with-deps chromium")).toBeLessThan(
      browserJobs.lighthouse.indexOf("npm run visual-safety:preflight"),
    );
    expect(workflowSources.lighthouse).not.toContain("temporaryPublicStorage");
    expect(workflowSources.lighthouse).not.toContain("treosh/lighthouse-ci-action");
  });

  it.each(Object.entries(runnerSources))(
    "%s runner removes ambient hosted configuration before npm",
    (_name, runner) => {
      expect(runner).toContain("Get-ChildItem Env:");
      expect(runner).toContain("Remove-Item -LiteralPath");
      expect(runner).toContain("$removedSensitiveEnvironment");
      expect(runner).toMatch(/SUPABASE\|POSTGRES\|DATABASE/u);
      expect(runner).toMatch(/STAGING_\(URL\|SERVICE_KEY\)/u);
      for (const unsafeControl of [
        "CHROME_PATH",
        "LHCI_.*",
        "LHCITEST_.*",
        "LIGHTHOUSE_.*",
        "PLAYWRIGHT_.*",
        "PUPPETEER_.*",
        "PW(?!D$).*",
        "VISUAL_SAFETY_CONFIG_(RUNNER_PID|SEAL)",
      ]) {
        expect(runner).toContain(unsafeControl);
      }
      expect(runner).not.toMatch(/\bnpx\s+playwright\b/u);
      expect(runner).not.toMatch(/\bnext\s+(?:dev|start)\b/u);
      expect(runner).toMatch(/npm run \$scriptName/u);
      expect(runner).not.toContain("allowedLocalCredentialNames");
    },
  );

  it("gates PR screenshot upload and comments on the final assertion", () => {
    expect(browserJobs.prScreenshots).toContain("id: safety_assert");
    expect(browserJobs.prScreenshots).toMatch(
      /Upload screenshots[\s\S]*steps\.safety_assert\.outcome == 'success'/u,
    );
    expect(browserJobs.prScreenshots).toMatch(
      /Post PR comment[\s\S]*steps\.safety_assert\.outcome == 'success'/u,
    );
  });

  it("derives authenticated credentials only from the guarded local runtime", () => {
    expect(safetyCliSource).toContain('["status", "-o", "env", "--workdir", repositoryRoot]');
    expect(safetyCliSource).not.toMatch(
      /process\.env\.(?:NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|QA_TEST_EMAIL|QA_TEST_PASSWORD)\s*\?\?/u,
    );
  });

  it("preserves newline-delimited PR changed files from any caller directory", () => {
    expect(runnerSources.prScreenshots).toContain("git -C $PSScriptRoot");
    expect(runnerSources.prScreenshots).toContain('-join "`n"');
    expect(runnerSources.prScreenshots).toContain("PR_SCREENSHOTS_ALL");
    expect(runnerSources.prScreenshots).toContain("VS_GIT_DIFF");
  });

  it("preflights before deleting prior PR screenshot output", () => {
    expect(runnerSources.prScreenshots.indexOf("npm run visual-safety:preflight")).toBeLessThan(
      runnerSources.prScreenshots.indexOf("Remove-Item -LiteralPath $outputDir -Recurse -Force"),
    );
  });

  it("keeps package entry points explicit and cross-platform", () => {
    expect(packageScripts["quality:smoke"]).toContain("--quality-level=smoke");
    expect(packageScripts["quality:full"]).toContain("--quality-level=full");
    expect(packageScripts["lighthouse:mobile"]).toContain("visual-safety:public-lighthouse");
    expect(packageScripts["lighthouse:desktop"]).toContain("visual-safety:public-lighthouse");
    expect(safetyCliSource).toMatch(
      /commandEnvironment\.VISUAL_SAFETY_MODE = mode;[\s\S]*loadSafetyContractFromEnvironment\(commandEnvironment\)/u,
    );
  });

  it("never stages local authenticated storage state in browser artifacts", () => {
    const config = readFileSync(path.join(repoRoot, "frontend", "playwright.config.ts"), "utf8");
    expect(config).toContain("VISUAL_SAFETY_AUTH_STATE_DIR");
    expect(config).not.toContain("test-results/visual-safety-auth");
    for (const workflow of Object.values(workflowSources)) {
      expect(workflow).not.toContain("visual-safety-auth");
    }
  });

  it("scans every browser artifact family before workflow upload", () => {
    for (const requiredRoot of [
      "test-results",
      "playwright-report",
      "pr-screenshots",
      "qa_screenshots",
      "lighthouse-reports",
      '"docs", "screenshots"',
      "playwright-stdout.log",
      "playwright-public-stdout.log",
      "playwright-authenticated-stdout.log",
    ]) {
      expect(safetyCliSource).toContain(requiredRoot);
    }
    for (const job of Object.values(browserJobs)) {
      const uploadIndex = job.indexOf("actions/upload-artifact");
      if (uploadIndex >= 0) {
        expect(job.lastIndexOf("npm run visual-safety:assert")).toBeLessThan(uploadIndex);
      }
    }
  });

  it("keeps the separate Nightly hosted data audit outside browser hardening", () => {
    const dataAudit = jobSection(workflowSources.nightly, "data-audit");
    expect(dataAudit).toContain("python run_data_audit.py");
    expect(dataAudit).toContain("SUPABASE_URL:");
    expect(dataAudit).toContain("SUPABASE_SERVICE_KEY:");
    for (const key of ["SUPABASE_URL:", "SUPABASE_SERVICE_KEY:"]) {
      expect(browserJobs.nightly).not.toContain(key);
    }
  });

  it("triggers screenshot and Lighthouse safety checks for infrastructure edits", () => {
    for (const requiredPath of [
      "frontend/e2e/**",
      "frontend/tests/visual-safety-workflows.test.ts",
      "frontend/playwright.config.ts",
      "frontend/package.json",
      "RUN_PR_SCREENSHOTS.ps1",
      "RUN_SCREENSHOTS.ps1",
      "supabase/config.toml",
      ".github/workflows/pr-screenshots.yml",
    ]) {
      expect(workflowSources.prScreenshots).toContain(requiredPath);
    }

    expect(workflowSources.lighthouse).toContain("frontend/**");
    expect(workflowSources.lighthouse).toContain("supabase/config.toml");
    expect(workflowSources.lighthouse).toContain(".github/workflows/lighthouse-ci.yml");
    expect(workflowSources.qualityGate).toContain("frontend/**");
    expect(workflowSources.qualityGate).toContain("supabase/config.toml");
  });
});
