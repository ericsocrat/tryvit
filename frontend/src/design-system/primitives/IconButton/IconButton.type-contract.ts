import type { IconButtonProps } from "./IconButton";

export const canonicalIconButton = {
  icon: "action.settings",
  label: "Evidence settings",
} satisfies IconButtonProps;

export const ariaOverride = {
  // @ts-expect-error The required label owns the icon action's accessible name.
  "aria-labelledby": "external-name",
  icon: "action.settings",
  label: "Evidence settings",
} satisfies IconButtonProps;
