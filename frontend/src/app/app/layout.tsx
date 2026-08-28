// ─── Protected app layout ────────────────────────────────────────────────────
// Server component that checks onboarding_complete via api_get_user_preferences().
// If onboarding is incomplete, redirects to /onboarding.
// This is the AUTHORITATIVE onboarding gate (server-side).
// RouteGuard provides a secondary client-side gate for UX + session expiry handling.

import { buttonClasses } from "@/components/common/Button";
import { AuthenticatedProviders } from "@/components/AuthenticatedProviders";
import { CountryChip } from "@/components/common/CountryChip";
import { FoldedTryVitIdentity } from "@/components/common/FoldedTryVitIdentity";
import { CompareFloatingButton } from "@/components/compare/CompareFloatingButton";
import { ComparisonTray } from "@/components/desktop/ComparisonTray";
import { LanguageHydrator } from "@/components/i18n/LanguageHydrator";
import { AdminHydrator } from "@/components/layout/AdminHydrator";
import { DesktopHeaderNav } from "@/components/layout/DesktopHeaderNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { GlobalKeyboardShortcuts } from "@/components/layout/GlobalKeyboardShortcuts";
import { Navigation } from "@/components/layout/Navigation";
import { ListsHydrator } from "@/components/product/ListsHydrator";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { translate } from "@/lib/i18n-core";
import { resolveLocaleFromAcceptLanguage } from "@/lib/locale";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AlertTriangle } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "@/components/layout/AppShell.module.css";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();

  // Double-check auth (middleware should have caught this, but belt-and-suspenders)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Check onboarding status via backend RPC
  const { data, error } = await supabase.rpc("api_get_user_preferences");

  // Transient RPC / network failure — show error instead of wrongly redirecting
  // an onboarded user back to region selection.
  if (error || !data) {
    // Detect locale from Accept-Language since user preferences are unavailable.
    const headerList = await headers();
    const accept = headerList.get("accept-language") ?? "";
    const locale = resolveLocaleFromAcceptLanguage(accept);

    return (
      <div
        className={`${styles.frame} flex min-h-screen flex-col items-center justify-center px-4 text-center`}
        data-design-system="v2"
      >
        <AlertTriangle size={40} aria-hidden="true" className="mb-2 text-warning" />
        <h1 className="mb-1 text-lg font-bold text-foreground">
          {translate(locale, "layout.errorTitle")}
        </h1>
        <p className="mb-6 text-sm text-foreground-secondary">
          {translate(locale, "layout.errorMessage")}
        </p>
        <a
          href="/app/search"
          className={buttonClasses("primary", "md", { className: "inline-block" })}
        >
          {translate(locale, "common.tryAgain")}
        </a>
      </div>
    );
  }

  const prefs = data as {
    onboarding_complete: boolean;
    country: string | null;
    preferred_language: string | null;
  };

  if (!prefs.onboarding_complete) {
    redirect("/onboarding");
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes(user.email?.toLowerCase() ?? "");

  return (
    <AuthenticatedProviders>
      <div className={styles.frame} data-design-system="v2">
        <div className="no-print">
          <OfflineIndicator />
        </div>

        {/* Sidebar — xl+ only (hidden below xl via CSS) */}
        <DesktopSidebar country={prefs.country} />

        {/* Main column — offset by sidebar width on xl+ */}
        <div className={styles.mainColumn}>
          {/* Header — visible below xl. Hidden at xl+ where sidebar takes over. */}
          <header className={styles.appHeader}>
            <div className={styles.headerInner}>
              <Link href="/app" aria-label="TryVit" className={styles.headerIdentity}>
                <FoldedTryVitIdentity size={28} />
              </Link>
              {/* Desktop header nav — lg to xl only */}
              <DesktopHeaderNav />
              <div className={styles.headerUtilities}>
                <CountryChip country={prefs.country} size="sm" />
              </div>
            </div>
          </header>

          <main
            id="main-content"
            className={styles.mainContent}
          >
            <ListsHydrator />
            <LanguageHydrator
              preferredLanguage={prefs.preferred_language}
              country={prefs.country}
            />
            <AdminHydrator isAdmin={isAdmin} />
            {children}
          </main>

          {/* ⚠️  No <dialog> elements should be unconditionally rendered here.
            Android Chrome resolves their box dimensions even when closed,
            inflating the mobile viewport. See PR #92. */}
          <div className="no-print">
            <CompareFloatingButton />
            <ComparisonTray />
            <InstallPrompt />
            <GlobalKeyboardShortcuts />
          </div>
          <Navigation />
        </div>
      </div>
    </AuthenticatedProviders>
  );
}
