import { ButtonLink } from "@/components/common/Button";
import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
import { PublicDataAttribution, PublicProductFacts } from "@/app/_public-share/PublicFacts";
import styles from "@/app/_public-share/public-share.module.css";
import { translate } from "@/lib/i18n-core";
import { readPublicSharedList } from "@/lib/public-shares";
import { getServerLocale } from "@/lib/server-locale";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedListPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const [{ token }, language, query] = await Promise.all([params, getServerLocale(), searchParams ?? Promise.resolve({ page: undefined })]);
  const page = typeof query.page === "string" && /^[0-9]{1,3}$/.test(query.page) ? Math.min(201, Math.max(1, Number(query.page))) : 1;
  const result = await readPublicSharedList(token, language, (page - 1) * 50);
  const t = (key: string, values?: Record<string, string | number>) => translate(language, key, values);
  const href = (nextPage: number) => "/lists/shared/" + encodeURIComponent(token) + "?page=" + nextPage;
  if (result.status !== "ok") {
    const invalid = result.status === "invalid";
    return <PublicUtilityShell eyebrow={t("shared.sharedList")} title={t(invalid ? "shared.listNotFound" : "shared.serviceUnavailableTitle")}
      description={t(invalid ? "shared.listNotFoundMessage" : "shared.serviceUnavailableMessage")}>
      <section role="alert">
        {!invalid ? <a href={href(page)} className="underline">{t("publicEvidenceShare.retry")}</a> : null}
        <ButtonLink href="/">{t("error.goHome")}</ButtonLink>
      </section>
    </PublicUtilityShell>;
  }
  const data = result.data;
  return <PublicUtilityShell eyebrow={t("shared.sharedList")} title={data.title ?? t("shared.sharedList")}
    description={t("publicEvidenceShare.intro")} register={<span>{t("common.products", { count: data.total_count })}</span>}>
    {data.unavailable_count > 0 ? <p role="status">{t("publicEvidenceShare.unavailableCount", { count: data.unavailable_count })}</p> : null}
    {data.products.length === 0 ? <p role="status">{t(data.total_count === 0 ? data.unavailable_count > 0 ? "publicEvidenceShare.noAvailableProducts" : "shared.listEmpty" : "publicEvidenceShare.pageEmpty")}</p> :
      <div className={styles.grid}>{data.products.map((product) => <PublicProductFacts key={product.product_id} product={product} language={language} />)}</div>}
    {data.total_count > data.limit || data.offset > 0 ? <nav className={styles.pagination} aria-label={t("publicEvidenceShare.pagination")}>
      {page > 1 ? <Link prefetch={false} href={href(page - 1)}>{t("publicEvidenceShare.previous")}</Link> : <span />}
      <span>{t("publicEvidenceShare.pageNumber", { page })}</span>
      {data.offset + data.products.length < data.total_count && page < 201 ? <Link prefetch={false} href={href(page + 1)}>{t("publicEvidenceShare.next")}</Link> : null}
    </nav> : null}
    <PublicDataAttribution language={language} />
  </PublicUtilityShell>;
}
