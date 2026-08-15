import type { MenuAction } from "./Menu";

export const localizedEntry = {
  id: "evidence-source",
  label: "Evidence source",
  textValue: "Evidence source",
  onSelect: () => undefined,
} satisfies MenuAction;

export const interactiveLabel = {
  id: "unsafe-label",
  // @ts-expect-error Menu entry labels are inert localized strings.
  label: { type: "button" },
  textValue: "Unsafe label",
  onSelect: () => undefined,
} satisfies MenuAction;
