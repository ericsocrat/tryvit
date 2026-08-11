import type { MenuAction } from "./Menu";

const localizedEntry = {
  id: "evidence-source",
  label: "Evidence source",
  textValue: "Evidence source",
  onSelect: () => undefined,
} satisfies MenuAction;

const interactiveLabel = {
  id: "unsafe-label",
  // @ts-expect-error Menu entry labels are inert localized strings.
  label: { type: "button" },
  textValue: "Unsafe label",
  onSelect: () => undefined,
} satisfies MenuAction;

void localizedEntry;
void interactiveLabel;
