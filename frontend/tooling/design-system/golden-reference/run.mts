import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { goldenCandidateRoot } from "./capture-contract.ts";
// Node executes this tooling directly, so the TypeScript path alias is unavailable.
// eslint-disable-next-line no-restricted-imports
import {
  assertSafeDirectoryRoot,
  ensureOwnedDirectory,
  removeOwnedDirectory,
} from "../direction-selection/evidence-safety.ts";
// eslint-disable-next-line no-restricted-imports
import {
  captureNextEnvSourceSnapshot,
  withNextEnvSourceRestoration,
} from "../direction-selection/next-env-source.ts";

function git(frontendRoot: string, args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd: path.resolve(frontendRoot, ".."),
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    throw new Error("[P5A2_GOLDEN] git-provenance-failed");
  }
  return result.stdout.trimEnd();
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = assertSafeDirectoryRoot(
  path.resolve(toolingDirectory, "..", "..", ".."),
  "frontend-root",
);
if (git(frontendRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) {
  throw new Error("[P5A2_GOLDEN] source-worktree-not-clean");
}
const sourceSha = git(frontendRoot, ["rev-parse", "HEAD"]);
const sourceTreeSha = git(frontendRoot, ["rev-parse", "HEAD^{tree}"]);
if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) {
  throw new Error("[P5A2_GOLDEN] source-provenance-invalid");
}

const candidateRoot = goldenCandidateRoot(frontendRoot);
if (
  path.dirname(candidateRoot) !== path.join(frontendRoot, "test-results") ||
  path.basename(candidateRoot) !== "phase5a2-golden-candidates"
) throw new Error("[P5A2_GOLDEN] candidate-root-invalid");
ensureOwnedDirectory(frontendRoot, ["test-results"], "golden-candidate-parent");
removeOwnedDirectory(
  frontendRoot,
  ["test-results", "phase5a2-golden-candidates"],
  "golden-candidate-cleanup",
);

const visualSafetyCli = path.join(frontendRoot, "e2e", "scripts", "visual-safety-cli.mts");
const environment = {
  ...process.env,
  NEXT_PUBLIC_QA_MODE: "0",
  PHASE5A2_GOLDEN: "true",
  PHASE5A2_DIRECTION_SELECTION: "1",
  PHASE5A2_GOLDEN_SOURCE_SHA: sourceSha,
  PHASE5A2_GOLDEN_SOURCE_TREE_SHA: sourceTreeSha,
};

const nextEnvSnapshot = captureNextEnvSourceSnapshot(frontendRoot);
const result = withNextEnvSourceRestoration(
  nextEnvSnapshot,
  () => spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      visualSafetyCli,
      "local-authenticated",
      "--project=phase5a2-golden-chromium",
      "--project=phase5a2-golden-firefox",
      "--project=phase5a2-golden-webkit",
      "--project=phase5a2-golden-resilience",
      "--project=phase5a2-golden-coarse",
      "--project=phase5a2-golden-no-javascript",
      "--project=phase5a2-golden-capture",
      "--project=phase5a2-golden-motion",
      "--project=phase5a2-golden-performance",
      "--workers=1",
      "--retries=0",
      "--reporter=list",
    ],
    { cwd: frontendRoot, env: environment, stdio: "inherit" },
  ),
  () => git(frontendRoot, ["status", "--porcelain=v1", "--untracked-files=all"]),
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

for (const script of ["verify-candidates.mts", "stage-evidence.mts"]) {
  const command = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      path.join(toolingDirectory, script),
    ],
    { cwd: frontendRoot, env: environment, stdio: "inherit" },
  );
  if (command.error) throw command.error;
  if (command.status !== 0) process.exit(command.status ?? 1);
}
