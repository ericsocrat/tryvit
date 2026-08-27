"use client";

/**
 * WatchButton — toggle button on product profile for watch/unwatch.
 * Calls api_watch_product / api_unwatch_product.
 * Shows a notification prompt after the first successful watch action.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Icon } from "@/components/common/Icon";
import { createClient } from "@/lib/supabase/client";
import { watchProduct, unwatchProduct, isWatchingProduct } from "@/lib/api";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { NotificationPrompt } from "@/components/pwa/NotificationPrompt";

interface WatchButtonProps {
  productId: number;
  compact?: boolean;
  className?: string;
}

export function WatchButton({
  productId,
  compact = false,
  className,
}: Readonly<WatchButtonProps>) {
  const { t } = useTranslation();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [optimisticWatching, setOptimisticWatching] = useState<boolean | null>(
    null,
  );
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  const {
    data: watchStatus,
    error: watchStatusError,
    isLoading,
    refetch: refetchWatchStatus,
  } = useQuery({
    queryKey: queryKeys.isWatching(productId),
    queryFn: async () => {
      const result = await isWatchingProduct(supabase, productId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.isWatching,
  });

  const watching = optimisticWatching ?? watchStatus?.watching ?? false;

  const watchMutation = useMutation({
    mutationFn: async () => {
      const result = await watchProduct(supabase, productId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: () => setOptimisticWatching(true),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.isWatching(productId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist() });
      // Show notification prompt after first watch
      setShowNotifPrompt(true);
    },
    onSettled: () => setOptimisticWatching(null),
  });

  const unwatchMutation = useMutation({
    mutationFn: async () => {
      const result = await unwatchProduct(supabase, productId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: () => setOptimisticWatching(false),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.isWatching(productId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist() });
    },
    onSettled: () => setOptimisticWatching(null),
  });

  const isMutating = watchMutation.isPending || unwatchMutation.isPending;
  const mutationError = watchMutation.error ?? unwatchMutation.error;
  const mutationErrorId = `watch-button-error-${productId}`;

  function handleToggle() {
    if (isMutating) return;
    if (watching) {
      unwatchMutation.mutate();
    } else {
      watchMutation.mutate();
    }
  }

  const label = watching
    ? t("watchlist.unwatchButton")
    : t("watchlist.watchButton");

  if (isLoading) {
    return (
      <button
        disabled
        className={`touch-target inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary ${className ?? ""}`}
        data-testid="watch-button-loading"
      >
        <Icon icon={Loader2} size="sm" className="animate-spin" />
        {!compact && <span>{t("watchlist.loading")}</span>}
      </button>
    );
  }

  if (watchStatusError) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled
          aria-label={t("watchlist.statusUnavailable")}
          aria-describedby={mutationErrorId}
          className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-warning-border px-3 py-2 text-sm text-warning-text opacity-80"
          data-testid="watch-button-error"
        >
          <Icon icon={EyeOff} size="sm" />
          {!compact && <span>{t("watchlist.statusUnavailable")}</span>}
        </button>
        <p id={mutationErrorId} role="alert" className="mt-1 text-xs text-warning-text">
          {t("watchlist.statusUnavailableDescription")} {" "}
          <button
            type="button"
            onClick={() => {
              void refetchWatchStatus();
            }}
            className="font-semibold underline underline-offset-2"
          >
            {t("common.retry")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={isMutating}
        aria-pressed={watching}
        aria-label={label}
        aria-describedby={mutationError ? mutationErrorId : undefined}
        className={`touch-target inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          watching
            ? "border-brand bg-brand-subtle text-brand"
            : "border-border text-foreground-secondary hover:bg-surface-muted hover:text-foreground"
        } ${isMutating ? "opacity-70" : ""} ${className ?? ""}`}
        data-testid="watch-button"
      >
        {isMutating && (
          <Icon icon={Loader2} size="sm" className="animate-spin" />
        )}
        {!isMutating && watching && <Icon icon={Eye} size="sm" />}
        {!isMutating && !watching && <Icon icon={EyeOff} size="sm" />}
        {!compact && <span>{label}</span>}
      </button>
      {mutationError && (
        <p
          id={mutationErrorId}
          role="alert"
          className="mt-1 max-w-64 text-xs text-error-text"
        >
          {t("watchlist.updateFailed")}
        </p>
      )}
      {showNotifPrompt && (
        <NotificationPrompt onDismiss={() => setShowNotifPrompt(false)} />
      )}
    </div>
  );
}
