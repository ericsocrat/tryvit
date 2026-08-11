import { createElement, useId, type HTMLAttributes, type ReactNode } from "react";

import { Icon, type IconName } from "@/design-system/icons/Icon";

import styles from "./PageState.module.css";

export type PageStateStatus =
  "loading" | "empty" | "error" | "offline" | "degraded" | "recovering" | "paused";

export type PageStateAnnouncement = "off" | "polite" | "assertive";

export interface PageStateProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  readonly status: PageStateStatus;
  readonly title: string;
  readonly description?: string;
  /** Override the semantic default icon, or pass null to omit it. */
  readonly icon?: IconName | null;
  readonly primaryAction?: ReactNode;
  readonly secondaryAction?: ReactNode;
  /** Optional retained or recovery content, especially for degraded states. */
  readonly children?: ReactNode;
  readonly announce?: PageStateAnnouncement;
  readonly headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

const DEFAULT_ICON: Readonly<Record<PageStateStatus, IconName>> = {
  loading: "feedback.loading",
  empty: "feedback.empty",
  error: "feedback.error",
  offline: "feedback.offline",
  degraded: "feedback.degraded",
  recovering: "feedback.loading",
  paused: "feedback.paused",
};

const DEFAULT_ANNOUNCEMENT: Readonly<Record<PageStateStatus, PageStateAnnouncement>> = {
  loading: "polite",
  empty: "off",
  error: "polite",
  offline: "polite",
  degraded: "polite",
  recovering: "polite",
  paused: "polite",
};

const HEADING_TAG = Object.freeze({
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const);

/** Server-compatible hierarchy for complete page and section states. */
export function PageState({
  status,
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  children,
  announce = DEFAULT_ANNOUNCEMENT[status],
  headingLevel = 2,
  className = "",
  ...rest
}: Readonly<PageStateProps>) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const live = announce === "off" ? undefined : announce;
  const role = announce === "assertive" ? "alert" : announce === "polite" ? "status" : undefined;
  const resolvedIcon = icon === undefined ? DEFAULT_ICON[status] : icon;

  if (typeof title !== "string" || !title.trim()) {
    throw new TypeError("PageState title must be non-empty localized text.");
  }
  if (description !== undefined && (typeof description !== "string" || !description.trim())) {
    throw new TypeError("PageState description must be non-empty localized text when supplied.");
  }
  if (
    typeof headingLevel !== "number" ||
    !Number.isInteger(headingLevel) ||
    headingLevel < 1 ||
    headingLevel > 6
  ) {
    throw new TypeError("PageState headingLevel must be an integer from 1 through 6.");
  }

  return (
    <section
      {...rest}
      aria-labelledby={titleId}
      className={[styles.root, styles[status], className].filter(Boolean).join(" ")}
      data-page-state={status}
    >
      <div
        aria-atomic={live ? "true" : undefined}
        aria-live={live}
        aria-relevant={live ? "additions text" : undefined}
        className={styles.announcement}
        data-ds-part="announcement"
        role={role}
      >
        {resolvedIcon ? <Icon className={styles.icon} name={resolvedIcon} size="xl" /> : null}
        <div className={styles.copy}>
          {createElement(
            HEADING_TAG[headingLevel],
            { className: styles.title, id: titleId },
            title,
          )}
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
      </div>
      <div
        aria-busy={status === "loading" || status === "recovering" || undefined}
        className={styles.updateRegion}
        data-ds-part="update-region"
      >
        {primaryAction || secondaryAction ? (
          <div className={styles.actions}>
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </section>
  );
}
