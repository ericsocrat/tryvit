import type { ReactElement } from "react";

import type { ButtonProps } from "./Button";

type Expect<T extends true> = T;

/** Controlled boolean loading remains usable when its localized label exists. */
export type ButtonDynamicLoadingContract = Expect<
  {
    loading: boolean;
    loadingLabel: string;
    children: string;
  } extends ButtonProps
    ? true
    : false
>;

/** A literal pending state can never compile without an announcement label. */
export type ButtonLoadingLabelContract = Expect<
  { loading: true; children: string } extends ButtonProps ? false : true
>;

export const ariaOverride = {
  // @ts-expect-error The visible/loading copy owns the canonical accessible name.
  "aria-label": "Hidden override",
  children: "Visible action",
} satisfies ButtonProps;

export const interactiveLabel = {
  // @ts-expect-error Button names are localized text, not React subtrees.
  children: {} as ReactElement,
} satisfies ButtonProps;
