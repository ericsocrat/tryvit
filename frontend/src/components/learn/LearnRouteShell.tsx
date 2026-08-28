"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./LearnExperience.module.css";

export function LearnRouteShell({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();

  return (
    <div className={styles.routeShell}>
      <Header />
      <div className={styles.routeBody}>
        <LearnSidebar />
        <main id="main-content" className={styles.routeMain}>
          <Link href="/learn" className={styles.backLink}>
            {t("learn.backToHub")}
          </Link>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
