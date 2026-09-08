import { ButtonLink } from "@/components/common/Button";
import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
import { PublicComparisonTable, PublicDataAttribution, PublicProductFacts } from "@/app/_public-share/PublicFacts";
import styles from "@/app/_public-share/public-share.module.css";
import { translate } from "@/lib/i18n-core";
import { readPublicSharedComparison } from "@/lib/public-shares";
import { getServerLocale } from "@/lib/server-locale";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharedComparisonPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, language] = await Promise.all([params, getServerLocale()]);
  const result = await readPublicSharedComparison(token, language);
  const t = (key: string, values?: Record<string, string | number>) => translate(language, key, values);
  if (result.status !== "ok") return <PublicUtilityShell eyebrow={t("shared.sharedComparison")}
    title={t(result.status === "invalid" ? "shared.comparisonInvalid" : "shared.serviceUnavailableTitle")}
    description={t(result.status === "invalid" ? "shared.comparisonInvalid" : "shared.serviceUnavailableMessage")}>
    <section role="alert">
      {result.status === "unavailable" ? <a href={"/compare/shared/" + encodeURIComponent(token)} className="underline">{t("publicEvidenceShare.retry")}</a> : null}
      <ButtonLink href="/">{t("shared.goToTryVit")}</ButtonLink>
    </section>
  </PublicUtilityShell>;
  const data = result.data;
  return <PublicUtilityShell eyebrow={t("shared.sharedComparison")} title={data.title ?? t("shared.productComparison")}
    description={t("publicEvidenceShare.intro")} register={<span>{t("common.products", { count: data.product_count })}</span>}>
    {data.unavailable_count > 0 ? <p role="status">{t("publicEvidenceShare.unavailableCount", { count: data.unavailable_count })}</p> : null}
    <PublicComparisonTable products={data.products} language={language} />
    <div className={styles.grid}>{data.products.map((product) => <PublicProductFacts key={product.product_id} product={product} language={language} />)}</div>
    <PublicDataAttribution language={language} />
    <ButtonLink href="/auth/login">{t("publicEvidenceShare.signIn")}</ButtonLink>
  </PublicUtilityShell>;
}
