// ─── Global teardown: delete the e2e test user ─────────────────────────────
// Best-effort cleanup — does not fail the run if deletion errors out.

import { deleteScopedTestUser } from "./helpers/test-user";

async function globalTeardown() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    await Promise.all([
      deleteScopedTestUser("authenticated"),
      deleteScopedTestUser("functional"),
    ]);
  } catch {
    // Non-fatal — user may already be gone or may not have been created
    console.warn("⚠️  Could not delete e2e test user (non-fatal)");
  }
}

export default globalTeardown;
