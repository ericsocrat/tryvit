import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Icon, type IconName, type IconSize } from "@/design-system/icons/Icon";
import type {
  ButtonSize,
  ButtonVariant,
} from "@/design-system/primitives/Button/Button";

import styles from "./IconButton.module.css";

export type IconButtonVariant = ButtonVariant;
export type IconButtonSize = ButtonSize;

interface IconButtonBaseProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "aria-labelledby" | "children"
  > {
  readonly icon: IconName;
  /** Required accessible name for the icon-only action. */
  readonly label: string;
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
}

type IconButtonLoadingProps =
  | { readonly loading: boolean; readonly loadingLabel: string }
  | { readonly loading?: false; readonly loadingLabel?: string };

export type IconButtonProps = IconButtonBaseProps & IconButtonLoadingProps;

const ICON_SIZE: Readonly<Record<IconButtonSize, IconSize>> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

/** Icon-only native action with a mandatory label-in-name contract. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    properties,
    ref,
  ) {
    const {
      icon,
      label,
      variant = "quiet",
      size = "md",
      loading = false,
      loadingLabel,
      disabled,
      type = "button",
      className = "",
      ...rest
    } = properties;
    const safeRest = { ...rest };
    Reflect.deleteProperty(safeRest, "aria-label");
    Reflect.deleteProperty(safeRest, "aria-labelledby");
    if (!label.trim()) {
      throw new TypeError("IconButton label must be non-empty.");
    }
    if (loading && !loadingLabel?.trim()) {
      throw new TypeError("IconButton loadingLabel must be non-empty while loading.");
    }
    const accessibleLabel = loading ? loadingLabel : label;
    return (
      <button
        {...safeRest}
        ref={ref}
        aria-busy={loading || undefined}
        aria-label={accessibleLabel}
        className={[
          styles.root,
          styles[variant],
          styles[size],
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
        <Icon
          name={loading ? "feedback.loading" : icon}
          size={ICON_SIZE[size]}
        />
      </button>
    );
  },
);
