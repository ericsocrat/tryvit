"use client";

import { Button } from "@/components/common/Button";
import { ErrorIllustration } from "@/components/common/ErrorIllustration";
import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
import { useTranslation } from "@/lib/i18n";

export default function OfflinePage() {
  const { t } = useTranslation();
  return (
    <PublicUtilityShell
      title={t("offline.title")}
      description={t("offline.offlinePage")}
    >
      <section className="text-center">
        <ErrorIllustration type="offline" className="mx-auto mb-2" />
        <Button onClick={() => globalThis.location.reload()}>{t("offline.tryAgain")}</Button>
      </section>
    </PublicUtilityShell>
  );
}
