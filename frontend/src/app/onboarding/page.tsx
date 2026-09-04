// ─── Onboarding wizard entry page ────────────────────────────────────────────
// Issue #42: Multi-step onboarding wizard.
// Server component wrapper — redirects already-onboarded users to /app.

import { buttonClasses } from "@/components/common/Button";
import { translate } from "@/lib/i18n-core";
import { getServerLocale } from "@/lib/server-locale";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();

  // Must be authenticated to onboard
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // If already onboarded, go to app
  const [{ data, error }, language] = await Promise.all([
    supabase.rpc("api_get_user_preferences"),
    getServerLocale(),
  ]);
  const prefs = data as
    | { onboarding_complete?: boolean; error?: unknown }
    | null;

  if (
    error ||
    !prefs ||
    prefs.error ||
    typeof prefs.onboarding_complete !== "boolean"
  ) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-10">
        <section
          className="w-full rounded-xl border border-warning-border bg-warning-bg p-6 text-center"
          role="alert"
        >
          <AlertTriangle
            className="mx-auto mb-3 text-warning-text"
            size={28}
            aria-hidden="true"
          />
          <h1 className="text-lg font-semibold text-warning-text">
            {translate(language, "onboarding.preferencesUnavailableTitle")}
          </h1>
          <p className="mt-2 text-sm text-warning-text">
            {translate(language, "onboarding.preferencesUnavailableDescription")}
          </p>
          <a
            href="/onboarding"
            className={`${buttonClasses("primary", "sm")} mt-4`}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {translate(language, "common.tryAgain")}
          </a>
        </section>
      </main>
    );
  }

  if (prefs?.onboarding_complete) {
    redirect("/app/search");
  }

  return <OnboardingWizard />;
}
