import type { IconProps } from "./Icon";

const decorativeIcon = {
  name: "action.search",
  size: "sm",
} satisfies IconProps;

const informationalIcon = {
  label: "Search",
  name: "action.search",
} satisfies IconProps;

// Canonical icons are inert artwork. Interaction belongs on Button/IconButton.
const focusedSvg = {
  name: "action.search",
  // @ts-expect-error tabIndex must not make a glyph independently focusable.
  tabIndex: 0,
} satisfies IconProps;

const clickableSvg = {
  name: "action.search",
  // @ts-expect-error event handlers must not turn a glyph into a control.
  onClick: () => undefined,
} satisfies IconProps;

void decorativeIcon;
void informationalIcon;
void focusedSvg;
void clickableSvg;
