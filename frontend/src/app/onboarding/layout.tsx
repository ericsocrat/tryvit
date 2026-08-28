// ─── Onboarding layout ───────────────────────────────────────────────────────
// Minimal chrome for the onboarding wizard.

import { FoldedTryVitIdentity } from "@/components/common/FoldedTryVitIdentity";
import styles from "./OnboardingExperience.module.css";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.shell} data-design-system="v2">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brandIdentity}>
            <FoldedTryVitIdentity size={28} />
          </span>
        </div>
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
