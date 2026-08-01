// ─── Global teardown: delete the e2e test user ─────────────────────────────
// Cleanup is blocking: a rejected or incomplete local deletion fails the run.

import { deleteScopedTestUser } from "./helpers/test-user";
import { loadSafetyContractFromEnvironment } from "./helpers/visual-safety";

async function globalTeardown() {
  const contract = loadSafetyContractFromEnvironment(process.env);
  if (contract.mode !== "local-authenticated") return;

  await Promise.all([
    deleteScopedTestUser("authenticated"),
    deleteScopedTestUser("functional"),
  ]);
}

export default globalTeardown;
