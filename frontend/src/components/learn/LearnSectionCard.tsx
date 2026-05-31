import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface LearnSectionCardProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly icon?: LucideIcon;
  readonly className?: string;
}

export function LearnSectionCard({
  title,
  children,
  icon: Icon,
  className = "",
}: LearnSectionCardProps) {
  return (
    <section
      className={`rounded-2xl border border-border/70 bg-surface p-5 shadow-sm md:p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <Icon size={18} aria-hidden="true" />
          </div>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>

      <div className="mt-4 space-y-4 text-foreground-secondary leading-7">
        {children}
      </div>
    </section>
  );
}
