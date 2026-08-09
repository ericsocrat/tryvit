import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const catalogToolingDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(catalogToolingDirectory, "..", "..", "..");
const visualSafetyCli = path.join(frontendRoot, "e2e", "scripts", "visual-safety-cli.mts");

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
    env: {
      ...process.env,
      NEXT_PUBLIC_QA_MODE: "1",
      PHASE5A1_CATALOG: "1",
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
