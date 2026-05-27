import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface LearnArticleShellProps {
  readonly eyebrow?: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly summary: string;
  readonly children: ReactNode;
}

export function LearnArticleShell({
  eyebrow = "Learn",
  icon: Icon,
  title,
  summary,
  children,
}: LearnArticleShellProps) {
  return (
    <article className="overflow-hidden rounded-4xl border border-border/70 bg-surface/95 shadow-[0_32px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:shadow-[0_32px_90px_rgba(0,0,0,0.28)]">
      <div className="border-b border-border/60 bg-linear-to-br from-brand-subtle/80 via-surface to-surface px-6 py-6 md:px-8 md:py-8">
        <p className="inline-flex rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {eyebrow}
        </p>

        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-foreground shadow-sm ring-1 ring-border/60">
            <Icon size={24} aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-foreground-secondary md:text-lg">
              {summary}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 md:px-8 md:py-8">{children}</div>
    </article>
  );
}
