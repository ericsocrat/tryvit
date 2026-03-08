"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { getCachedProductCount } from "@/lib/cache-manager";
import { useTranslation } from "@/lib/i18n";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const [cachedCount, setCachedCount] = useState(0);

  useEffect(() => {
    if (!isOnline) {
      getCachedProductCount()
        .then(setCachedCount)
        .catch(() => setCachedCount(0));
    }
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <output
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-50 bg-warning px-4 py-1.5 text-center text-xs font-medium text-white"
    >
      <WifiOff size={14} aria-hidden="true" className="inline" />{" "}
      {t("pwa.offline")}
      {cachedCount > 0 && (
        <span className="ml-1">
          — {t("pwa.cachedProductsAvailable", { count: cachedCount })}
        </span>
      )}
    </output>
  );
}
