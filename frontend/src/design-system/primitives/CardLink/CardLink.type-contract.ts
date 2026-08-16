import type { CardLinkElement, CardLinkRootProps } from "./CardLink";

type Expect<T extends true> = T;

/** Compile-time guard for CardLink's sibling-action architecture. */
export type CardLinkElementContract = Expect<
  Extract<
    CardLinkElement,
    "a" | "button" | "input" | "select" | "textarea"
  > extends never
    ? true
    : false
>;

export const focusableCardRoot = {
  children: "Unsafe card root",
  // @ts-expect-error CardLink.Root cannot enter the tab order.
  tabIndex: 0,
} satisfies CardLinkRootProps;
