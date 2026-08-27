// ─── Auth callback route handler ─────────────────────────────────────────────
// Supabase redirects here after email confirmation.
// Exchanges the auth code for a session, then redirects to the app.
// Instrumented with structured logging (#183).

import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appendAuthRedirect, sanitizeAuthRedirect } from "@/lib/validation";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";

function redirectToLogin(
  request: NextRequest,
  reason: "expired" | "invite-only" | "provider",
  redirect: string,
) {
  const destination = new URL(appendAuthRedirect("/auth/login", redirect), request.url);
  destination.searchParams.set("reason", reason);
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
  const redirect = sanitizeAuthRedirect(searchParams.get("redirect"));
  const callbackError = searchParams.get("error");
  const callbackErrorCode = searchParams.get("error_code");

  if (callbackError || callbackErrorCode) {
    logger.info("Auth callback rejected", {
      route: "/auth/callback",
      method: "GET",
      meta: {
        reason: callbackErrorCode === "signup_disabled" ? "signup-disabled" : "provider",
      },
    });
    return redirectToLogin(
      request,
      callbackErrorCode === "signup_disabled" ? "invite-only" : "provider",
      redirect,
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code ?? "");
    if (!code || error) {
      reportCallbackFailure(error ?? new Error("Missing auth callback code"));
      return redirectToLogin(request, "expired", redirect);
    }
    logger.info("Auth callback success", { route: "/auth/callback", method: "GET" });
  } catch (error) {
    reportCallbackFailure(error);
    return redirectToLogin(request, "expired", redirect);
  }

  return NextResponse.redirect(new URL(redirect, request.url));
}
