// ─── Shared comparison page (public) ───────────────────────────────────────
// Server-led and read-only. In demo mode it degrades without touching Supabase.

import { ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { ComparisonGrid } from "@/components/compare/ComparisonGrid";
import { translate } from "@/lib/i18n-core";
import { readPublicSharedComparison } from "@/lib/public-shares";
import { getServerLocale } from "@/lib/server-locale";
import { Link2, Scale } from "lucide-react";
import Link from "next/link";

export default async function SharedComparisonPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, language] = await Promise.all([params, getServerLocale()]);
  const result = await readPublicSharedComparison(token);
  const data = result.status === "ok" ? result.data : null;
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" aria-label="TryVit">
            <Logo variant="lockup" size={28} />
          </Link>
          <span className="rounded-full bg-info-bg px-3 py-1 text-xs font-medium text-info-text">
            {t("shared.sharedComparison")}
          </span>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {result.status !== "ok" && (
          <div
            className={`card py-8 text-center ${
              result.status === "invalid"
                ? "border-error-border bg-error-bg"
                : "border-warning-border bg-warning-bg"
            }`}
          >
            <Link2 size={40} aria-hidden="true" className="mx-auto mb-2 text-foreground-muted" />
            <p
              className={`mb-1 text-sm ${
                result.status === "invalid" ? "text-error-text" : "text-warning-text"
              }`}
            >
              {t(
                result.status === "invalid"
                  ? "shared.comparisonInvalid"
                  : "shared.serviceUnavailableMessage",
              )}
            </p>
            <ButtonLink href="/" className="mt-3" size="sm">
              {t("shared.goToTryVit")}
            </ButtonLink>
          </div>
        )}

        {data && data.products.length >= 2 && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                  <Scale size={20} aria-hidden="true" />{" "}
                  {data.title ?? t("shared.productComparison")}
                </h1>
                <p className="text-sm text-foreground-secondary">
                  {t("shared.productsCompared", { count: data.product_count })} ·{" "}
                  {new Intl.DateTimeFormat(language).format(new Date(data.created_at))}
                </p>
              </div>
            </div>
            <ComparisonGrid products={data.products} showAvoidBadge={false} />
          </>
        )}

        <div className="card bg-brand-subtle text-center">
          <p className="mb-2 text-sm text-foreground-secondary">{t("shared.wantToCompare")}</p>
          <ButtonLink href="/auth/login" size="sm">
            {t("shared.signUpFree")}
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
