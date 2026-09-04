// ─── Shared list page (public) ──────────────────────────────────────────────
// Server-led and read-only. In demo mode it degrades without touching Supabase.

import { ButtonLink } from "@/components/common/Button";
import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
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
            <section aria-labelledby="shared-list-evidence">
              <h2
                id="shared-list-evidence"
                className="text-base font-semibold text-foreground"
              >
                {t("shared.listEvidenceWithheldTitle")}
              </h2>
              <p className="mt-1 text-sm text-warning-text" role="status">
                {t("shared.listEvidenceWithheldDescription")}
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.items.map((item) => (
                  <li
                    key={item.product_id}
                    className="rounded-xl border bg-surface-subtle p-3"
                  >
                    <p className="font-medium text-foreground">
                      {item.product_name}
                    </p>
                    <p className="text-sm text-foreground-secondary">
                      {[item.brand, item.category].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
    </PublicUtilityShell>
  );
}
