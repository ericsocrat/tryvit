import type { ReactElement } from "react";

import type { PageStateProps } from "./PageState";

type Expect<T extends true> = T;

export type PageStateTitleIsInertText = Expect<
  PageStateProps["title"] extends string ? true : false
>;

const interactiveTitle = {
  status: "empty",
  // @ts-expect-error PageState titles are localized inert text.
  title: {} as ReactElement,
} satisfies PageStateProps;

const invalidHeadingLevel = {
  status: "empty",
  title: "No evidence",
  // @ts-expect-error PageState heading levels are limited to HTML h1 through h6.
  headingLevel: 7,
} satisfies PageStateProps;

void interactiveTitle;
void invalidHeadingLevel;
