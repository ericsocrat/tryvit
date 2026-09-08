"use client";

// ─── AddToListMenu ──────────────────────────────────────────────────────────
// Dropdown button that lets users quickly add/remove a product from their
// lists. Shows ❤️ toggle for favorites, plus any other lists in a dropdown.
// Stops click propagation so it works inside <Link>-wrapped product rows.
//
// Uses useProductListMembership to lazily fetch which lists contain this
// product when the dropdown opens, and Zustand stores for compact badges.

import {
    useAddToList,
    useLists,
    useProductListMembership,
    useRemoveFromList,
} from "@/hooks/use-lists";
import { useTranslation } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import type { ProductList } from "@/lib/types";
import { useFavoritesStore } from "@/stores/favorites-store";
import {
    Ban,
    CheckCircle,
    Circle,
    ClipboardList,
    Heart,
    Plus,
    type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getListIcon(
  listType: string,
  inList: boolean,
): { icon: LucideIcon; filled?: boolean } {
  switch (listType) {
    case "favorites":
      return { icon: Heart, filled: inList };
    case "avoid":
      return { icon: inList ? Ban : Circle };
    default:
      return { icon: inList ? CheckCircle : Plus };
  }
}

interface AddToListMenuProps {
  readonly productId: number;
  /** Compact mode: just the heart icon for favorites toggle */
  readonly compact?: boolean;
  readonly showLabel?: boolean;
}

export function AddToListMenu({ productId, compact, showLabel = false }: AddToListMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuOffset, setMenuOffset] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

  const listsQuery = useLists();
  const { data: listsResponse } = listsQuery;
  const addMutation = useAddToList();
  const removeMutation = useRemoveFromList();

  // Lazy load membership only when dropdown is open
  const membershipQuery = useProductListMembership(productId, open);
  const { data: membership } = membershipQuery;
  const memberListIds = useMemo(
    () => new Set(membership?.list_ids ?? []),
    [membership?.list_ids],
  );

  // Zustand store for compact heart toggle
  const isFavorite = useFavoritesStore((s) => s.isFavorite(productId));

  const lists: ProductList[] = listsResponse?.lists ?? [];
  const favoritesList = lists.find((l) => l.list_type === "favorites");
  const reading = Boolean(listsQuery.isPending || membershipQuery.isPending);
  const unavailable = Boolean(listsQuery.isError || membershipQuery.isError ||
    (!listsQuery.isPending && !Array.isArray(listsResponse?.lists)) ||
    (open && !membershipQuery.isPending && !Array.isArray(membership?.list_ids)));

  useEffect(() => {
    if (!open || reading || unavailable) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, reading, unavailable]);

  // Close dropdown on click-outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isInList = useCallback(
    (list: ProductList) => memberListIds.has(list.id),
    [memberListIds],
  );

  const toggleList = useCallback(
    (list: ProductList) => {
      if (isInList(list)) {
        removeMutation.mutate({
          listId: list.id,
          productId,
          listType: list.list_type,
        });
      } else {
        addMutation.mutate({
          listId: list.id,
          productId,
          listType: list.list_type,
        });
      }
    },
    [isInList, removeMutation, addMutation, productId],
  );

  const isBusy = addMutation.isPending || removeMutation.isPending;
  const mutationError = addMutation.error ?? removeMutation.error;
  const mutationErrorId = `list-membership-error-${productId}`;

  // Compact mode: just the heart icon for favorites
  if (compact && favoritesList) {
    return (
      <span className="relative shrink-0">
        <button
          type="button"
          disabled={isBusy}
          title={
            isFavorite
              ? t("productActions.removeFromFavorites")
              : t("productActions.addToFavorites")
          }
          aria-label={
            isFavorite
              ? t("productActions.removeFromFavorites")
              : t("productActions.addToFavorites")
          }
          aria-describedby={mutationError ? mutationErrorId : undefined}
          className="touch-target text-xl transition-transform hover:scale-110 disabled:opacity-50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isFavorite) {
              removeMutation.mutate(
                {
                  listId: favoritesList.id,
                  productId,
                  listType: "favorites",
                },
                {
                  onError: () => {
                    showToast({
                      type: "error",
                      messageKey: "productActions.updateFailed",
                    });
                  },
                },
              );
            } else {
              addMutation.mutate(
                {
                  listId: favoritesList.id,
                  productId,
                  listType: "favorites",
                },
                {
                  onError: () => {
                    showToast({
                      type: "error",
                      messageKey: "productActions.updateFailed",
                    });
                  },
                },
              );
            }
          }}
        >
          <Heart
            size={20}
            aria-hidden="true"
            className={
              isFavorite ? "fill-red-500 text-red-500" : "text-foreground-muted"
            }
          />
        </button>
        {mutationError && (
          <span id={mutationErrorId} className="sr-only">
            {t("productActions.updateFailed")}
          </span>
        )}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title={t("productActions.addToList")}
        aria-label={t("productActions.addToList")}
        aria-expanded={open}
        aria-haspopup="true"
        aria-describedby={mutationError ? mutationErrorId : undefined}
        className={`touch-target flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm transition-colors hover:bg-surface-subtle ${showLabel ? "border border-strong px-3 font-medium" : "w-11"}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const menuWidth = Math.min((Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * 14, window.innerWidth - 32);
            setMenuOffset(Math.min(Math.max(rect.left, 16), window.innerWidth - menuWidth - 16) - rect.left);
          }
          setOpen((v) => !v);
        }}
      >
        <ClipboardList size={20} aria-hidden="true" />
        {showLabel ? <span>{t("productActions.addToList")}</span> : null}
      </button>

      {mutationError && (
        <span id={mutationErrorId} role="alert" className="sr-only">
          {t("productActions.updateFailed")}
        </span>
      )}

      {open && (
        <div
          ref={menuRef}
          className="absolute top-full z-50 mt-1 w-56 rounded-xl border border-border bg-surface py-1 shadow-lg"
          style={{ left: menuOffset, maxWidth: "calc(100vw - 2rem)" }}
          role="menu"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          <p className="px-3 py-1.5 text-xs font-medium text-foreground-muted">
            {t("productActions.yourLists")}
          </p>

          {mutationError && (
            <p
              className="mx-2 mb-1 rounded-md bg-error-bg px-2 py-1.5 text-xs text-error-text"
            >
              {t("productActions.updateFailed")}
            </p>
          )}

          {reading ? <p role="status" className="px-3 py-2 text-sm">{t("common.loading")}</p> : null}
          {unavailable && !reading ? <div className="px-3 py-2 text-sm">
            <p role="alert">{t("lists.loadFailed")}</p>
            <button type="button" role="menuitem" className="min-h-11 underline" onClick={() => {
              void listsQuery.refetch();
              void membershipQuery.refetch();
            }}>{t("common.retry")}</button>
          </div> : null}
          {!reading && !unavailable && lists.length === 0 && (
            <p className="px-3 py-2 text-sm text-foreground-muted">
              {t("productActions.noLists")}
            </p>
          )}

          {lists.map((list) => {
            const inList = isInList(list);
            const { icon: ListIcon, filled } = getListIcon(
              list.list_type,
              inList,
            );

            return (
              <button
                key={list.id}
                type="button"
                role="menuitem"
                disabled={isBusy || reading || unavailable}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-subtle disabled:opacity-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleList(list);
                }}
              >
                <span className="shrink-0">
                  <ListIcon
                    size={16}
                    aria-hidden="true"
                    className={filled ? "fill-current text-red-500" : ""}
                  />
                </span>
                <span className="flex-1 truncate text-foreground-secondary">
                  {list.name}
                </span>
                {inList && (
                  <span className="text-xs text-foreground-muted">
                    {t("productActions.remove")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
