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
  const safeRest = { ...rest };
  Reflect.deleteProperty(safeRest, "aria-label");
  Reflect.deleteProperty(safeRest, "aria-labelledby");
  if (typeof children !== "string" || !children.trim()) {
    throw new TypeError("Button children must be non-empty localized text.");
  }
  if (loading && !loadingLabel?.trim()) {
    throw new TypeError("Button loadingLabel must be non-empty while loading.");
  }
  const pendingLabel = loading ? loadingLabel : undefined;
  const leadingIcon = loading ? "feedback.loading" : startIcon;

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
      {leadingIcon ? <Icon className={styles.icon} name={leadingIcon} size="sm" /> : null}
      <span>{pendingLabel ?? children}</span>
      {!loading && endIcon ? (
        <Icon className={styles.icon} name={endIcon} size="sm" />
      ) : null}
    </button>
  );
});
