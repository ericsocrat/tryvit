import type { ReactNode } from "react";

import styles from "./AppPage.module.css";

export function AppPage({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={[styles.page, className].filter(Boolean).join(" ")}>{children}</div>;
}

export function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  register,
}: Readonly<{
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  register?: ReactNode;
}>) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {register ? <div className={styles.register}>{register}</div> : null}
    </header>
  );
}

export function AppSectionHeader({
  label,
  title,
  meta,
}: Readonly<{ label?: string; title: string; meta?: ReactNode }>) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        {label ? <p className={styles.registerLabel}>{label}</p> : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {meta !== null && meta !== undefined ? (
        <div className={styles.sectionMeta}>{meta}</div>
      ) : null}
    </div>
  );
}
