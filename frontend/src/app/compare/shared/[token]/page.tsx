// ─── Shared comparison page (public) ───────────────────────────────────────
// Server-led and read-only. In demo mode it degrades without touching Supabase.

import { ButtonLink } from "@/components/common/Button";
import { ComparisonGrid } from "@/components/compare/ComparisonGrid";
import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
import { translate } from "@/lib/i18n-core";
import { readPublicSharedComparison } from "@/lib/public-shares";
import { getServerLocale } from "@/lib/server-locale";
import { Link2, Scale } from "lucide-react";

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
    <PublicUtilityShell
      eyebrow={t("shared.sharedComparison")}
      title={data?.title ?? t("shared.productComparison")}
      description={
        data
          ? t("shared.productsCompared", { count: data.product_count })
          : t("shared.sharedComparison")
      }
      register={data ? <span>{new Intl.DateTimeFormat(language).format(new Date(data.created_at))}</span> : null}
    >
        {result.status !== "ok" && (
          <section role="alert" className="text-center">
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
          </section>
        )}

        {data && data.products.length >= 2 && (
          <section>
            <Scale size={20} aria-hidden="true" />
            <ComparisonGrid
              products={data.products}
              showAvoidBadge={false}
              recommendationAllowed={false}
            />
          </section>
        )}

        <section className="text-center">
          <p className="mb-2 text-sm text-foreground-secondary">{t("shared.wantToCompare")}</p>
          <ButtonLink href="/auth/login" size="sm">
            {t("shared.signUpFree")}
          </ButtonLink>
        </section>
    </PublicUtilityShell>
  );
}
