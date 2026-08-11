import {
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";

import { Icon, type IconName } from "@/design-system/icons/Icon";

import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "aria-labelledby" | "children"
  > {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly startIcon?: IconName;
  readonly endIcon?: IconName;
  readonly fullWidth?: boolean;
  /** Non-empty localized visible name; use IconButton for icon-only actions. */
  readonly children: string;
}

type ButtonLoadingProps =
  | {
      readonly loading: boolean;
      /** Localized label announced and shown while the action is pending. */
      readonly loadingLabel: string;
    }
  | {
      readonly loading?: false;
      readonly loadingLabel?: string;
    };

export type ButtonProps = ButtonBaseProps & ButtonLoadingProps;

/** A native, server-compatible action button with semantic V2 states. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  properties,
  ref,
) {
  const {
    variant = "primary",
    size = "md",
    startIcon,
    endIcon,
    fullWidth = false,
    loading = false,
    loadingLabel,
    disabled,
    type = "button",
    className = "",
    children,
    ...rest
  } = properties;
  const {
    "aria-label": ignoredAriaLabel,
    "aria-labelledby": ignoredAriaLabelledBy,
    ...safeRest
  } = rest as typeof rest & {
    readonly "aria-label"?: string;
    readonly "aria-labelledby"?: string;
  };
  void ignoredAriaLabel;
  void ignoredAriaLabelledBy;
  if (typeof children !== "string" || !children.trim()) {
    throw new TypeError("Button children must be non-empty localized text.");
  }
  if (loading && !loadingLabel?.trim()) {
    throw new TypeError("Button loadingLabel must be non-empty while loading.");
  }
  const pendingLabel = loading ? loadingLabel : undefined;

  return (
    <button
      {...safeRest}
      ref={ref}
      aria-label={pendingLabel}
      aria-busy={loading || undefined}
      className={[
        styles.root,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-loading={loading || undefined}
      data-size={size}
      data-variant={variant}
      disabled={disabled || loading}
      type={type}
    >
      {loading ? (
        <Icon className={styles.icon} name="feedback.loading" size="sm" />
      ) : startIcon ? (
        <Icon className={styles.icon} name={startIcon} size="sm" />
      ) : null}
      <span>{pendingLabel ?? children}</span>
      {!loading && endIcon ? (
        <Icon className={styles.icon} name={endIcon} size="sm" />
      ) : null}
    </button>
  );
});
