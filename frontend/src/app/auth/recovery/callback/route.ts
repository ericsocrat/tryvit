import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appendAuthRedirect, sanitizeAuthRedirect } from "@/lib/validation";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";

function reportRecoveryFailure(error: unknown) {
  logger.error("Auth recovery callback failed", {
    route: "/auth/recovery/callback",
    method: "GET",
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Unknown", message: String(error) },
  });
  Sentry.captureException(error, {
    tags: { route: "/auth/recovery/callback" },
  });
}

function redirectToExpiredLogin(request: NextRequest, redirect: string) {
  return NextResponse.redirect(
    new URL(appendAuthRedirect("/auth/login?reason=expired", redirect), request.url),
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = sanitizeAuthRedirect(searchParams.get("redirect"));

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code ?? "");
    if (error) {
      reportRecoveryFailure(error);
      return redirectToExpiredLogin(request, redirect);
    }
  } catch (error) {
    reportRecoveryFailure(error);
    return redirectToExpiredLogin(request, redirect);
  }

  return NextResponse.redirect(
    new URL(appendAuthRedirect("/auth/update-password", redirect), request.url),
  );
}
