import type { ReactNode } from "react";

export function CatalogSection({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4" data-catalog-scene={id}>
      <h2 className="border-b border-border pb-2 text-xl font-semibold text-foreground" id={`${id}-title`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CatalogRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground-secondary">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
