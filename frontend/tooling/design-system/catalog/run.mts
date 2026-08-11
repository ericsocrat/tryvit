import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const catalogToolingDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(catalogToolingDirectory, "..", "..", "..");
const visualSafetyCli = path.join(frontendRoot, "e2e", "scripts", "visual-safety-cli.mts");
const checkoutSha = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: path.resolve(frontendRoot, ".."),
  encoding: "utf8",
}).stdout.trim();
const catalogEnvironment = {
  ...process.env,
  NEXT_PUBLIC_QA_MODE: "1",
  PHASE5A1_CATALOG: "1",
  PHASE5A1_CATALOG_SOURCE_SHA: process.env.PHASE5A1_CATALOG_SOURCE_SHA ?? checkoutSha,
  PHASE5A1_CATALOG_PR_HEAD_SHA:
    process.env.PHASE5A1_CATALOG_PR_HEAD_SHA ?? checkoutSha,
};

const result = spawnSync(
  process.execPath,
  [
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--experimental-strip-types",
    visualSafetyCli,
    "local-authenticated",
    "--project=phase5a1-catalog",
    "--reporter=html,list",
  ],
  {
    cwd: frontendRoot,
    env: catalogEnvironment,
    stdio: "inherit",
  },
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
      path.join(catalogToolingDirectory, "verify-candidates.mts"),
    ],
    {
      cwd: frontendRoot,
      env: catalogEnvironment,
      stdio: "inherit",
    },
  );
  if (verification.error) throw verification.error;
  process.exitCode = verification.status ?? 1;
}
