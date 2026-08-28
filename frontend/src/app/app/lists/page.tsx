"use client";

// ─── Lists overview page ────────────────────────────────────────────────────
// Shows all user lists with item counts, create-new-list form, and links to
// individual list detail pages. Default lists (Favorites, Avoid) show first.

import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { ListViewSkeleton } from "@/components/common/skeletons";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useCreateList, useDeleteList, useLists } from "@/hooks/use-lists";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import type { FormSubmitEvent, ProductList } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, FileText, Heart, Link2, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import styles from "./lists.module.css";

export default function ListsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const lists: ProductList[] = data?.lists ?? [];
  const mutationError = createList.error ?? deleteList.error;

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.lists });
  }, [queryClient]);

  function handleCreate(e: FormSubmitEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createList.mutate(
      { name: newName.trim(), description: newDesc.trim() || undefined },
      {
        onSuccess: () => {
          setNewName("");
          setNewDesc("");
          setShowForm(false);
        },
      },
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <AppPage className={styles.page}>
        <Breadcrumbs items={[{ labelKey: "nav.home", href: "/app" }, { labelKey: "nav.lists" }]} />
      <AppPageHeader
        eyebrow={t("nav.lists")}
        title={t("lists.title")}
        actions={
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? t("common.cancel") : t("lists.newList")}
            </Button>
          }
        />

        {mutationError ? (
          <p role="alert" className={styles.mutationError}>
            {t("lists.mutationFailed")}
          </p>
        ) : null}

        {isLoading ? <ListViewSkeleton /> : null}

        {error ? (
          <EmptyState
            variant="error"
            titleKey="lists.loadFailed"
            action={{ labelKey: "common.retry", onClick: () => void handleRefresh() }}
          />
        ) : null}

        {/* Create form */}
        {!isLoading && !error && showForm ? (
          <form onSubmit={handleCreate} className={styles.form}>
            <input
              type="text"
              placeholder={t("lists.namePlaceholder")}
              aria-label={t("lists.nameLabel")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-field"
              maxLength={100}
              required
              autoFocus
            />
            <input
              type="text"
              placeholder={t("lists.descriptionPlaceholder")}
              aria-label={t("lists.descriptionLabel")}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input-field"
              maxLength={500}
            />
            <div className={styles.formActions}>
              <Button type="submit" size="sm" disabled={createList.isPending || !newName.trim()}>
                {createList.isPending ? t("lists.creating") : t("lists.createList")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : null}

        {/* Empty state */}
        {!isLoading && !error && lists.length === 0 ? (
          <EmptyStateIllustration type="no-lists" titleKey="lists.emptyState" />
        ) : null}

        {/* List grid */}
        {!isLoading && !error && lists.length > 0 ? (
          <ul className={styles.grid}>
            {lists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                onDelete={list.is_default ? undefined : () => setConfirmDeleteId(list.id)}
              />
            ))}
          </ul>
        ) : null}

        <ConfirmDialog
          open={confirmDeleteId !== null}
          title={t("lists.deleteList")}
          description={t("lists.deleteWarning")}
          confirmLabel={t("common.delete")}
          variant="danger"
          onConfirm={() => {
            if (confirmDeleteId) deleteList.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      </AppPage>
    </PullToRefresh>
  );
}

// ─── ListCard ───────────────────────────────────────────────────────────────

const LIST_TYPE_ICONS: Record<string, LucideIcon> = {
  favorites: Heart,
  avoid: Ban,
};

function ListCard({
  list,
  onDelete,
}: Readonly<{
  list: ProductList;
  onDelete?: () => void;
}>) {
  const { t } = useTranslation();
  const TypeIcon = LIST_TYPE_ICONS[list.list_type] ?? FileText;
  return (
    <li className={styles.listRecord}>
      <Link href={`/app/lists/${list.id}`} className={styles.listLink}>
        <span className={styles.listIcon}>
          <TypeIcon size={20} aria-hidden="true" />
        </span>

        <div className={styles.listCopy}>
          <p className={styles.listName}>{list.name}</p>
          <p className={styles.listMeta}>
            {t("common.items", { count: list.item_count })}
            {list.description && ` · ${list.description}`}
          </p>
          {list.share_enabled ? (
            <span title={t("lists.shared")} className={styles.shared}>
              <Link2 size={12} aria-hidden="true" className="inline" /> {t("lists.shared")}
            </span>
          ) : null}
        </div>
      </Link>
      {onDelete ? (
        <button
          type="button"
          title={t("common.delete")}
          aria-label={`${t("common.delete")} ${list.name}`}
          className={styles.deleteAction}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}
