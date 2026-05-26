// ─── E2E test user lifecycle ─────────────────────────────────────────────────
// Creates and tears down a Supabase Auth user for authenticated Playwright tests.
// Requires SUPABASE_SERVICE_ROLE_KEY to access the Admin API.

import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

export const TEST_EMAIL = "e2e-playwright-auth@test.tryvit.local";
export const FUNCTIONAL_TEST_EMAIL = "e2e-playwright-functional@test.tryvit.local";
export const TEST_PASSWORD = "PlaywrightTest123!";
const WebSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

type TestUserScope = "authenticated" | "functional";

function getScopeEmail(scope: TestUserScope): string {
  return scope === "functional" ? FUNCTIONAL_TEST_EMAIL : TEST_EMAIL;
}

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Node <22 does not provide a native WebSocket for Supabase Realtime.
    // Provide ws transport so CI auth setup can initialize the admin client.
    realtime: { transport: WebSocketTransport },
  });
}

/**
 * Find the test user by email using paginated search.
 * Stops early when found instead of loading all users.
 */
async function findTestUserById(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const PAGE_SIZE = 50;
  let page = 1;

   
  while (true) {
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });

    const match = users.find((u) => u.email === email);
    if (match) return match.id;

    // No more pages
    if (users.length < PAGE_SIZE) return null;
    page++;
  }
}

/** Delete any existing test user, then create a fresh auto-confirmed one. */
export async function ensureScopedTestUser(
  scope: TestUserScope,
): Promise<string> {
  const supabase = getAdminClient();
  const email = getScopeEmail(scope);

  // Remove stale test user if present (idempotent) — paginated search
  const existingId = await findTestUserById(supabase, email);
  if (existingId) {
    await supabase.auth.admin.deleteUser(existingId);
  }

  // Create fresh, pre-confirmed user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  const userId = data.user.id;

  // Pre-create preferences: skip onboarding + force English so E2E tests
  // see English text (api_skip_onboarding sets country=PL which triggers
  // LanguageHydrator to switch to Polish, breaking English-only assertions).
  const { error: prefError } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: userId,
      country: "PL",
      preferred_language: "en",
      onboarding_completed: false,
      onboarding_skipped: true,
    });

  if (prefError) {
    throw new Error(`Failed to set test user preferences: ${prefError.message}`);
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
    await supabase.auth.admin.deleteUser(userId);
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
