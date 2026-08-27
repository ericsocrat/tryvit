// ─── Auth callback route handler ─────────────────────────────────────────────
// Supabase redirects here after email confirmation.
// Exchanges the auth code for a session, then redirects to the app.
// Instrumented with structured logging (#183).

import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";

function redirectToExpiredLogin(request: NextRequest) {
  const destination = new URL("/auth/login", request.url);
  destination.searchParams.set("reason", "expired");
  return NextResponse.redirect(destination);
}

function reportCallbackFailure(error: unknown) {
  logger.error("Auth callback failed", {
    route: "/auth/callback",
    method: "GET",
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Unknown", message: String(error) },
  });
  Sentry.captureException(error, {
    tags: { route: "/auth/callback" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code ?? "");
    if (!code || error) {
      reportCallbackFailure(error ?? new Error("Missing auth callback code"));
      return redirectToExpiredLogin(request);
    }
    logger.info("Auth callback success", { route: "/auth/callback", method: "GET" });
  } catch (error) {
    reportCallbackFailure(error);
    return redirectToExpiredLogin(request);
  }

  // After confirming email, go to onboarding (app layout will check)
  const type = searchParams.get("type");
  const destination = type === "recovery" ? "/auth/update-password" : "/app/search";
  return NextResponse.redirect(new URL(destination, request.url));
}
