"use client";

import { Button } from "@/components/common/Button";
import { ALLERGEN_TAGS } from "@/lib/constants";
import { findFilterOptions, findQueryKeys, type FindFilters } from "@/lib/evidence/search";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./FilterPanel.module.css";

interface FilterPanelProps {
  filters: FindFilters; onChange: (filters: FindFilters) => void;
  show: boolean; onClose: () => void; country: string; userId: string;
}
export function FilterPanel(props: Readonly<FilterPanelProps>) {
  return props.show ? <FilterDialog {...props} /> : null;
}
function FilterDialog({ filters, onChange, onClose, country, userId }: Readonly<FilterPanelProps>) {
  const { t, language } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const options = useQuery({
    queryKey: findQueryKeys.filters(country, language, userId),
    queryFn: async () => {
      const result = await findFilterOptions(createClient(), country, language);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 10 * 60_000,
  });
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    if (element && !element.open) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    }
    closeButton.current?.focus();
    return () => {
      if (element?.open && typeof element.close === "function") element.close();
      previous?.focus();
    };
  }, []);
  function toggle(key: "category" | "nova_group" | "allergen_free", value: string) {
    const current = filters[key] ?? [];
    const next = current.some((item) => item === value) ? current.filter((item) => item !== value) : [...current, value];
    onChange({ ...filters, [key]: next.length ? next : undefined });
  }

  return <dialog ref={dialog} aria-labelledby="find-filter-title" className={styles.dialog}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]') ?? [])];
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={styles.header}><h2 id="find-filter-title">{t("findUi.filtersTitle")}</h2><button type="button" ref={closeButton} onClick={onClose} aria-label={t("common.close")}><X size={20} aria-hidden="true" /></button></header>
    <div className={styles.body}>
      <label className={styles.label}>{t("findUi.market")}<select value={filters.country ?? country} onChange={(event) => onChange({ ...filters, country: event.target.value as "PL" | "DE", category: undefined })}><option value="PL">{t("findUi.poland")}</option><option value="DE">{t("findUi.germany")}</option></select></label>
      <fieldset><legend>{t("findUi.categories")}</legend>
        {options.isPending ? <p role="status">{t("common.loading")}</p> : options.isError ? <div role="alert"><p>{t("findUi.filtersUnavailable")}</p><Button variant="secondary" onClick={() => void options.refetch()}>{t("common.retry")}</Button></div> : (
          <div className={styles.options}>{options.data?.categories.map((category) => <label key={category.value}><input type="checkbox" checked={filters.category?.includes(category.value) ?? false} onChange={() => toggle("category", category.value)} />{category.label}</label>)}</div>
        )}
      </fieldset>
      <fieldset><legend>{t("findUi.nova")}</legend><p className={styles.hint}>{t("findUi.novaExplanation")}</p><div className={styles.options}>{(["1", "2", "3", "4"] as const).map((value) => <label key={value}><input type="checkbox" checked={filters.nova_group?.includes(value) ?? false} onChange={() => toggle("nova_group", value)} />NOVA {value}</label>)}</div></fieldset>
      <fieldset><legend>{t("findUi.excludeContains")}</legend><p className={styles.hint}>{t("findUi.allergenExplanation")}</p><div className={styles.options}>{ALLERGEN_TAGS.map((allergen) => <label key={allergen.tag}><input type="checkbox" checked={filters.allergen_free?.includes(allergen.tag) ?? false} onChange={() => toggle("allergen_free", allergen.tag)} />{t(allergen.labelKey)}</label>)}</div></fieldset>
    </div>
    <footer className={styles.footer}><Button variant="secondary" onClick={() => onChange({})}>{t("filters.clearAll")}</Button><Button onClick={onClose}>{t("filters.showResults")}</Button></footer>
  </dialog>;
}
