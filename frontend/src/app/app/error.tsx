// ─── App-level error boundary ─────────────────────────────────────────────
// Catches errors within /app/* route segments. More specific than root error.tsx.
// Renders within the app layout (navigation stays intact).

"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button, ButtonLink } from "@/components/common/Button";
import { ErrorIllustration } from "@/components/common/ErrorIllustration";

import styles from "./error.module.css";

export default function AppError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const { t } = useTranslation();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[AppErrorBoundary]", error);
    }
  }, [error]);

  return (
    <section
      className={styles.state}
      role="alert"
      data-testid="error-boundary-page"
    >
      <div className={styles.inner}>
        <ErrorIllustration type="server-error" className={styles.illustration} />
        <h2 className={styles.title}>{t("errorBoundary.pageTitle")}</h2>
        <p className={styles.description}>{t("errorBoundary.pageDescription")}</p>
        {error.digest ? (
          <p className={styles.digest}>
            {t("errorBoundary.errorId")}: {error.digest}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button onClick={reset}>{t("common.tryAgain")}</Button>
          <ButtonLink href="/app" variant="secondary">
            {t("errorBoundary.goHome")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
