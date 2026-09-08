"use client";

import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import surface from "@/components/layout/CustomerSurface.module.css";
import { deleteHealthProfile, listHealthProfiles } from "@/lib/api";
import { HEALTH_CONDITIONS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/** Preserved owner records only; these settings no longer drive health warnings. */
export function HealthProfileSection() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string; name: string } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.healthProfiles,
    queryFn: async () => {
      const result = await listHealthProfiles(supabase);
      if (!result.ok || !Array.isArray(result.data.profiles)) throw new Error("Profile archive unavailable");
      return result.data;
    },
    staleTime: staleTimes.healthProfiles,
  });
  const profiles = data?.profiles ?? [];

  async function handleDelete(profileId: string) {
    if (deleting !== null) return;
    setDeleting(profileId);
    setDeleteFailed(false);
    try {
      const result = await deleteHealthProfile(supabase, profileId);
      if (!result.ok || result.data.deleted !== true || result.data.profile_id !== profileId) {
        setDeleteFailed(true);
        return;
      }
      showToast({ type: "success", messageKey: "healthProfile.profileDeleted" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.healthProfiles });
      await queryClient.invalidateQueries({ queryKey: queryKeys.activeHealthProfile });
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(null);
    }
  }

  return <section className={surface.panel} data-testid="health-profile-section" aria-labelledby="health-profile-archive-title">
    <h2 id="health-profile-archive-title" className="text-sm font-semibold text-foreground">{t("healthProfile.title")}</h2>
    <p className="mt-2 text-sm text-foreground-secondary">{t("healthProfile.archiveDescription")}</p>
    <p className="mt-2 text-sm text-foreground-secondary">{t("healthProfile.allergenPreferencesNotice")}</p>
    {isLoading ? <p className="mt-3 text-sm" role="status">{t("common.loading")}</p> : null}
    {error ? <div className="mt-3" role="alert">
      <p>{t("healthProfile.archiveLoadFailed")}</p>
      <Button variant="secondary" onClick={() => void refetch()}>{t("common.retry")}</Button>
    </div> : null}
    {!isLoading && !error && profiles.length === 0 ? <p className="mt-3 text-sm text-foreground-muted">{t("healthProfile.emptyState")}</p> : null}
    {deleteFailed ? <p role="alert" className="mt-3 text-sm text-error-text">{t("healthProfile.archiveDeleteFailed")}</p> : null}
    {profiles.length > 0 ? <ul className="mt-3 space-y-3">
      {profiles.map((profile) => <li key={profile.profile_id} className="rounded-lg border p-3">
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-foreground">{profile.profile_name}</summary>
          <p className="mt-2 text-xs text-foreground-secondary">{t("healthProfile.storedActiveFlag")}: {t(profile.is_active ? "healthProfile.flagYes" : "healthProfile.flagNo")}</p>
          {profile.health_conditions.length > 0 ? <p className="mt-2 text-sm">{t("healthProfile.healthConditions")}: {profile.health_conditions.map((condition) => {
            const known = HEALTH_CONDITIONS.find((item) => item.value === condition);
            return known ? t(known.labelKey) : condition;
          }).join(", ")}</p> : null}
          <h3 className="mt-3 text-sm font-medium">{t("healthProfile.storedLimits")}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt>{t("healthProfile.maxSugar")}</dt><dd>{profile.max_sugar_g ?? "—"}</dd>
            <dt>{t("healthProfile.maxSalt")}</dt><dd>{profile.max_salt_g ?? "—"}</dd>
            <dt>{t("healthProfile.maxSatFat")}</dt><dd>{profile.max_saturated_fat_g ?? "—"}</dd>
            <dt>{t("healthProfile.maxCalories")}</dt><dd>{profile.max_calories_kcal ?? "—"}</dd>
          </dl>
          {profile.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{profile.notes}</p> : null}
        </details>
        <Button variant="secondary" size="sm" disabled={deleting !== null} aria-label={`${t("common.delete")} ${profile.profile_name}`} onClick={() => setConfirmation({ id: profile.profile_id, name: profile.profile_name })}>{t("common.delete")}</Button>
      </li>)}
    </ul> : null}
    <ConfirmDialog open={confirmation !== null} title={t("healthProfile.archiveDeleteConfirm", { name: confirmation?.name ?? "" })} description={t("healthProfile.archiveDeleteConfirmDescription")} confirmLabel={t("common.delete")} variant="danger" onCancel={() => setConfirmation(null)} onConfirm={() => {
      if (!confirmation) return;
      const id = confirmation.id;
      setConfirmation(null);
      void handleDelete(id);
    }} />
  </section>;
}
