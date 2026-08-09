import { createHash } from "node:crypto";
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
const localRuntimeSource = readFileSync(
  path.join(repoRoot, "frontend", "e2e", "scripts", "local-supabase-ci.sh"),
  "utf8",
);
const localRuntimePowerShellSource = readFileSync(
  path.join(repoRoot, "frontend", "e2e", "scripts", "local-supabase-ci.ps1"),
  "utf8",
);
const localLighthouseGuardSource = readFileSync(
  path.join(repoRoot, "frontend", "e2e", "scripts", "lighthouse-local-auth-guard.cjs"),
  "utf8",
);
const fixtureSeederSource = readFileSync(
  path.join(repoRoot, "frontend", "tests", "quality", "seed-fixtures.mjs"),
  "utf8",
);
const nextConfigSource = readFileSync(path.join(repoRoot, "frontend", "next.config.ts"), "utf8");

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

function workflowEventSection(workflow: string, eventName: string): string {
  const eventPattern = new RegExp(`^  ${escapeRegExp(eventName)}:\\s*$`, "m");
  const match = eventPattern.exec(workflow);
  if (!match) throw new Error(`Missing workflow event: ${eventName}`);

  const tail = workflow.slice(match.index + match[0].length);
  const nextEvent = /^  [A-Za-z0-9_-]+:\s*$/m.exec(tail);
  return workflow.slice(
    match.index,
    nextEvent ? match.index + match[0].length + nextEvent.index : undefined,
  );
}

const workflowSources = {
  bundleSize: readWorkflow("bundle-size.yml"),
  codeql: readWorkflow("codeql.yml"),
  phase5Visual: readWorkflow("phase5a0d-visual-baselines.yml"),
  prScreenshots: readWorkflow("pr-screenshots.yml"),
  prGate: readWorkflow("pr-gate.yml"),
  prTitle: readWorkflow("pr-title-lint.yml"),
  mainGate: readWorkflow("main-gate.yml"),
  qualityGate: readWorkflow("quality-gate.yml"),
  repoVerify: readWorkflow("repo-verify.yml"),
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

const phase5VisualJobs = {
  verify: jobSection(workflowSources.phase5Visual, "verify"),
  generate: jobSection(workflowSources.phase5Visual, "generate-candidates"),
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
      "visual-safety:fixtures-seed",
      "visual-safety:fixtures-teardown",
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

  it.each([
    ["quality gate", browserJobs.qualityGate],
    ["nightly", browserJobs.nightly],
  ])("%s provisions and tears down the same guarded local runtime", (_name, job) => {
    const setupIndex = job.indexOf("supabase/setup-cli@46f7f98c7f948ad727d22c1e67fab04c223a0520");
    const startIndex = job.indexOf("local-supabase-ci.sh start");
    const preflightIndex = job.indexOf("Local-authenticated visual-safety preflight");
    const fixtureIndex = job.indexOf("visual-safety:fixtures-seed");
    const browserIndex = job.indexOf("visual-safety:local-authenticated");
    const fixtureTeardownIndex = job.indexOf("visual-safety:fixtures-teardown");
    const stopIndex = job.indexOf("local-supabase-ci.sh stop");

    expect(setupIndex).toBeGreaterThanOrEqual(0);
    expect(startIndex).toBeGreaterThan(setupIndex);
    expect(preflightIndex).toBeGreaterThan(startIndex);
    expect(fixtureIndex).toBeGreaterThan(preflightIndex);
    expect(browserIndex).toBeGreaterThan(fixtureIndex);
    expect(fixtureTeardownIndex).toBeGreaterThan(browserIndex);
    expect(stopIndex).toBeGreaterThan(fixtureTeardownIndex);
    expect(job).toMatch(
      /Teardown guarded local QA fixtures[\s\S]*if: \$\{\{ always\(\) && steps\.local_fixture_seed\.outputs\.seeded == 'true' \}\}/u,
    );
    expect(job).toMatch(
      /Stop ephemeral local Supabase \(no backup\)[\s\S]*if: \$\{\{ always\(\) \}\}/u,
    );
    expect(job).not.toContain("supabase status -o env");
    expect(job).not.toContain("55001");
    expect(job).not.toContain("tests/quality/seed-fixtures.mjs");
  });

  it("keeps the CI local runtime ephemeral, reduced, and credential-silent", () => {
    expect(localRuntimeSource).toContain("supabase start");
    expect(localRuntimeSource).toContain("supabase stop --workdir");
    expect(localRuntimeSource).toContain("--no-backup");
    expect(localRuntimeSource).toContain(
      "--exclude storage-api,imgproxy,postgres-meta,studio,mailpit,edge-runtime,logflare,vector,supavisor",
    );
    expect(localRuntimeSource).not.toContain("--exclude realtime");
    expect(localRuntimeSource).toContain('>"$output_file" 2>&1');
    expect(localRuntimeSource).toContain("credential-bearing CLI output withheld");
    expect(localRuntimeSource).not.toMatch(/\b(?:login|link|db push)\b/u);
    expect(localRuntimeSource).not.toContain("55001");
    expect(localRuntimeSource).not.toContain('cat "');
  });

  it("keeps the Windows local runtime executable-first and credential-silent", () => {
    expect(localRuntimePowerShellSource).toMatch(
      /Get-Command supabase -CommandType Application -ErrorAction Stop \|\s*Select-Object -First 1/u,
    );
    expect(localRuntimePowerShellSource).toContain("-FilePath $supabaseCommand.Source");
    for (const cloudControl of [
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SUPABASE_PROJECT_ID",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]) {
      expect(localRuntimePowerShellSource).toContain(`\"${cloudControl}\"`);
    }
    expect(localRuntimePowerShellSource).toContain(
      '[System.Environment]::SetEnvironmentVariable($name, $null, "Process")',
    );
    expect(localRuntimePowerShellSource).toContain("-WindowStyle Hidden");
    expect(localRuntimePowerShellSource).toContain(
      "storage-api,imgproxy,postgres-meta,studio,mailpit,edge-runtime,logflare,vector,supavisor",
    );
    expect(localRuntimePowerShellSource).not.toContain(
      "realtime,storage-api,imgproxy,postgres-meta,studio,mailpit,edge-runtime,logflare,vector,supavisor",
    );
    expect(localRuntimePowerShellSource).toContain("-RedirectStandardOutput $stdoutPath");
    expect(localRuntimePowerShellSource).toContain("-RedirectStandardError $stderrPath");
    expect(localRuntimePowerShellSource).toContain("credential-bearing CLI output withheld");
    expect(localRuntimePowerShellSource).toContain(
      "Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue",
    );
    expect(localRuntimePowerShellSource).toContain(
      '$arguments = @("stop", "--workdir", $repositoryRoot, "--no-backup")',
    );
    expect(localRuntimePowerShellSource).not.toMatch(/\b(?:login|link|db push)\b/u);
    expect(localRuntimePowerShellSource).not.toMatch(/Get-Content|Write-Host/u);
  });

  it("accepts an already-authenticated Lighthouse session before typing credentials", () => {
    const authenticatedReturn = localLighthouseGuardSource.indexOf(
      'if (new URL(page.url()).pathname.startsWith("/app"))',
    );
    const emailTyping = localLighthouseGuardSource.indexOf('page.type("#email", email)');
    const passwordTyping = localLighthouseGuardSource.indexOf('page.type("#password", password)');
    expect(authenticatedReturn).toBeGreaterThanOrEqual(0);
    expect(localLighthouseGuardSource.slice(authenticatedReturn, emailTyping)).toContain("return;");
    expect(emailTyping).toBeGreaterThan(authenticatedReturn);
    expect(passwordTyping).toBeGreaterThan(authenticatedReturn);
  });

  it("keeps fixture credentials behind readiness and out of workflow output", () => {
    const fixtureSection = safetyCliSource.slice(
      safetyCliSource.indexOf("async function runLocalFixtureCommand("),
      safetyCliSource.indexOf("async function serveCommand("),
    );
    expect(fixtureSection).toContain("runAfterSafetyPreflight");
    expect(fixtureSection.indexOf("runAfterSafetyPreflight")).toBeLessThan(
      fixtureSection.indexOf("SUPABASE_SERVICE_ROLE_KEY"),
    );
    expect(fixtureSection).toContain("seed-fixtures.mjs");
    expect(browserJobs.qualityGate).toContain('> "$fixture_ids"');
    expect(browserJobs.nightly).toContain('> "$fixture_ids"');
    expect(browserJobs.qualityGate).toContain('rm -f -- "$fixture_ids"');
    expect(browserJobs.nightly).toContain('rm -f -- "$fixture_ids"');
  });

  it("allows only the ephemeral loopback Supabase origin in local-authenticated CSP builds", () => {
    expect(nextConfigSource).toContain('process.env.VISUAL_SAFETY_MODE === "local-authenticated"');
    expect(nextConfigSource).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(nextConfigSource).toContain("localVisualSupabaseCspSources");
    expect(nextConfigSource).not.toMatch(/55001|54321/u);
  });

  it("hard-binds the catalog fixture seeder to the configured guarded loopback runtime", () => {
    expect(fixtureSeederSource).toContain('VISUAL_SAFETY_MODE !== "local-authenticated"');
    expect(fixtureSeederSource).toContain("canonicalizeLoopbackOrigin(SUPABASE_URL)");
    expect(fixtureSeederSource).toContain("discoverLocalSupabaseOrigin");
    expect(fixtureSeederSource).toContain("requestedOrigin !== configuredOrigin");
    expect(fixtureSeederSource).toContain("createGuardedFetch");
    expect(fixtureSeederSource).toContain("global: { fetch: guardedFetch }");
    expect(fixtureSeederSource).not.toContain("SUPABASE_URL_STAGING");
    expect(fixtureSeederSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY_STAGING");
  });

  it("requires both safety assertions and local cleanup before browser artifacts upload", () => {
    for (const job of [browserJobs.qualityGate, browserJobs.nightly]) {
      const uploadSection = job.slice(job.indexOf("actions/upload-artifact"));
      expect(uploadSection).toContain("steps.public_safety_assert.outcome == 'success'");
      expect(uploadSection).toContain("steps.auth_safety_assert.outcome == 'success'");
      expect(uploadSection).toContain("steps.local_fixture_teardown.outcome == 'success'");
      expect(uploadSection).toContain("steps.local_supabase_stop.outcome == 'success'");
    }
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
    expect(browserJobs.lighthouse).toContain("npm run visual-safety:lighthouse -- all");
    expect(browserJobs.lighthouse).toContain("VISUAL_SAFETY_MODE: local-authenticated");
    expect(browserJobs.lighthouse).toContain("local-supabase-ci.sh start");
    expect(browserJobs.lighthouse).toContain("visual-safety:fixtures-seed");
    expect(browserJobs.lighthouse).toContain("visual-safety:fixtures-teardown");
    expect(browserJobs.lighthouse).toContain("local-supabase-ci.sh stop");
    expect(browserJobs.lighthouse).toContain("mobile + desktop, five runs each");
    expect(browserJobs.lighthouse).toContain("npm run phase5:lighthouse:report");
    expect(browserJobs.lighthouse).toContain("$RUNNER_TEMP/phase5a0d-lighthouse-evidence");
    expect(browserJobs.lighthouse).toContain("phase5a0d-lighthouse.json");
    expect(browserJobs.lighthouse).toContain("phase5a0d-lighthouse.md");
    expect(browserJobs.lighthouse.indexOf("npm run phase5:lighthouse:report")).toBeGreaterThan(
      browserJobs.lighthouse.indexOf("local-supabase-ci.sh stop"),
    );
    expect(browserJobs.lighthouse).toContain("npx playwright install --with-deps chromium");
    expect(
      browserJobs.lighthouse.indexOf("npx playwright install --with-deps chromium"),
    ).toBeLessThan(browserJobs.lighthouse.indexOf("npm run visual-safety:preflight"));
    expect(workflowSources.lighthouse).not.toContain("temporaryPublicStorage");
    expect(workflowSources.lighthouse).not.toContain("treosh/lighthouse-ci-action");
  });

  it("binds the authoritative Lighthouse report to the literal pull-request head", () => {
    expect(workflowSources.lighthouse).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(workflowSources.lighthouse).toContain(
      'test "$(git rev-parse HEAD)" = "${{ github.event.pull_request.head.sha }}"',
    );
  });

  it("pins the Phase 5A.0d workflow runner, Node patch, and checkout credentials", () => {
    for (const workflow of [
      workflowSources.lighthouse,
      workflowSources.bundleSize,
      workflowSources.phase5Visual,
    ]) {
      expect(workflow).toContain("runs-on: ubuntu-24.04");
      expect(workflow).toContain("node-version: 22.21.1");
      for (const checkout of workflow.split(/uses: actions\/checkout@/u).slice(1)) {
        expect(
          checkout.slice(
            0,
            checkout.indexOf("uses:", 1) < 0 ? undefined : checkout.indexOf("uses:", 1),
          ),
        ).toContain("persist-credentials: false");
      }
    }
  });

  it("pins the exact local Supabase CLI release for Phase 5A.0d exact-head gates", () => {
    const setupAction = "supabase/setup-cli@46f7f98c7f948ad727d22c1e67fab04c223a0520";
    for (const [name, workflow] of Object.entries({
      lighthouse: workflowSources.lighthouse,
      bundleSize: workflowSources.bundleSize,
      phase5Visual: workflowSources.phase5Visual,
      qualityGate: workflowSources.qualityGate,
    })) {
      const setups = workflow.split(setupAction).slice(1);
      expect(setups.length, name).toBeGreaterThan(0);
      for (const setup of setups) {
        const nextStep = setup.indexOf("\n      - name:");
        const setupStep = setup.slice(0, nextStep < 0 ? undefined : nextStep);
        expect(setupStep, name).toMatch(/\n\s+with:\s*\n\s+version: 2\.111\.0(?:\r?\n|$)/u);
      }
    }
  });

  it("separates immutable PR verification from reviewed initial or manual candidates", () => {
    expect(workflowSources.phase5Visual).toContain("pull_request:");
    expect(workflowSources.phase5Visual).toContain("workflow_dispatch:");
    expect(workflowSources.phase5Visual).toContain(
      "codex/phase-5a0d-performance-visual-gates",
    );
    expect(phase5VisualJobs.verify).toContain("github.event_name == 'pull_request'");
    expect(phase5VisualJobs.verify).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(phase5VisualJobs.verify).toContain("fetch-depth: 0");
    expect(phase5VisualJobs.verify).toContain(
      "${{ github.event.pull_request.base.sha }}:frontend/e2e/__screenshots__/phase5a0d-manifest.json",
    );
    expect(phase5VisualJobs.verify).toContain("baseline_state.outputs.exists == 'true'");
    expect(phase5VisualJobs.verify).toContain("git diff --quiet");
    expect(phase5VisualJobs.verify).toContain("provenance=immutable-pr-base");
    expect(phase5VisualJobs.verify).toContain("provenance=initial-candidate-review-required");
    expect(phase5VisualJobs.verify).toContain(
      "baselines are immutable relative to the exact PR base",
    );
    expect(phase5VisualJobs.verify).toContain("phase5:visual:verify:public");
    expect(phase5VisualJobs.verify).toContain("phase5:visual:verify:authenticated");
    expect(phase5VisualJobs.verify).not.toContain("phase5:visual:generate:");
    expect(phase5VisualJobs.verify).not.toContain("--update-snapshots");
    expect(phase5VisualJobs.verify).toContain("Select and seal the exact visual verifier");
    expect(phase5VisualJobs.verify).toContain('source="pr-base"');
    expect(phase5VisualJobs.verify).toContain("synchronized-phase5a0d-bootstrap-review-required");
    expect(phase5VisualJobs.verify).toContain("Synchronized visual-bootstrap ancestry cannot be proven");
    expect(phase5VisualJobs.verify).toContain("Reviewed Phase 5A.0d visual baseline bytes changed");
    expect(phase5VisualJobs.verify).toContain("The synchronized PR base contains changes outside");
    expect(phase5VisualJobs.verify).toContain("2b097bbe9eb0b3501421f1250972c98ce24ce60b");
    expect(phase5VisualJobs.verify).toContain(
      'approved_phase5a0e_authenticated_a11y_blob="d2cec5ed670a6d7b31372b1fd3499f544c2d77d1"',
    );
    expect(phase5VisualJobs.verify).toContain('approved_security_nanoid_override="3.3.17"');
    expect(phase5VisualJobs.verify).toContain(
      "The approved Phase 5A.0e authenticated accessibility spec changed after synchronization.",
    );
    expect(phase5VisualJobs.verify).toContain(
      "^frontend/e2e/authenticated-a11y\\.spec\\.ts$",
    );
    expect(phase5VisualJobs.verify).toContain(
      "synchronized visual package changed outside dependency versions or the approved nanoid security override",
    );
    expect(phase5VisualJobs.verify).toContain(
      "synchronized visual package does not preserve the approved nanoid security override",
    );
    expect(phase5VisualJobs.verify).toContain("does not preserve the exact current-main lockfile");
    expect(phase5VisualJobs.verify).toContain("Re-attest and restore the exact visual verifier");
    expect(phase5VisualJobs.verify).toContain("phase5a0d-reviewed-visual-verifier.tar");
    expect(phase5VisualJobs.verify).toContain("steps.verifier_policy.outputs.archive_sha256");
    expect(phase5VisualJobs.verify).toContain("steps.verifier_policy.outputs.package_sha256");
    expect(phase5VisualJobs.verify).toContain(
      "manifest.sourceCommit !== \"string\"",
    );
    expect(phase5VisualJobs.verify).toContain(
      "immutable visual manifest references an unavailable baseline runtime commit",
    );
    expect(phase5VisualJobs.verify).toContain("phase5a0d-baseline-runtime-package-lock.json");
    expect(phase5VisualJobs.verify).toContain(
      "Install the manifest-attested baseline runtime without manifest mutation",
    );
    expect(phase5VisualJobs.verify).toContain(
      "manifest-attested Playwright package was not installed",
    );
    expect(phase5VisualJobs.verify).toContain(
      "git diff --quiet HEAD -- frontend/package.json frontend/package-lock.json",
    );
    expect(phase5VisualJobs.verify).toContain("current.scripts = scripts");
    expect(phase5VisualJobs.verify).toContain("npm ci --ignore-scripts");
    expect(phase5VisualJobs.verify).toContain("npx playwright install --with-deps chromium");
    expect(phase5VisualJobs.verify).toContain(
      'test "$(git rev-parse HEAD)" = "${{ github.event.pull_request.head.sha }}"',
    );
    expect(phase5VisualJobs.verify).toContain("git diff --quiet HEAD --");
    expect(phase5VisualJobs.verify.indexOf("Install dependencies")).toBeLessThan(
      phase5VisualJobs.verify.indexOf("Re-attest and restore the exact visual verifier"),
    );
    expect(
      phase5VisualJobs.verify.indexOf(
        "Install the manifest-attested baseline runtime without manifest mutation",
      ),
    ).toBeLessThan(
      phase5VisualJobs.verify.indexOf("Re-attest and restore the exact visual verifier"),
    );
    expect(phase5VisualJobs.generate).toContain(
      "ref: ${{ github.event.pull_request.head.sha || github.sha }}",
    );
    expect(phase5VisualJobs.generate).toContain("fetch-depth: 0");
    expect(phase5VisualJobs.generate).toContain('[ "${{ github.event_name }}" = "pull_request" ]');
    expect(phase5VisualJobs.generate).toContain("baseline_state.outputs.generate == 'true'");
    expect(phase5VisualJobs.generate).toContain(
      "${{ github.event.pull_request.base.sha }}:frontend/e2e/__screenshots__/phase5a0d-manifest.json",
    );
    expect(
      workflowSources.phase5Visual.match(/Bootstrap generation is forbidden\./gu),
    ).toHaveLength(2);
    expect(
      workflowSources.phase5Visual.match(/exact PR base commit is unavailable/gu),
    ).toHaveLength(2);
    expect(phase5VisualJobs.generate).toContain(
      "Committed baselines exist; PR candidate generation is disabled.",
    );
    expect(phase5VisualJobs.generate).toContain(
      "Initial baseline bootstrap will upload candidates for human review only.",
    );
    expect(
      phase5VisualJobs.generate.match(/run: npm run phase5:visual:generate:public/gu),
    ).toHaveLength(2);
    expect(
      phase5VisualJobs.generate.match(/run: npm run phase5:visual:generate:authenticated/gu),
    ).toHaveLength(2);
    expect(
      phase5VisualJobs.generate.match(/^\s+npm run phase5:visual:manifest:generate$/gmu),
    ).toHaveLength(2);
    expect(phase5VisualJobs.generate).toContain("phase5a0d-first.sha256");
    expect(phase5VisualJobs.generate).toContain("phase5a0d-second.sha256");
    expect(phase5VisualJobs.generate).toContain("cmp --silent");
    expect(phase5VisualJobs.generate).toContain("byte_identical=true");
    expect(phase5VisualJobs.generate).toContain(
      "!cancelled() && steps.baseline_state.outputs.generate == 'true'",
    );
    expect(phase5VisualJobs.generate).toContain(
      "steps.second_public_generate.outcome != 'skipped'",
    );
    expect(
      phase5VisualJobs.generate.match(/^\s+npm run --silent phase5:visual:artifact:stage -- /gmu),
    ).toHaveLength(2);
    expect(phase5VisualJobs.generate).toContain(
      "Seal the exact candidate generator before dependency lifecycle scripts",
    );
    expect(phase5VisualJobs.generate).toContain(
      "Re-attest and restore the exact candidate generator",
    );
    expect(phase5VisualJobs.generate).toContain("steps.candidate_harness.outputs.archive_sha256");
    expect(phase5VisualJobs.generate).toContain("steps.candidate_harness.outputs.package_sha256");
    expect(phase5VisualJobs.generate).toContain("current.scripts = scripts");
    expect(phase5VisualJobs.generate).toContain("npm ci --ignore-scripts");
    expect(phase5VisualJobs.generate).toContain("npm ci --ignore-scripts --prefer-offline");
    expect(phase5VisualJobs.generate).toContain(
      'test "$(git rev-parse HEAD)" = "${{ steps.candidate_harness.outputs.source_sha }}"',
    );
    expect(phase5VisualJobs.generate).toContain("git diff --quiet HEAD --");
    expect(phase5VisualJobs.generate.indexOf("Install dependencies")).toBeLessThan(
      phase5VisualJobs.generate.indexOf("Re-attest and restore the exact candidate generator"),
    );
    expect(
      phase5VisualJobs.generate.indexOf("Install lockfile-pinned Playwright Chromium"),
    ).toBeLessThan(
      phase5VisualJobs.generate.indexOf("Re-attest and restore the exact candidate generator"),
    );
    expect(phase5VisualJobs.generate).toContain("phase5a0d-second-candidates/");
    expect(phase5VisualJobs.generate).not.toContain("path: frontend/e2e/__screenshots__/");
    expect(phase5VisualJobs.generate).not.toContain("git commit");
    expect(phase5VisualJobs.generate).not.toContain("git push");
  });

  it("runs every required Phase 5A.0e PR gate on the reviewed stacked base", () => {
    const stackedBase = "codex/phase-5a0d-performance-visual-gates";
    const stackedGateWorkflows = {
      bundleSize: workflowSources.bundleSize,
      codeql: workflowSources.codeql,
      lighthouse: workflowSources.lighthouse,
      phase5Visual: workflowSources.phase5Visual,
      prGate: workflowSources.prGate,
      prScreenshots: workflowSources.prScreenshots,
      prTitle: workflowSources.prTitle,
      qualityGate: workflowSources.qualityGate,
      repoVerify: workflowSources.repoVerify,
    };

    for (const [name, workflow] of Object.entries(stackedGateWorkflows)) {
      expect(workflowEventSection(workflow, "pull_request"), name).toContain(stackedBase);
    }
  });

  it("keeps route measurement read-only and retains truthful Lighthouse debt evidence", () => {
    expect(workflowSources.bundleSize).toMatch(/permissions:\s*\n\s+contents: read/u);
    expect(workflowSources.bundleSize).not.toContain("pull-requests: write");
    expect(workflowSources.bundleSize).not.toContain("actions/github-script");

    const lighthouseJob = browserJobs.lighthouse;
    const stageIndex = lighthouseJob.indexOf("Stage complete compact Lighthouse evidence");
    const stageSection = lighthouseJob.slice(
      stageIndex,
      lighthouseJob.indexOf("Upload compact Lighthouse evidence", stageIndex),
    );
    expect(stageSection).toContain("steps.lighthouse_report.outcome != 'skipped'");
    expect(stageSection).toContain("steps.lighthouse_report.outcome != 'cancelled'");
    expect(stageSection).not.toContain("steps.lighthouse_report.outcome == 'success'");
    expect(stageSection).toContain("steps.local_fixture_teardown.outcome == 'success'");
    expect(stageSection).toContain("steps.local_supabase_stop.outcome == 'success'");
    expect(stageSection).toContain("test -s lighthouse-reports/phase5a0d-lighthouse.json");
    expect(stageSection).toContain("test -s lighthouse-reports/phase5a0d-lighthouse.md");
    const uploadSection = lighthouseJob.slice(
      lighthouseJob.indexOf("Upload compact Lighthouse evidence"),
    );
    expect(uploadSection).toContain("steps.lighthouse_evidence_stage.outcome == 'success'");
  });

  it("keeps visual artifacts behind safety assertions and local cleanup", () => {
    for (const job of Object.values(phase5VisualJobs)) {
      const uploadIndex = job.indexOf("actions/upload-artifact");
      const uploadStep = job.slice(job.lastIndexOf("      - name:", uploadIndex), uploadIndex);
      expect(uploadStep).toContain("safety_assert.outcome == 'success'");
      expect(uploadStep).toContain("fixture_teardown.outcome == 'success'");
      expect(uploadStep).toContain("local_supabase_stop.outcome == 'success'");
      expect(uploadIndex).toBeGreaterThan(job.lastIndexOf("local-supabase-ci.sh stop"));
    }
  });

  it("replaces manifest byte counting with same-runner cold route capture", () => {
    const bundle = workflowSources.bundleSize;
    expect(bundle.match(/^  compare:\s*$/gmu)).toHaveLength(1);
    expect(bundle).not.toMatch(/^  (?:baseline|head):\s*$/mu);
    expect(bundle).toContain("Checkout pull-request base");
    expect(bundle).toContain("Checkout pull-request head on the same runner");
    expect(bundle).toContain("source=pr-base");
    expect(bundle).toContain("source=synchronized-phase5a0d-bootstrap");
    expect(bundle).toContain('echo "trusted=true"');
    expect(bundle).toContain('echo "trusted=false"');
    expect(bundle).toContain("Bootstrap evidence is informational");
    expect(bundle).toContain("steps.route_evidence_stage.outcome");
    expect(bundle).toContain("f03a79c97f9edc495a62fa02e89c45938a42fc6e");
    expect(bundle).toContain("2b097bbe9eb0b3501421f1250972c98ce24ce60b");
    expect(bundle).toContain(
      'approved_phase5a0e_authenticated_a11y_blob="d2cec5ed670a6d7b31372b1fd3499f544c2d77d1"',
    );
    expect(bundle).toContain('approved_security_nanoid_override="3.3.17"');
    expect(bundle).toContain(
      "The approved Phase 5A.0e authenticated accessibility spec changed after synchronization.",
    );
    expect(bundle).toContain("^frontend/e2e/authenticated-a11y\\.spec\\.ts$");
    expect(bundle).toContain("Synchronized bootstrap ancestry cannot be proven");
    expect(bundle).toContain(
      "synchronized package changed outside dependency versions or the approved nanoid security override",
    );
    expect(bundle).toContain("synchronized package does not preserve the approved nanoid security override");
    expect(bundle).toContain("does not preserve the exact current-main lockfile");
    expect(bundle).toContain("phase5a0d-reviewed-route-js-harness.tar");
    expect(bundle).toContain("Re-attest and restore the reviewed base harness onto head");
    expect(bundle).toContain("steps.harness_policy.outputs.archive_sha256");
    expect(bundle).toContain("steps.harness_policy.outputs.package_sha256");
    expect(bundle).toContain("steps.preserve_base_report.outputs.sha256");
    expect(bundle).toContain("current.scripts = scripts");
    expect(bundle).toContain('NPM_CONFIG_IGNORE_SCRIPTS: "true"');
    expect(bundle).toContain("npm ci --ignore-scripts");
    expect(bundle).toContain("npm ci --ignore-scripts --prefer-offline");
    expect(bundle).toContain(
      'test "$(git rev-parse HEAD)" = "${{ github.event.pull_request.head.sha }}"',
    );
    expect(bundle).toContain("git diff --quiet HEAD --");
    expect(bundle.indexOf("Install head dependencies")).toBeLessThan(
      bundle.indexOf("Re-attest and restore the reviewed base harness onto head"),
    );
    expect(bundle.indexOf("Install head lockfile-pinned Chromium")).toBeLessThan(
      bundle.indexOf("Re-attest and restore the reviewed base harness onto head"),
    );
    expect(bundle).toContain("The synchronized PR base contains changes outside");
    expect(bundle.match(/run: npm run phase5:route-js:public/gu)).toHaveLength(2);
    expect(bundle.match(/run: npm run phase5:route-js:authenticated/gu)).toHaveLength(2);
    expect(bundle).toContain("--mode=public");
    expect(bundle).toContain("--mode=local-authenticated");
    expect(bundle).toContain("--baseline=performance-reports/route-js/base-route-js.json");
    expect(bundle).toContain("--current=performance-reports/route-js/head-route-js.json");
    expect(bundle).toContain("+10 KiB OR +5% fails; reductions pass");
    expect(bundle).not.toContain("build-manifest.json");
    expect(bundle).not.toContain("totalBytes");
    expect(bundle).not.toContain("Math.abs");
  });

  it("ships the pinned Inter test fixture with exact source and OFL notice", () => {
    const fixtureRoot = path.join(repoRoot, "frontend", "e2e", "fixtures", "phase5a0d");
    const fixture = readFileSync(path.join(fixtureRoot, "inter-bold-c1c6ba11.ttf"));
    const notice = readFileSync(path.join(fixtureRoot, "inter-bold-c1c6ba11.OFL.txt"), "utf8");
    expect(fixture).toHaveLength(344_068);
    expect(createHash("sha256").update(fixture).digest("hex")).toBe(
      "c1c6ba111e8d04d392b741d194ab548186ec3c006ed7cc134be0525402520339",
    );
    expect(notice).toContain("Copyright 2020 The Inter Project Authors");
    expect(notice).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(notice).toContain(
      "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf",
    );
    expect(notice).toContain("c1c6ba111e8d04d392b741d194ab548186ec3c006ed7cc134be0525402520339");
  });

  it("runs authenticated visual and performance gates for migration changes", () => {
    for (const workflow of [
      workflowSources.lighthouse,
      workflowSources.bundleSize,
      workflowSources.phase5Visual,
      workflowSources.qualityGate,
    ]) {
      expect(workflow).toContain('- "supabase/migrations/**"');
    }
  });

  it("keeps authoritative Phase 5A.0d Lighthouse enforcement separate from Quality Gate", () => {
    expect(browserJobs.qualityGate).not.toContain("visual-safety:lighthouse");
    expect(browserJobs.qualityGate).toContain("Quality Gate contains no Lighthouse execution");
    expect(browserJobs.qualityGate).toContain(
      "separate guarded Phase 5A.0d Lighthouse workflow owns public and local-authenticated Mobile and Desktop five-run enforcement",
    );
    expect(browserJobs.qualityGate).toContain("0.66, 0.69, and 0.64");
    expect(browserJobs.qualityGate).toContain("corrected measurement-contract defect");
    expect(browserJobs.qualityGate).toContain("not as a current pass or current gate result");
  });

  it("pins the unchanged Phase 5A.0d Lighthouse configurations", () => {
    const expected = {
      "lighthouserc.mobile.js": "fa45c8b29b23c2657211b95a9214e65c729b951f640e0038e21fa06b3aa5b18b",
      "lighthouserc.desktop.js": "7ae0868a372b65c37a9458b62dfb252078af9260498ba9ed2b6de9198182fb2b",
    } as const;
    for (const [filename, digest] of Object.entries(expected)) {
      const source = readFileSync(path.join(repoRoot, "frontend", filename), "utf8").replace(
        /\r\n/gu,
        "\n",
      );
      expect(createHash("sha256").update(source).digest("hex")).toBe(digest);
    }
  });

  it("contains opaque Chromium CONNECTs only inside the Lighthouse page guard", () => {
    const serveSection = safetyCliSource.slice(
      safetyCliSource.indexOf("async function serveCommand("),
      safetyCliSource.indexOf("async function assertCommand("),
    );
    const lighthouseSection = safetyCliSource.slice(
      safetyCliSource.indexOf("async function runLighthouse("),
      safetyCliSource.indexOf("async function main()"),
    );

    expect(serveSection).not.toContain('opaqueConnectPolicy: "contain"');
    expect(lighthouseSection).toContain('opaqueConnectPolicy: "contain"');
    expect(lighthouseSection).toContain("lighthouse-public-guard.cjs");
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
    expect(packageScripts.build).toBe("next build --webpack");
    expect(packageScripts["quality:smoke"]).toContain("--quality-level=smoke");
    expect(packageScripts["quality:full"]).toContain("--quality-level=full");
    expect(packageScripts["lighthouse:mobile"]).toContain("visual-safety:public-lighthouse");
    expect(packageScripts["lighthouse:desktop"]).toContain("visual-safety:public-lighthouse");
    expect(safetyCliSource).toMatch(
      /commandEnvironment\.VISUAL_SAFETY_MODE = mode;[\s\S]*loadSafetyContractFromEnvironment\(commandEnvironment\)/u,
    );
    expect(safetyCliSource).toContain("resetGeneratedServiceWorker()");
    expect(safetyCliSource).toContain("assertGeneratedServiceWorker()");
    expect(safetyCliSource).toMatch(
      /pathToFileURL\(localFontFetchPreload\)\.href,\s*nextCli,\s*"build"/u,
    );
    expect(safetyCliSource).toMatch(
      /pathToFileURL\(localFontFetchPreload\)\.href,\s*\.\.\.fixedTimeArguments,\s*nextCli,\s*"start"/u,
    );
    expect(nextConfigSource).toContain("register: !process.env.VISUAL_SAFETY_MODE");
    for (const workflow of [
      workflowSources.prGate,
      workflowSources.mainGate,
      workflowSources.nightly,
    ]) {
      expect(workflow).toContain("run: npm run build");
      expect(workflow).not.toContain("run: npx next build");
    }
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
