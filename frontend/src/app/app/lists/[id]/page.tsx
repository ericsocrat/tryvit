"use client";

// ─── List detail page ───────────────────────────────────────────────────────
// Shows owner-scoped saved membership with evidence, including archived records.
// Editing/removal and revocation remain available; new public sharing is paused.

import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { ListDetailSkeleton } from "@/components/common/skeletons";
import { AppPage } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import {
  useRemoveFromList,
  useRevokeShare,
  useToggleShare,
  useUpdateList,
} from "@/hooks/use-lists";
import { useTranslation } from "@/lib/i18n";
import type { FormSubmitEvent } from "@/lib/types";
import { collectionQueryKeys, getSavedList, type SavedListEnvelope } from "@/lib/evidence/collections";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Ban, Heart, Link2, Pencil, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import styles from "@/app/app/lists/lists.module.css";

export default function ListDetailPage() {
  const params = useParams();
  const listId = String(params.id ?? "");
  return <ListDetailWorkspace key={listId} listId={listId} />;
}

function ListDetailWorkspace({ listId }: Readonly<{ listId: string }>) {
  const { t, language } = useTranslation();

  const [offset, setOffset] = useState(0);
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listId);
  const { data: itemsData, isPending: isLoading, error, refetch } = useQuery({
    queryKey: collectionQueryKeys.list(listId, offset, language),
    queryFn: async () => {
      const result = await getSavedList(createClient(), listId, offset, language);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: validId,
  });
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
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const list = itemsData ? { id: itemsData.list_id, name: itemsData.list_name, description: itemsData.description, list_type: itemsData.list_type, item_count: itemsData.total_count, share_enabled: itemsData.share_enabled, share_token: itemsData.share_token } : undefined;
  const items = itemsData?.items ?? [];
  const mutationError =
    removeMutation.error ??
    updateMutation.error ??
    toggleShareMutation.error ??
    revokeShareMutation.error;

  function handleSaveEdit(e: FormSubmitEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    resetMutationErrors();
    updateMutation.mutate(
      {
        listId,
        name: editName.trim(),
        description: editDesc.trim(),
      },
      {
        onSuccess: () => { setEditing(false); void refetch(); },
      },
    );
  }

  function handleShare(enabled: boolean) {
    resetMutationErrors();
    toggleShareMutation.mutate({ listId, enabled }, { onSuccess: () => void refetch() });
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
    revokeShareMutation.mutate(listId, { onSuccess: () => void refetch() });
    setShowRevokeConfirm(false);
  }

  if (!validId) return <AppPage><EmptyState variant="error" titleKey="lists.loadListFailed" action={{ labelKey: "nav.saved", href: "/app/lists" }} /></AppPage>;

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
                aria-label={t("lists.nameLabel")}
                autoFocus
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="input-field"
                placeholder={t("lists.descriptionPlaceholder")}
                aria-label={t("lists.descriptionLabel")}
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
              </div>
            </>
          )}

          {/* Share panel */}
          {showSharePanel && list.list_type !== "avoid" ? (
            <div className={styles.sharePanel}>
              <p className={styles.shareTitle}>{t("lists.sharing")}</p>
              <p>{t("evidenceUi.sharingPaused")}</p>
              <div className={styles.shareActions}>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    list.share_enabled
                      ? "bg-info/15 text-info"
                      : "bg-surface-muted text-foreground-secondary"
                  }`}
                  onClick={() => handleShare(!list.share_enabled)}
                  disabled={toggleShareMutation.isPending || !list.share_enabled}
                >
                  {list.share_enabled ? t("lists.on") : t("lists.off")}
                </button>
                {list.share_enabled && list.share_token ? (
                  <>
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
          titleKey={itemsData && itemsData.total_count > 0 ? "findUi.emptyPage" : "lists.emptyList"}
          action={itemsData && itemsData.total_count > 0 ? { labelKey: "findUi.firstPage", onClick: () => setOffset(0) } : { labelKey: "lists.searchProducts", href: "/app/search" }}
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

      {itemsData && itemsData.total_count > itemsData.limit ? <nav className={styles.formActions} aria-label={t("evidenceUi.savedPagination")}><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 20))}>{t("common.prev")}</Button><span>{t("findUi.page", { page: Math.floor(offset / 20) + 1, pages: Math.ceil(itemsData.total_count / 20) })}</span><Button variant="secondary" disabled={offset + 20 >= itemsData.total_count} onClick={() => setOffset((value) => value + 20)}>{t("common.next")}</Button></nav> : null}

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
  item: SavedListEnvelope["items"][number];
  onRemove: () => void;
  isRemoving: boolean;
}>) {
  const { t } = useTranslation();
  const product = item.product;
  const name = product?.product_name ?? t("evidenceUi.productReference", { id: item.product_id });
  return (
    <ProductRegisterCard
      productId={item.product_id}
      href={`/app/product/${item.product_id}`}
      name={name}
      brand={product?.brand}
      category={product?.category}
      readModel={product ?? undefined}
      highlight={product ? (product.is_deprecated ? t("evidenceUi.archivedProduct") : undefined) : t("evidenceUi.collectionUnavailable")}
      detail={item.notes ?? undefined}
      variant="list"
      muted
      actions={
        <button
          type="button"
          title={t("lists.removeFromList")}
          aria-label={`${t("lists.removeFromList")} ${name}`}
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
