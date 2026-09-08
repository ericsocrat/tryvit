"use client";

import { NUTRIENT_KEYS, type NutrientObservation, type ProductReadModel } from "@/lib/evidence/product-read-model";
import { useTranslation } from "@/lib/i18n";
import { ALLERGEN_TAGS } from "@/lib/constants";
import Image from "next/image";
import { useState } from "react";
import { Skeleton, SkeletonContainer } from "@/components/common/Skeleton";
import styles from "./evidence.module.css";

const QUALIFIERS = { eq: "", lt: "<", lte: "≤", gt: ">", gte: "≥", approx: "≈" } as const;

/** Display names do not change the stable keys used for observation matching. */
export function sourceDisplayName(sourceKey: string): string {
  return sourceKey === "off_api" ? "Open Food Facts" : sourceKey;
}

export function EvidenceLoading({ comparison = false }: Readonly<{ comparison?: boolean }>) {
  const { t } = useTranslation();
  return <SkeletonContainer label={t(comparison ? "evidenceUi.loadingComparison" : "evidenceUi.loadingProduct")} className={styles.panel}>
    <Skeleton width="55%" height={32} />
    <div className={styles.loadingRows}>{[0, 1, 2, 3].map((row) => <Skeleton key={row} width="100%" height={64} />)}</div>
  </SkeletonContainer>;
}

export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Retrieval age is operational metadata, never proof of current package accuracy. */
export function sourceAgeDays(value: string, now: number = Date.now()): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now) return null;
  return Math.floor((now - timestamp) / 86_400_000);
}

export function hasObservationSource(product: ProductReadModel, field: NutrientObservation): boolean {
  return field.observation_id !== null && product.sources.some((source) => source.observation_id === field.observation_id);
}

export function NutrientValue({ observation, showContext = true }: Readonly<{ observation: NutrientObservation; showContext?: boolean }>) {
  const { t, language } = useTranslation();
  const selected = ["recorded", "unverified"].includes(observation.state) && observation.value !== null;
  const value = language === "en" ? observation.value : observation.value?.replace(".", ",");
  const qualifier = observation.qualifier === null ? "" : QUALIFIERS[observation.qualifier];

  return (
    <div className={styles.factValue} data-evidence-state={observation.state}>
      <span className={styles.quantity} aria-label={selected && observation.qualifier === "approx" ? t("evidenceUi.approximateValue", { value: value ?? "", unit: observation.unit }) : undefined}>
        {selected ? <>{qualifier ? `${qualifier} ` : ""}{value} <span>{observation.unit}</span></> : t(`evidenceUi.state.${observation.state}`)}
      </span>
      {showContext && selected ? <span className={styles.factState}>{t(`evidenceUi.state.${observation.state}`)}</span> : null}
      {showContext ? <span className={styles.basis}>{t(`evidenceUi.basis.${observation.basis}`)} · {t(`evidenceUi.preparation.${observation.preparation_state}`)}</span> : null}
      {showContext && selected && observation.qualifier === null ? <span className={styles.basis}>{t("evidenceUi.qualifierUnknown")}</span> : null}
    </div>
  );
}

export function EvidenceSummary({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t } = useTranslation();
  return (
    <div className={styles.evidenceSummary} data-testid="evidence-summary">
      <h2>{t(`evidenceUi.summary.${product.evidence.state}`)}</h2>
      <p>{t("evidenceUi.recordedFields", { count: product.evidence.recorded_fields, total: product.evidence.total_fields })}</p>
      <p>{t("evidenceUi.limitations")}</p>
    </div>
  );
}

function ObservationReference({ product, observationId, sourceKey, label }: Readonly<{ product: ProductReadModel; observationId: string | null; sourceKey: string | null; label: string }>) {
  const { t, language } = useTranslation();
  const source = product.sources.find((item) => item.observation_id === observationId && item.source_key === sourceKey);
  const formatter = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
  const date = (value: string | null | undefined) => value && sourceAgeDays(value) !== null ? formatter.format(new Date(value)) : t("evidenceUi.dateUnavailable");
  return <div>
    {source ? <a href={`#source-${product.product_id}-${source.observation_id}`}>{label}</a> : <span>{label}</span>}
    <div>{t("evidenceUi.retrieved")}: {date(source?.retrieved_at)}</div>
    <div>{t("evidenceUi.sourceUpdated")}: {date(source?.source_updated_at)}</div>
  </div>;
}

export function ProductIdentityImage({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t } = useTranslation();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = product.image && safeSourceUrl(product.image.url);
  return (
    <figure className={styles.photo}>
      {url && url !== failedUrl ? <Image src={url} alt={product.image?.alt || product.product_name} width={220} height={220} className={styles.photoImage} onError={() => setFailedUrl(url)} /> : (
        <div className={styles.photoPlaceholder}>
          <span aria-hidden="true">{product.product_name.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? "·"}</span>
          <p>{t("evidenceUi.photoUnavailable")}</p>
        </div>
      )}
      {url && url !== failedUrl && product.image ? <figcaption>
        {product.image.state === "unverified" ? <span>{t("evidenceUi.state.unverified")}</span> : null}
        <details className={styles.photoDetails}>
          <summary>{t("evidenceUi.photoDetails")}</summary>
          {product.image.state === "recorded" ? <span>{t("evidenceUi.state.recorded")}</span> : null}
          <ObservationReference product={product} observationId={product.image.observation_id} sourceKey={product.image.source_key} label={t("evidenceUi.imageSource", { source: product.image.source || t("common.unknown") })} />
        </details>
      </figcaption> : null}
    </figure>
  );
}

export function ProductNutrition({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t } = useTranslation();
  const values = Object.values(product.nutrition).filter((field) => field.value !== null && ["recorded", "unverified"].includes(field.state));
  const first = values[0];
  const shared = first && values.every((field) => field.state === first.state && field.basis === first.basis && field.preparation_state === first.preparation_state && (field.qualifier === null) === (first.qualifier === null)) ? first : null;
  const sharedSource = first?.observation_id && values.every((field) => field.observation_id === first.observation_id)
    ? product.sources.find((source) => source.observation_id === first.observation_id) : undefined;
  const contextId = `nutrition-context-${product.product_id}`;
  return (
    <section className={styles.panel} aria-labelledby={`nutrition-${product.product_id}`}>
      <h2 id={`nutrition-${product.product_id}`}>{t("evidenceUi.nutritionTitle")}</h2>
      <p className={styles.intro}>{t("evidenceUi.nutritionIntro")}</p>
      {shared ? <p id={contextId} className={styles.nutritionContext}>
        <strong>{t("evidenceUi.nutritionSharedContext")}</strong>:{" "}
        {t(`evidenceUi.state.${shared.state}`)} · {t(`evidenceUi.basis.${shared.basis}`)} · {t(`evidenceUi.preparation.${shared.preparation_state}`)}
        {shared.qualifier === null ? <span> · {t("evidenceUi.qualifierUnknown")}</span> : null}
        {sharedSource ? <> · <a href={`#source-${product.product_id}-${sharedSource.observation_id}`} aria-label={`${t("evidenceUi.nutritionSharedContext")}: ${t("evidenceUi.classificationSource", { source: sourceDisplayName(sharedSource.source_key) })}`}>{t("evidenceUi.classificationSource", { source: sourceDisplayName(sharedSource.source_key) })}</a></> : null}
      </p> : null}
      {!shared && sharedSource ? <p id={contextId} className={styles.nutritionContext}>{t("evidenceUi.nutritionSharedContext")}: <a href={`#source-${product.product_id}-${sharedSource.observation_id}`} aria-label={`${t("evidenceUi.nutritionSharedContext")}: ${t("evidenceUi.classificationSource", { source: sourceDisplayName(sharedSource.source_key) })}`}>{t("evidenceUi.classificationSource", { source: sourceDisplayName(sharedSource.source_key) })}</a></p> : null}
      <dl className={styles.nutrients} aria-describedby={shared || sharedSource ? contextId : undefined}>
        {NUTRIENT_KEYS.map((key) => {
          const field = product.nutrition[key];
          const source = !sharedSource && field.value !== null && ["recorded", "unverified"].includes(field.state) ? product.sources.find((item) => item.observation_id === field.observation_id) : undefined;
          return <div key={key} className={styles.nutrientRow}>
          <dt>{t(`evidenceUi.nutrient.${key}`)}</dt>
          <dd>
            <NutrientValue observation={product.nutrition[key]} showContext={!shared} />
            {source ? <a className={styles.nutrientSource} href={`#source-${product.product_id}-${source.observation_id}`} aria-label={`${t(`evidenceUi.nutrient.${key}`)}: ${t("evidenceUi.classificationSource", { source: sourceDisplayName(source.source_key) })}`}>{t("evidenceUi.classificationSource", { source: sourceDisplayName(source.source_key) })}</a> : null}
            {product.nutrition[key].state === "recorded" && !hasObservationSource(product, product.nutrition[key]) ? <span className={styles.caution}>{t("evidenceUi.sourceUnavailable")}</span> : null}
          </dd>
        </div>; })}
      </dl>
    </section>
  );
}

function AssertionList({ items, allergens = false, product }: Readonly<{ items: ProductReadModel["ingredients"]["items"]; allergens?: boolean; product?: ProductReadModel }>) {
  const { t } = useTranslation();
  return <ul className={styles.assertions}>{items.map((item, index) => {
    const labelKey = allergens ? ALLERGEN_TAGS.find((allergen) => allergen.tag === item.name.replace(/^en:/, ""))?.labelKey : undefined;
    const label = labelKey ? t(labelKey) : item.name;
    const state = t(`evidenceUi.state.${item.state}`);
    const source = item.observation_id ? product?.sources.find((entry) => entry.observation_id === item.observation_id) : undefined;
    const content = <><span>{label}</span><small>{state}</small></>;
    return <li key={`${item.name}-${index}`}>{source && product ? <a className={styles.assertionLink} href={`#source-${product.product_id}-${source.observation_id}`} aria-label={`${label} · ${state} · ${t("evidenceUi.classificationSource", { source: sourceDisplayName(source.source_key) })}`}>{content}</a> : content}</li>;
  })}</ul>;
}

export function ProductAllergenSummary({ product, compact = false }: Readonly<{ product: ProductReadModel; compact?: boolean }>) {
  const { t } = useTranslation();
  return <div>
    {product.allergens.contains.length ? <><strong>{t("evidenceUi.contains")}</strong><AssertionList items={product.allergens.contains} allergens product={compact ? undefined : product} /></> : null}
    {product.allergens.traces.length ? <><strong>{t("evidenceUi.traces")}</strong><AssertionList items={product.allergens.traces} allergens product={compact ? undefined : product} /></> : null}
    {!compact && !product.allergens.contains.length && !product.allergens.traces.length ? <p className={styles.caution}>{t("evidenceUi.allergensUnknown")}</p> : null}
    {!compact ? <p className={styles.intro}>{t("evidenceUi.allergenLimit")}</p> : null}
  </div>;
}

export function ProductPositiveAllergenNotice({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t } = useTranslation();
  if (!product.allergens.contains.length && !product.allergens.traces.length) return null;
  return <aside className={styles.headerAllergens} aria-labelledby={`allergen-notice-${product.product_id}`}>
    <h2 id={`allergen-notice-${product.product_id}`}><a href={`#allergens-${product.product_id}`}>{t("evidenceUi.allergenNoticeTitle")}</a></h2>
    <ProductAllergenSummary product={product} compact />
    {["invalid", "conflicting"].includes(product.allergens.state) ? <p>{t(`evidenceUi.state.${product.allergens.state}`)}</p> : null}
  </aside>;
}

export function ProductIngredientsAndAllergens({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t } = useTranslation();
  const positive = product.allergens.contains.length > 0 || product.allergens.traces.length > 0;
  return (
    <>
      <section className={`${styles.panel} ${positive ? styles.allergenWarning : ""}`} aria-labelledby={`allergens-${product.product_id}`}>
        <h2 id={`allergens-${product.product_id}`}>{t("evidenceUi.allergensTitle")}</h2>
        <p className={styles.intro}>{t("evidenceUi.allergenLimit")}</p>
        {product.allergens.contains.length > 0 ? <><h3>{t("evidenceUi.contains")}</h3><AssertionList items={product.allergens.contains} allergens product={product} /></> : null}
        {product.allergens.traces.length > 0 ? <><h3>{t("evidenceUi.traces")}</h3><AssertionList items={product.allergens.traces} allergens product={product} /></> : null}
        {!positive ? <p className={styles.caution}>{t("evidenceUi.allergensUnknown")}</p> : null}
        {["invalid", "conflicting"].includes(product.allergens.state) ? <p className={styles.caution}>{t(`evidenceUi.state.${product.allergens.state}`)}</p> : null}
      </section>
      <section className={styles.panel} aria-labelledby={`ingredients-${product.product_id}`}>
        <h2 id={`ingredients-${product.product_id}`}>{t("evidenceUi.ingredientsTitle")}</h2>
        <p className={styles.intro}>{t("evidenceUi.ingredientAggregation")}</p>
        <p className={styles.intro}>{t(`evidenceUi.state.${product.ingredients.state}`)}</p>
        {product.ingredients.items.length > 0 ? <AssertionList items={product.ingredients.items} product={product} /> : <p className={styles.caution}>{t("evidenceUi.ingredientsUnknown")}</p>}
        <dl className={styles.suitability}>
          <div><dt>{t("evidenceUi.vegan")}</dt><dd>{t(`evidenceUi.suitability.${product.suitability.vegan}`)}</dd></div>
          <div><dt>{t("evidenceUi.vegetarian")}</dt><dd>{t(`evidenceUi.suitability.${product.suitability.vegetarian}`)}</dd></div>
        </dl>
      </section>
    </>
  );
}

export function ProductClassifications({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t } = useTranslation();
  const { nutri_score: nutri, nova } = product.classifications;
  return (
    <section className={styles.panel} aria-labelledby={`classifications-${product.product_id}`}>
      <h2 id={`classifications-${product.product_id}`}>{t("evidenceUi.classificationsTitle")}</h2>
      <p className={styles.intro}>{t("evidenceUi.classificationsIntro")}</p>
      <dl className={styles.classifications}>
        <div><dt>Nutri-Score</dt><dd>{nutri.value ?? t("common.unknown")}</dd><dd><ObservationReference product={product} observationId={nutri.observation_id} sourceKey={nutri.source} label={t("evidenceUi.classificationSource", { source: nutri.source ? sourceDisplayName(nutri.source) : t("evidenceUi.sourceNotRecorded") })} /></dd><dd>{t("evidenceUi.classificationVersion", { version: nutri.version || t("common.unknown") })}</dd></div>
        <div><dt>NOVA</dt><dd>{nova.value ?? t("common.unknown")}</dd><dd><ObservationReference product={product} observationId={nova.observation_id} sourceKey={nova.source} label={t("evidenceUi.classificationSource", { source: nova.source ? sourceDisplayName(nova.source) : t("evidenceUi.sourceNotRecorded") })} /></dd></div>
      </dl>
    </section>
  );
}

export function ProductSources({ product }: Readonly<{ product: ProductReadModel }>) {
  const { t, language } = useTranslation();
  const formatter = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
  const relativeFormatter = new Intl.RelativeTimeFormat(language, { numeric: "always" });
  function sourceDate(value: string | null) {
    if (value === null || sourceAgeDays(value) === null) return t("evidenceUi.dateUnavailable");
    return formatter.format(new Date(value));
  }
  return (
    <details className={styles.sources} data-testid="product-sources">
      <summary>{t("evidenceUi.sourcesTitle", { count: product.sources.length })}</summary>
      <div className={styles.sourceContent}>
        <p className={styles.intro}>{t("evidenceUi.sourceAgeLimit")}</p>
        {product.sources.length === 0 ? <p>{t("evidenceUi.sourcesEmpty")}</p> : <ol>{product.sources.map((source) => {
          const href = safeSourceUrl(source.source_url);
          const age = sourceAgeDays(source.retrieved_at);
          return <li key={source.observation_id} id={`source-${product.product_id}-${source.observation_id}`}>
            <h3>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{sourceDisplayName(source.source_key)}</a> : sourceDisplayName(source.source_key)}</h3>
            {!href ? <p>{t("evidenceUi.sourceLinkUnavailable")}</p> : null}
            <dl>
              <div><dt>{t("evidenceUi.retrieved")}</dt><dd>{sourceDate(source.retrieved_at)}{age !== null ? ` · ${relativeFormatter.format(-age, "day")}` : ""}</dd></div>
              <div><dt>{t("evidenceUi.sourceUpdated")}</dt><dd>{sourceDate(source.source_updated_at)}</dd></div>
              <div><dt>{t("evidenceUi.license")}</dt><dd>{source.license || t("common.unknown")}</dd></div>
            </dl>
          </li>;
        })}</ol>}
      </div>
    </details>
  );
}
