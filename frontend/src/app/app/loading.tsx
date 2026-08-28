import { Skeleton, SkeletonContainer } from "@/components/common/Skeleton";
import styles from "@/components/layout/AppShell.module.css";

export default function AppLoading() {
  return (
    <SkeletonContainer label="Loading application" className={styles.loadingRegister}>
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div className="w-full max-w-xl space-y-3">
          <Skeleton variant="text" width="7rem" height={10} />
          <Skeleton variant="text" width="min(22rem, 80%)" height={30} />
        </div>
        <Skeleton variant="rect" width={88} height={44} />
      </div>
      <div className="grid gap-px border border-border bg-border md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 bg-surface p-5"
            data-testid="app-loading-register-cell"
          >
            <Skeleton variant="text" width="5rem" height={10} />
            <Skeleton variant="text" lines={2} />
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}
