// ─── Shared comparison page (public) ───────────────────────────────────────
// Server-led and read-only. In demo mode it degrades without touching Supabase.

import { ButtonLink } from "@/components/common/Button";
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
          <section aria-labelledby="shared-comparison-evidence">
            <Scale size={20} aria-hidden="true" />
            <h2
              id="shared-comparison-evidence"
              className="mt-2 text-base font-semibold text-foreground"
            >
              {t("shared.comparisonEvidenceWithheldTitle")}
            </h2>
            <p className="mt-1 text-sm text-warning-text" role="status">
              {t("shared.comparisonEvidenceWithheldDescription")}
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.products.map((product) => (
                <li
                  key={product.product_id}
                  className="rounded-xl border bg-surface-subtle p-3"
                >
                  <p className="font-medium text-foreground">
                    {product.product_name}
                  </p>
                  {product.brand ? (
                    <p className="text-sm text-foreground-secondary">
                      {product.brand}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
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
