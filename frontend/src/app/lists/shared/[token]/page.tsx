// ─── Shared list page (public) ──────────────────────────────────────────────
// Server-led and read-only. In demo mode it degrades without touching Supabase.

import { ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { NUTRI_COLORS, SCORE_BANDS, scoreBandFromScore } from "@/lib/constants";
import { translate } from "@/lib/i18n-core";
import { readPublicSharedList } from "@/lib/public-shares";
import { toTryVitScore } from "@/lib/score-utils";
import { getServerLocale } from "@/lib/server-locale";

export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, language] = await Promise.all([params, getServerLocale()]);
  const result = await readPublicSharedList(token);
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);

  if (result.status !== "ok") {
    const invalid = result.status === "invalid";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-subtle px-4">
        <p className="mb-2 text-4xl">{invalid ? "🔒" : "⏸️"}</p>
        <h1 className="mb-1 text-lg font-bold text-foreground">
          {t(invalid ? "shared.listNotFound" : "shared.serviceUnavailableTitle")}
        </h1>
        <p className="mb-6 text-sm text-foreground-secondary">
          {t(invalid ? "shared.listNotFoundMessage" : "shared.serviceUnavailableMessage")}
        </p>
        <ButtonLink href="/">{t("error.goHome")}</ButtonLink>
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="border-b border bg-surface backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo variant="lockup" size={28} />
          <span className="rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-info-text">
            {t("shared.sharedList")}
          </span>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-4">
          <div className="card">
            <h1 className="text-lg font-bold text-foreground">{data.list_name}</h1>
            {data.description && (
              <p className="mt-1 text-sm text-foreground-secondary">{data.description}</p>
            )}
            <p className="mt-1 text-xs text-foreground-muted">
              {t("common.products", { count: data.total_count })}
            </p>
          </div>

          {data.items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-foreground-muted">{t("shared.listEmpty")}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.items.map((item) => {
                const band = SCORE_BANDS[scoreBandFromScore(item.unhealthiness_score)];
                const nutriClass = item.nutri_score_label
                  ? (NUTRI_COLORS[item.nutri_score_label] ??
                    "bg-surface-muted text-foreground-secondary")
                  : "bg-surface-muted text-foreground-secondary";

                return (
                  <li key={item.product_id} className="card flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${band.bg} ${band.color}`}
                    >
                      {toTryVitScore(item.unhealthiness_score)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{item.product_name}</p>
                      <p className="truncate text-sm text-foreground-secondary">
                        {item.brand}
                        {item.category && ` · ${item.category}`}
                      </p>
                    </div>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${nutriClass}`}
                    >
                      {item.nutri_score_label ?? "?"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
