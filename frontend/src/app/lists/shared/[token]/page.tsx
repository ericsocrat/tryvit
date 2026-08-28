// ─── Shared list page (public) ──────────────────────────────────────────────
// Server-led and read-only. In demo mode it degrades without touching Supabase.

import { ButtonLink } from "@/components/common/Button";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import { scoreBandFromScore } from "@/lib/constants";
import { translate } from "@/lib/i18n-core";
import { readPublicSharedList } from "@/lib/public-shares";
import { getServerLocale } from "@/lib/server-locale";

export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, language] = await Promise.all([params, getServerLocale()]);
  const result = await readPublicSharedList(token);
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);

  if (result.status !== "ok") {
    const invalid = result.status === "invalid";
    return (
      <PublicUtilityShell
        eyebrow={t("shared.sharedList")}
        title={t(invalid ? "shared.listNotFound" : "shared.serviceUnavailableTitle")}
        description={t(invalid ? "shared.listNotFoundMessage" : "shared.serviceUnavailableMessage")}
      >
        <section role="alert" className="text-center">
          <p className="mb-2 text-4xl">{invalid ? "🔒" : "⏸️"}</p>
          <ButtonLink href="/">{t("error.goHome")}</ButtonLink>
        </section>
      </PublicUtilityShell>
    );
  }

  const data = result.data;

  return (
    <PublicUtilityShell
      eyebrow={t("shared.sharedList")}
      title={data.list_name}
      description={data.description ?? t("shared.sharedList")}
      register={<span>{t("common.products", { count: data.total_count })}</span>}
    >

          {data.items.length === 0 ? (
            <section className="text-center">
              <p className="text-sm text-foreground-muted">{t("shared.listEmpty")}</p>
            </section>
          ) : (
            <ul className="space-y-2">
              {data.items.map((item) => {
                return (
                  <ProductRegisterCard
                    key={item.product_id}
                    productId={item.product_id}
                    href={`/app/product/${item.product_id}`}
                    name={item.product_name}
                    brand={item.brand}
                    category={item.category}
                    score={item.unhealthiness_score}
                    scoreBand={scoreBandFromScore(item.unhealthiness_score)}
                    muted
                    badges={<NutriScoreBadge grade={item.nutri_score_label} size="sm" />}
                  />
                );
              })}
            </ul>
          )}
    </PublicUtilityShell>
  );
}
