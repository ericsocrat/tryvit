// ─── E2E test user lifecycle ─────────────────────────────────────────────────
// Creates and tears down a Supabase Auth user for authenticated Playwright tests.
// Requires explicit local-authenticated mode and a guarded local Admin API.

import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
// Node's type-stripping loader requires the source extension when this helper
// is invoked by the guarded Lighthouse launcher.
// prettier-ignore
// @ts-expect-error TS5097: also bundled normally by Playwright.
import { VisualSafetyError, createGuardedFetch, createGuardedWebSocketConstructor, loadSafetyContractFromEnvironment } from "./visual-safety.ts";
// prettier-ignore
// @ts-expect-error TS5097: also executed by the guarded Node launcher.
import { VISUAL_FIXTURE_CONTRACT } from "../../tooling/phase5a0d-contract.ts";

export const TEST_EMAIL = "e2e-playwright-auth@test.tryvit.local";
export const FUNCTIONAL_TEST_EMAIL = "e2e-playwright-functional@test.tryvit.local";
export const TEST_PASSWORD = "PlaywrightTest123!";
const WebSocketImplementation = WebSocket as unknown as WebSocketLikeConstructor;

type TestUserScope = "authenticated" | "functional";

function getScopeEmail(scope: TestUserScope): string {
  return scope === "functional" ? FUNCTIONAL_TEST_EMAIL : TEST_EMAIL;
}

export function getGuardedFixtureRequest(): {
  readonly origin: string;
  readonly serviceRoleKey: string;
  readonly fetch: typeof fetch;
} {
  const contract = loadSafetyContractFromEnvironment(process.env);
  if (contract.mode !== "local-authenticated") {
    throw new VisualSafetyError("VS_FIXTURE_MODE", "fixture.local-only");
  }
  // Read the credential only after the canonical local origin guard passes.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new VisualSafetyError("VS_FIXTURE_CREDENTIAL", "fixture.local-service-role-missing");
  }
  return {
    origin: contract.supabaseOrigin,
    serviceRoleKey,
    fetch: createGuardedFetch({ allowedOrigin: contract.supabaseOrigin }),
  };
}

export function getAdminClient(): SupabaseClient {
  const runtime = getGuardedFixtureRequest();
  const WebSocketTransport = createGuardedWebSocketConstructor({
    allowedOrigin: runtime.origin,
    WebSocketImpl: WebSocketImplementation,
  });

  return createClient(runtime.origin, runtime.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: runtime.fetch },
    realtime: { transport: WebSocketTransport },
  });
}

/**
 * Find the test user by email using paginated search.
 * Stops early when found instead of loading all users.
 */
async function findTestUserById(supabase: SupabaseClient, email: string): Promise<string | null> {
  const PAGE_SIZE = 50;
  let page = 1;

  while (true) {
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });

    if (error) {
      throw new VisualSafetyError("VS_FIXTURE_ADMIN", "fixture.list-users");
    }

    const match = users.find((u) => u.email === email);
    if (match) return match.id;

    // No more pages
    if (users.length < PAGE_SIZE) return null;
    page++;
  }
}

/** Delete any existing test user, then create a fresh auto-confirmed one. */
export async function ensureScopedTestUser(scope: TestUserScope): Promise<string> {
  const supabase = getAdminClient();
  const email = getScopeEmail(scope);

  // Remove stale test user if present (idempotent) — paginated search
  const existingId = await findTestUserById(supabase, email);
  if (existingId) {
    const { error } = await supabase.auth.admin.deleteUser(existingId);
    if (error) {
      throw new VisualSafetyError("VS_FIXTURE_ADMIN", "fixture.delete-user");
    }
  }

  // Create fresh, pre-confirmed user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    throw new VisualSafetyError("VS_FIXTURE_ADMIN", "fixture.create-user");
  }

  const userId = data.user.id;

  // Pre-create preferences: skip onboarding + force English so E2E tests
  // see English text (api_skip_onboarding sets country=PL which triggers
  // LanguageHydrator to switch to Polish, breaking English-only assertions).
  const { error: prefError } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    country: VISUAL_FIXTURE_CONTRACT.localAuthenticatedNewUser.preferences.country,
    preferred_language:
      VISUAL_FIXTURE_CONTRACT.localAuthenticatedNewUser.preferences.preferredLanguage,
    onboarding_completed:
      VISUAL_FIXTURE_CONTRACT.localAuthenticatedNewUser.preferences.onboardingCompleted,
    onboarding_skipped:
      VISUAL_FIXTURE_CONTRACT.localAuthenticatedNewUser.preferences.onboardingSkipped,
  });

  if (prefError) {
    throw new VisualSafetyError("VS_FIXTURE_ADMIN", "fixture.preferences");
  }

  return userId;
}

/** Default user for authenticated project setup (backward compatible). */
export async function ensureTestUser(): Promise<string> {
  return ensureScopedTestUser("authenticated");
}

/** Delete the test user (best-effort cleanup). */
export async function deleteScopedTestUser(scope: TestUserScope): Promise<void> {
  const supabase = getAdminClient();
  const email = getScopeEmail(scope);

  const userId = await findTestUserById(supabase, email);
  if (userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new VisualSafetyError("VS_FIXTURE_ADMIN", "fixture.delete-user");
    }
  }
}

/** Delete default authenticated project user (backward compatible). */
export async function deleteTestUser(): Promise<void> {
  return deleteScopedTestUser("authenticated");
}

export function getScopedTestCredentials(scope: TestUserScope): {
  email: string;
  password: string;
} {
  return {
    email: getScopeEmail(scope),
    password: TEST_PASSWORD,
  };
}
