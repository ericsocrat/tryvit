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
export const REVOCATION_TEST_EMAIL = "e2e-playwright-revocation@test.tryvit.local";
export const TEST_PASSWORD = "PlaywrightTest123!";
const WebSocketImplementation = WebSocket as unknown as WebSocketLikeConstructor;

export type TestUserScope = "authenticated" | "functional";

export type ScopedTestSession = Readonly<{
  accessToken: string;
  anonKey: string;
  userId: string;
}>;

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
 * Create an in-memory user session for guarded browser transport probes.
 *
 * The session is intentionally never persisted or logged. The local-origin
 * contract is proven before the public anon key is read, and the guarded
 * transport prevents any hosted fallback.
 */
export async function getScopedTestSession(scope: TestUserScope): Promise<ScopedTestSession> {
  const runtime = getGuardedFixtureRequest();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new VisualSafetyError("VS_FIXTURE_CREDENTIAL", "fixture.local-anon-key-missing");
  }

  const WebSocketTransport = createGuardedWebSocketConstructor({
    allowedOrigin: runtime.origin,
    WebSocketImpl: WebSocketImplementation,
  });
  const client = createClient(runtime.origin, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: runtime.fetch },
    realtime: { transport: WebSocketTransport },
  });
  const { data, error } = await client.auth.signInWithPassword(getScopedTestCredentials(scope));

  if (error || !data.session?.access_token || !data.user?.id) {
    throw new VisualSafetyError("VS_FIXTURE_AUTH", "fixture.user-session");
  }

  return Object.freeze({
    accessToken: data.session.access_token,
    anonKey,
    userId: data.user.id,
  });
}

/**
 * Prove real server-side global sign-out without revoking either shared
 * Playwright identity. Supabase access JWTs remain valid until expiry; the
 * server-side contract asserted here is destruction of the refresh session.
 */
export async function proveDisposableGlobalSignOutRevocation(): Promise<void> {
  const runtime = getGuardedFixtureRequest();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new VisualSafetyError("VS_FIXTURE_CREDENTIAL", "revocation.local-anon-key-missing");
  }

  const admin = getAdminClient();
  const staleId = await findTestUserById(admin, REVOCATION_TEST_EMAIL);
  if (staleId) {
    const { error } = await admin.auth.admin.deleteUser(staleId);
    if (error) throw new VisualSafetyError("VS_FIXTURE_ADMIN", "revocation.delete-stale-user");
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: REVOCATION_TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user?.id) {
    throw new VisualSafetyError("VS_FIXTURE_ADMIN", "revocation.create-user");
  }

  const guardedClient = () => {
    const WebSocketTransport = createGuardedWebSocketConstructor({
      allowedOrigin: runtime.origin,
      WebSocketImpl: WebSocketImplementation,
    });
    return createClient(runtime.origin, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: runtime.fetch },
      realtime: { transport: WebSocketTransport },
    });
  };

  try {
    const client = guardedClient();
    const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
      email: REVOCATION_TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const refreshToken = signedIn.session?.refresh_token;
    if (signInError || !refreshToken) {
      throw new VisualSafetyError("VS_FIXTURE_AUTH", "revocation.sign-in");
    }

    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) {
      throw new VisualSafetyError("VS_FIXTURE_AUTH", "revocation.global-sign-out");
    }

    const verifier = guardedClient();
    const { data: refreshed, error: refreshError } = await verifier.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!refreshError || refreshed.session) {
      throw new VisualSafetyError("VS_FIXTURE_AUTH", "revocation.refresh-token-survived");
    }
  } finally {
    const disposableId = await findTestUserById(admin, REVOCATION_TEST_EMAIL);
    if (disposableId) {
      const { error } = await admin.auth.admin.deleteUser(disposableId);
      if (error) {
        throw new VisualSafetyError("VS_FIXTURE_ADMIN", "revocation.cleanup-user");
      }
    }
  }
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
