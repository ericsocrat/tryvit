import type { ReactNode } from "react";

export function CatalogSection({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4" data-catalog-scene={id}>
      <h2 className="catalog-v2-section-title pb-2 text-xl font-semibold" id={`${id}-title`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CatalogRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="space-y-1">
      <p className="catalog-v2-row-label text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function CatalogSpecimen({
  label,
  note,
  children,
}: Readonly<{ label: string; note: string; children: ReactNode }>) {
  return (
    <div className="catalog-v2-specimen space-y-5">
      <div className="space-y-1">
        <p className="catalog-v2-kicker">{label}</p>
        <p className="catalog-v2-copy text-sm">{note}</p>
      </div>
      {children}
    </div>
  );
}
