import type { ReactElement } from "react";

import type { TooltipProps } from "./Tooltip";

type Expect<T extends true> = T;

export type TooltipContentContract = Expect<
  Exclude<TooltipProps["content"], undefined> extends string ? true : false
>;

export const interactiveTooltipContent = {
  children: {} as ReactElement,
  // @ts-expect-error Tooltip content is inert localized text, not a React subtree.
  content: {} as ReactElement,
} satisfies TooltipProps;
