"use client";

import { Skeleton, SkeletonContainer } from "@/components/common/Skeleton";
import { useTranslation } from "@/lib/i18n";
import styles from "@/components/dashboard/DashboardWorkspace.module.css";

export function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonContainer label={t("dashboard.home.loading")} className={styles.workspace}>
      <div data-testid="dashboard-loading" className={styles.skeletonRows}><Skeleton variant="text" width="9rem" height={12} /><Skeleton variant="text" width="65%" height={38} /><Skeleton variant="text" width="80%" height={18} /></div>
      <div className={styles.skeletonStart}><Skeleton variant="text" width="45%" height={24} /><Skeleton variant="rect" width="65%" height={56} className="mt-6" /></div>
      <div className={styles.columns}>
        {[0, 1].map((section) => <div key={section} className={styles.skeletonRows}><Skeleton variant="text" width="50%" height={24} />{[0, 1, 2].map((row) => <Skeleton key={row} variant="rect" height={56} />)}</div>)}
      </div>
    </SkeletonContainer>
  );
}
