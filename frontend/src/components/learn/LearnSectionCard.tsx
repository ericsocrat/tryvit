import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./LearnExperience.module.css";

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
      className={[styles.section, className].filter(Boolean).join(" ")}
    >
      <div className={styles.sectionHeader}>
        {Icon ? (
          <div className={styles.icon}>
            <Icon size={18} aria-hidden="true" />
          </div>
        ) : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
