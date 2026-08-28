"use client";

// ─── List detail page ───────────────────────────────────────────────────────
// Shows all products in a list with health scores, supports removing items,
// and has share toggle for custom/favorites lists.

import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { ListDetailSkeleton } from "@/components/common/skeletons";
import { ExportButton } from "@/components/export/ExportButton";
import { AppPage } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import {
  useListItems,
  useLists,
  useRemoveFromList,
  useRevokeShare,
  useToggleShare,
  useUpdateList,
} from "@/hooks/use-lists";
import { scoreBandFromScore } from "@/lib/constants";
import type { ExportableProduct } from "@/lib/export";
import { useTranslation } from "@/lib/i18n";
import type { FormSubmitEvent, ListItem } from "@/lib/types";
import { Ban, Heart, Link2, Pencil, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import styles from "@/app/app/lists/lists.module.css";

export default function ListDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const listId = String(params.id ?? "");

  const { data: listsData } = useLists();
  const { data: itemsData, isLoading, error, refetch } = useListItems(listId);
  const removeMutation = useRemoveFromList();
  const updateMutation = useUpdateList();
  const toggleShareMutation = useToggleShare();
  const revokeShareMutation = useRevokeShare();

  function resetMutationErrors() {
    removeMutation.reset();
    updateMutation.reset();
    toggleShareMutation.reset();
    revokeShareMutation.reset();
  }

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const list = listsData?.lists?.find((l) => l.id === listId);
  const items: ListItem[] = itemsData?.items ?? [];
  const mutationError =
    removeMutation.error ??
    updateMutation.error ??
    toggleShareMutation.error ??
    revokeShareMutation.error;

  const exportableProducts: ExportableProduct[] = useMemo(
    () =>
      items.map((item) => ({
        product_name: item.product_name,
        brand: item.brand,
        category: item.category,
        unhealthiness_score: item.unhealthiness_score,
        nutri_score_label: item.nutri_score_label,
        nova_group: item.nova_classification,
        calories_kcal: item.calories ?? undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsData?.items],
  );

  function handleSaveEdit(e: FormSubmitEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    resetMutationErrors();
    updateMutation.mutate(
      {
        listId,
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      },
      {
        onSuccess: () => setEditing(false),
      },
    );
  }

  function handleShare(enabled: boolean) {
    resetMutationErrors();
    toggleShareMutation.mutate({ listId, enabled });
  }

  function handleRemove(productId: number) {
    resetMutationErrors();
    removeMutation.mutate({
      listId,
      productId,
      listType: list?.list_type,
    });
  }

  function handleRevokeShare() {
    resetMutationErrors();
    revokeShareMutation.mutate(listId);
    setShowRevokeConfirm(false);
  }

  function handleCopyLink() {
    if (!list?.share_token) return;
    const url = `${globalThis.location.origin}/lists/shared/${list.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return <ListDetailSkeleton />;
  }

  if (error) {
    return (
      <AppPage className={styles.page}>
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "nav.lists", href: "/app/lists" },
          ]}
        />
        <EmptyState
          variant="error"
          titleKey="lists.loadListFailed"
          action={{
            labelKey: "common.retry",
            onClick: () => {
              refetch();
            },
          }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage className={styles.page}>
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.lists", href: "/app/lists" },
          { label: list?.name ?? "…" },
        ]}
      />

      {mutationError ? (
        <p role="alert" className={styles.mutationError}>
          {t("lists.mutationFailed")}
        </p>
      ) : null}

      {/* Header */}
      {list ? (
        <section className={styles.detailHeader}>
          {editing ? (
            <form onSubmit={handleSaveEdit} className={styles.form}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-field"
                maxLength={100}
                required
                autoFocus
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="input-field"
                placeholder={t("lists.descriptionPlaceholder")}
                maxLength={500}
              />
              <div className={styles.formActions}>
                <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                  {t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <h1 className={styles.detailTitle}>
                  {list.list_type === "favorites" ? (
                    <>
                      <Heart size={18} aria-hidden="true" className="inline text-red-500" />{" "}
                    </>
                  ) : null}
                  {list.list_type === "avoid" ? (
                    <>
                      <Ban size={18} aria-hidden="true" className="inline text-red-600" />{" "}
                    </>
                  ) : null}
                  {list.name}
                </h1>
                {list.description ? (
                  <p className={styles.detailDescription}>{list.description}</p>
                ) : null}
                <p className={styles.detailMeta}>{t("common.items", { count: list.item_count })}</p>
              </div>
              <div className={styles.headerActions}>
                {/* Edit button (not for defaults unless custom) */}
                <button
                  type="button"
                  title={t("lists.editList")}
                  aria-label={t("lists.editList")}
                  className={styles.iconAction}
                  onClick={() => {
                    setEditName(list.name);
                    setEditDesc(list.description ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                {/* Share button (not for avoid lists) */}
                {list.list_type !== "avoid" ? (
                  <button
                    type="button"
                    title={t("lists.shareSettings")}
                    aria-label={t("lists.shareSettings")}
                    className={`${styles.iconAction} ${list.share_enabled ? "text-brand" : ""}`}
                    onClick={() => setShowSharePanel((v) => !v)}
                  >
                    <Link2 size={14} aria-hidden="true" />
                  </button>
                ) : null}
                {/* Export button */}
                <ExportButton
                  products={exportableProducts}
                  filename={`list-${list.name.toLowerCase().replaceAll(/\s+/g, "-")}`}
                />
              </div>
            </>
          )}

          {/* Share panel */}
          {showSharePanel && list.list_type !== "avoid" ? (
            <div className={styles.sharePanel}>
              <p className={styles.shareTitle}>{t("lists.sharing")}</p>
              <div className={styles.shareActions}>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    list.share_enabled
                      ? "bg-info/15 text-info"
                      : "bg-surface-muted text-foreground-secondary"
                  }`}
                  onClick={() => handleShare(!list.share_enabled)}
                  disabled={toggleShareMutation.isPending}
                >
                  {list.share_enabled ? t("lists.on") : t("lists.off")}
                </button>
                {list.share_enabled && list.share_token ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                      {copied ? t("lists.copied") : t("lists.copyLink")}
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-error hover:text-error/80"
                      onClick={() => setShowRevokeConfirm(true)}
                    >
                      {t("lists.revoke")}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Empty state */}
      {items.length === 0 ? (
        <EmptyStateIllustration
          type="no-lists"
          titleKey="lists.emptyList"
          action={{ labelKey: "lists.searchProducts", href: "/app/search" }}
        />
      ) : null}

      {/* Items */}
      {items.length > 0 ? (
        <ul className={styles.items}>
          {items.map((item) => (
            <ListItemRow
              key={item.item_id}
              item={item}
              onRemove={() => handleRemove(item.product_id)}
              isRemoving={removeMutation.isPending}
            />
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={showRevokeConfirm}
        title={t("lists.revokeSharing")}
        description={t("lists.revokeWarning")}
        confirmLabel={t("lists.revoke")}
        variant="danger"
        onConfirm={handleRevokeShare}
        onCancel={() => setShowRevokeConfirm(false)}
      />
    </AppPage>
  );
}

// ─── ListItemRow ────────────────────────────────────────────────────────────

function ListItemRow({
  item,
  onRemove,
  isRemoving,
}: Readonly<{
  item: ListItem;
  onRemove: () => void;
  isRemoving: boolean;
}>) {
  const { t } = useTranslation();
  return (
    <ProductRegisterCard
      productId={item.product_id}
      href={`/app/product/${item.product_id}`}
      name={item.product_name}
      brand={item.brand}
      category={item.category}
      score={item.unhealthiness_score}
      scoreBand={scoreBandFromScore(item.unhealthiness_score)}
      detail={item.notes ?? undefined}
      variant="list"
      muted
      badges={<NutriScoreBadge grade={item.nutri_score_label} size="sm" />}
      actions={
        <button
          type="button"
          title={t("lists.removeFromList")}
          aria-label={`${t("lists.removeFromList")} ${item.product_name}`}
          disabled={isRemoving}
          className={styles.removeAction}
          onClick={onRemove}
        >
          <X size={16} aria-hidden="true" />
        </button>
      }
    />
  );
}
