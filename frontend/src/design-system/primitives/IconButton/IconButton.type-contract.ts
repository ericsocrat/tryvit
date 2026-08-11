import type { IconButtonProps } from "./IconButton";

const canonicalIconButton = {
  icon: "action.settings",
  label: "Evidence settings",
} satisfies IconButtonProps;

const ariaOverride = {
  // @ts-expect-error The required label owns the icon action's accessible name.
  "aria-labelledby": "external-name",
  icon: "action.settings",
  label: "Evidence settings",
} satisfies IconButtonProps;

void canonicalIconButton;
void ariaOverride;
