"use client";

import { DashboardGuide, DashboardHeader, DashboardStart } from "./DashboardWorkspace";
import styles from "./DashboardWorkspace.module.css";

/** No personal data or catalogue requests are needed to offer a useful first step. */
export function NewUserWelcome() {
  return (
    <section className={styles.workspace} aria-labelledby="dashboard-title" data-testid="new-user-welcome">
      <DashboardHeader firstUse />
      <DashboardStart firstUse />
      <DashboardGuide firstUse />
    </section>
  );
}
