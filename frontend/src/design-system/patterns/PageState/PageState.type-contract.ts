import type { ReactElement } from "react";

import type { PageStateProps } from "./PageState";

type Expect<T extends true> = T;

export type PageStateTitleIsInertText = Expect<
  PageStateProps["title"] extends string ? true : false
>;

export const interactiveTitle = {
  status: "empty",
  // @ts-expect-error PageState titles are localized inert text.
  title: {} as ReactElement,
} satisfies PageStateProps;

export const invalidHeadingLevel = {
  status: "empty",
  title: "No evidence",
  // @ts-expect-error PageState heading levels are limited to HTML h1 through h6.
  headingLevel: 7,
} satisfies PageStateProps;
