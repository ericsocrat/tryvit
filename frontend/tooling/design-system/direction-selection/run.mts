import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDirectionSelectionCandidateRoot } from "./capture-contract.ts";
import {
  assertSafeDirectoryRoot,
  ensureOwnedDirectory,
  removeOwnedDirectory,
} from "./evidence-safety.ts";
import {
  captureNextEnvSourceSnapshot,
  withNextEnvSourceRestoration,
} from "./next-env-source.ts";

function git(frontendRoot: string, args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd: path.resolve(frontendRoot, ".."),
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("[P5A2_EVIDENCE] git-provenance-failed");
  return result.stdout.trim();
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = assertSafeDirectoryRoot(
  path.resolve(toolingDirectory, "..", "..", ".."),
  "frontend-root",
);
const visualSafetyCli = path.join(frontendRoot, "e2e", "scripts", "visual-safety-cli.mts");
const sourceStatus = git(frontendRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
if (sourceStatus) {
  throw new Error("[P5A2_EVIDENCE] source-worktree-not-clean");
}
const sourceSha = git(frontendRoot, ["rev-parse", "HEAD"]);
const sourceTreeSha = git(frontendRoot, ["rev-parse", "HEAD^{tree}"]);
if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) {
  throw new Error("[P5A2_EVIDENCE] source-provenance-invalid");
}

const candidateRoot = getDirectionSelectionCandidateRoot(frontendRoot);
if (
  path.dirname(candidateRoot) !== path.join(frontendRoot, "test-results") ||
  path.basename(candidateRoot) !== "phase5a2-direction-selection-candidates"
) {
  throw new Error("[P5A2_EVIDENCE] candidate-root-invalid");
}
ensureOwnedDirectory(frontendRoot, ["test-results"], "candidate-parent");
removeOwnedDirectory(
  frontendRoot,
  ["test-results", "phase5a2-direction-selection-candidates"],
  "candidate-cleanup",
);

const environment = {
  ...process.env,
  // QA mode globally disables every transition and animation. This review has
  // its own deterministic fixtures and must preserve the full-motion studies.
  NEXT_PUBLIC_QA_MODE: "0",
  PHASE5A2_DIRECTION_BEHAVIOR: "true",
  PHASE5A2_DIRECTION_REVIEW: "true",
  PHASE5A2_DIRECTION_SELECTION: "1",
  PHASE5A2_DIRECTION_SOURCE_SHA: sourceSha,
  PHASE5A2_DIRECTION_SOURCE_TREE_SHA: sourceTreeSha,
};

const nextEnvSourceSnapshot = captureNextEnvSourceSnapshot(frontendRoot);
const result = withNextEnvSourceRestoration(
  nextEnvSourceSnapshot,
  () =>
    spawnSync(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        visualSafetyCli,
        "local-authenticated",
        "--project=phase5a2-direction-behavior",
        "--project=phase5a2-direction-stills",
        "--project=phase5a2-direction-motion",
        "--project=phase5a2-direction-scanner",
        "--workers=1",
        "--reporter=list",
      ],
      {
        cwd: frontendRoot,
        env: environment,
        stdio: "inherit",
      },
    ),
  () => git(frontendRoot, ["status", "--porcelain=v1", "--untracked-files=all"]),
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  const verification = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      path.join(toolingDirectory, "verify-candidates.mts"),
    ],
    {
      cwd: frontendRoot,
      env: environment,
      stdio: "inherit",
    },
  );
  if (verification.error) throw verification.error;
  process.exitCode = verification.status ?? 1;
}
