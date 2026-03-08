"use client";

import { timeAgo } from "@/lib/cache-manager";
import { useTranslation } from "@/lib/i18n";
import { Clock } from "lucide-react";

interface CachedTimestampProps {
  readonly cachedAt: number;
}

/**
 * Shows "Cached 2h ago" badge when viewing a product from offline cache.
 */
export function CachedTimestamp({ cachedAt }: CachedTimestampProps) {
  const { t } = useTranslation();
  return (
    <output className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning-text">
      <Clock size={12} aria-hidden="true" />
      {t("pwa.cachedAgo", { time: timeAgo(cachedAt) })}
    </output>
  );
}
