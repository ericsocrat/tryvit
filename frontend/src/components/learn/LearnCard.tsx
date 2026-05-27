import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { type ReactNode } from "react";

interface LearnCardProps {
  /** Lucide icon component or ReactNode for the topic. */
  readonly icon: LucideIcon | ReactNode;
  /** Translated title. */
  readonly title: string;
  /** Translated short description. */
  readonly description: string;
  /** Link to the topic page, e.g. "/learn/nutri-score". */
  readonly href: string;
  /** Optional additional classes. */
  readonly className?: string;
}

/**
 * Card component for the /learn hub index page.
 * Shows an icon, title, and short description for each topic.
 */
export function LearnCard({
  icon,
  title,
  description,
  href,
  className = "",
}: LearnCardProps) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border border-border/70 bg-surface/95 p-6 shadow-sm transition-interactive hover-lift ${className}`}
    >
      <div className="mb-4 flex items-center" aria-hidden="true">
        {typeof icon === "function" ||
        (typeof icon === "object" &&
          icon !== null &&
          "render" in (icon as unknown as Record<string, unknown>))
          ? React.createElement(icon as LucideIcon, { size: 32 })
          : icon}
      </div>
      <h2 className="mb-2 text-lg font-semibold text-foreground transition-colors group-hover:text-brand-hover">
        {title}
      </h2>
      <p className="text-sm leading-6 text-foreground-secondary">
        {description}
      </p>
    </Link>
  );
}
