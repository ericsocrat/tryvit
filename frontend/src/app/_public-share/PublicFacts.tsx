import { compareProductNutrient, NUTRIENT_KEYS, type NutrientObservation, type ProductReadModel } from "@/lib/evidence/product-read-model";
import { translate } from "@/lib/i18n-core";
import type { SupportedLanguage } from "@/stores/language-store";
import styles from "./public-share.module.css";

const QUALIFIERS = { eq: "", lt: "<", lte: "≤", gt: ">", gte: "≥", approx: "≈" } as const;

export function PublicNutrient({ field, language }: Readonly<{ field: NutrientObservation; language: SupportedLanguage }>) {
  const selected = ["recorded", "unverified"].includes(field.state) && field.value !== null;
  const value = language === "en" ? field.value : field.value?.replace(".", ",");
  const qualifier = field.qualifier === null ? "" : QUALIFIERS[field.qualifier];
  return <div className={styles.nutrient}>
    <strong>{selected ? `${qualifier ? `${qualifier} ` : ""}${value} ${field.unit}` : translate(language, `evidenceUi.state.${field.state}`)}</strong>
    {selected ? <span>{translate(language, `evidenceUi.state.${field.state}`)}</span> : null}
    <span>{translate(language, `evidenceUi.basis.${field.basis}`)} · {translate(language, `evidenceUi.preparation.${field.preparation_state}`)}</span>
    {selected && field.qualifier === null ? <span>{translate(language, "evidenceUi.qualifierUnknown")}</span> : null}
  </div>;
}

function sourceDate(value: string | null, language: SupportedLanguage) {
  const timestamp = value === null ? Number.NaN : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now()
    ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(timestamp)
    : translate(language, "common.unknown");
}

export function PublicSourceDetails({ product, language }: Readonly<{ product: ProductReadModel; language: SupportedLanguage }>) {
  const t = (key: string, values?: Record<string, string | number>) => translate(language, key, values);
  return <details className={styles.sources}>
    <summary>{t("publicEvidenceShare.sources")}</summary>
    <p>{t("evidenceUi.sourceAgeLimit")}</p>
    {product.sources.length === 0 ? <p>{t("evidenceUi.sourcesEmpty")}</p> : <ul>{product.sources.map((source) => <li key={source.observation_id}>
      {safeSourceHref(source.source_url) ? <a href={source.source_url} target="_blank" rel="noopener noreferrer">{source.source_key}</a> : <span>{source.source_key}</span>}
      <span>{source.license}</span>
      <span>{t("evidenceUi.retrieved")}: {sourceDate(source.retrieved_at, language)}</span>
      <span>{t("evidenceUi.sourceUpdated")}: {sourceDate(source.source_updated_at, language)}</span>
    </li>)}</ul>}
  </details>;
}

export function PublicProductFacts({ product, language }: Readonly<{ product: ProductReadModel; language: SupportedLanguage }>) {
  const t = (key: string, values?: Record<string, string | number>) => translate(language, key, values);
  const allergens = [...product.allergens.contains.map((item) => ({ ...item, kind: "contains" })), ...product.allergens.traces.map((item) => ({ ...item, kind: "traces" }))];
  return <article className={styles.product} aria-labelledby={`shared-product-${product.product_id}`}>
    <h2 id={`shared-product-${product.product_id}`}>{product.product_name}</h2>
    <p className={styles.identity}>{[product.brand, product.category, t("publicEvidenceShare.catalogueMarket", { country: product.country })].filter(Boolean).join(" · ")}</p>
    <p className={styles.caution}>{t(`evidenceUi.summary.${product.evidence.state}`)}</p>
    {allergens.length ? <div className={styles.warning}><h3>{t("evidenceUi.allergensTitle")}</h3><ul>{allergens.map((item) => <li key={`${item.kind}-${item.name}`}>
      {t(`evidenceUi.${item.kind}`)}: {item.name} · {t(`evidenceUi.state.${item.state}`)}
    </li>)}</ul></div> : <p className={styles.caution}>{t("evidenceUi.allergensUnknown")}</p>}
    <p className={styles.small}>{t("evidenceUi.allergenLimit")}</p>
    <details className={styles.facts}>
      <summary>{t("publicEvidenceShare.facts")}</summary>
      <dl>{NUTRIENT_KEYS.map((key) => <div key={key} className={styles.factRow}>
        <dt>{t(`evidenceUi.nutrient.${key}`)}</dt><dd><PublicNutrient field={product.nutrition[key]} language={language} /></dd>
      </div>)}</dl>
    </details>
    <PublicSourceDetails product={product} language={language} />
  </article>;
}

export function PublicComparisonTable({ products, language }: Readonly<{ products: ProductReadModel[]; language: SupportedLanguage }>) {
  const reference = products[0];
  if (!reference || products.length < 2) return <p role="status">{translate(language, "publicEvidenceShare.needTwo")}</p>;
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={translate(language, "publicEvidenceShare.tableLabel")}>
    <table className={styles.table}>
      <caption>{translate(language, "publicEvidenceShare.comparisonReference", { product: reference.product_name })}</caption>
      <thead><tr><th scope="col">{translate(language, "evidenceUi.nutritionTitle")}</th>{products.map((product) => <th scope="col" key={product.product_id}>{product.product_name}</th>)}</tr></thead>
      <tbody>{NUTRIENT_KEYS.map((key) => <tr key={key}>
        <th scope="row">{translate(language, `evidenceUi.nutrient.${key}`)}</th>
        {products.map((product, index) => {
          const comparison = index === 0 ? null : compareProductNutrient(product, reference, key);
          return <td key={product.product_id}><PublicNutrient field={product.nutrition[key]} language={language} />
            {comparison ? <span className={styles.relation}>{translate(language, comparison.comparable ? `publicEvidenceShare.relation.${comparison.relation}` : "publicEvidenceShare.notComparable")}</span> : null}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function PublicDataAttribution({ language }: Readonly<{ language: SupportedLanguage }>) {
  return <footer className={styles.attribution}>
    <p>{translate(language, "publicEvidenceShare.privacy")}</p>
    <p>{translate(language, "evidenceUi.limitations")}</p>
    <p>{translate(language, "publicEvidenceShare.offData")} <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a> · <a href="https://opendatacommons.org/licenses/dbcl/1-0/" target="_blank" rel="noopener noreferrer">DbCL 1.0</a>.</p>
    <p>{translate(language, "publicEvidenceShare.noPhotos")}</p>
  </footer>;
}

function safeSourceHref(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}
