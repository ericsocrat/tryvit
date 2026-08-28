import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./LearnExperience.module.css";

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
    <article className={styles.article}>
      <div className={styles.articleHeader}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <div className={styles.articleIdentity}>
          <div className={styles.icon}>
            <Icon size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.summary}>{summary}</p>
          </div>
        </div>
      </div>
      <div className={styles.articleBody}>{children}</div>
    </article>
  );
}
