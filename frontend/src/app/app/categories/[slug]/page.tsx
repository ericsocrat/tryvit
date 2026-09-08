import { notFound, redirect } from "next/navigation";
import { findFilterOptions, findHref } from "@/lib/evidence/search";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/server-locale";
import { translate } from "@/lib/i18n-core";
import Link from "next/link";

/** Resolve the actual registry slug, never guess punctuation/case from a label. */
export default async function CategoryPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const [{ slug }, language, supabase] = await Promise.all([params, getServerLocale(), createServerSupabaseClient()]);
  const options = await findFilterOptions(supabase, null, language);
  if (!options.ok) return <section role="alert"><h1>{translate(language, "findUi.filtersUnavailable")}</h1><p>{translate(language, "evidenceUi.retryExplanation")}</p><Link href="/app/search?panel=categories">{translate(language, "nav.find")}</Link></section>;
  const category = options.data.categories.find((item) => item.slug === slug);
  if (!category) notFound();
  redirect(findHref({ q: "", filters: { category: [category.value], country: options.data.country }, page: 1, showAvoided: false }));
}
