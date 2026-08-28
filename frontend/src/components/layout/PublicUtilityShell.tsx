import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import type { ReactNode } from "react";

import styles from "./PublicUtilityShell.module.css";

export function PublicUtilityShell({
  eyebrow,
  title,
  description,
  register,
  actions,
  heroAsArticle = false,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  register?: ReactNode;
  actions?: ReactNode;
  heroAsArticle?: boolean;
  children: ReactNode;
}>) {
  const Hero = heroAsArticle ? "article" : "header";

  return (
    <div className={styles.shell}>
      <Header />
      <main id="main-content" className={styles.main}>
        <Hero className={styles.hero}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
          {register ? <div className={styles.register}>{register}</div> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </Hero>
        <div className={styles.content}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export { styles as publicUtilityStyles };
