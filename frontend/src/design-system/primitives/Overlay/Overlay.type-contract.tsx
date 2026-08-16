import type { ReactElement, ReactNode } from "react";

import type { ModalOverlayProps } from "./Overlay";

type Expect<T extends true> = T;

export type OverlayTitleIsLocalizedText = Expect<
  ModalOverlayProps["title"] extends string ? true : false
>;

const baseProps = {
  open: true,
  title: "Evidence review",
  closeLabel: "Close evidence review",
  onOpenChange: () => undefined,
  children: "Evidence details",
} satisfies ModalOverlayProps;

const nullTitle = {
  ...baseProps,
  // @ts-expect-error A canonical modal title cannot be null.
  title: null,
} satisfies ModalOverlayProps;

const fragmentTitle = {
  ...baseProps,
  // @ts-expect-error A canonical modal title cannot be a fragment.
  title: <>Evidence review</>,
} satisfies ModalOverlayProps;

const elementTitle = {
  ...baseProps,
  // @ts-expect-error A canonical modal title cannot be a React element.
  title: {} as ReactElement,
} satisfies ModalOverlayProps;

const arbitraryNodeTitle = {
  ...baseProps,
  // @ts-expect-error A canonical modal title cannot be an arbitrary React node.
  title: {} as ReactNode,
} satisfies ModalOverlayProps;

const hiddenAriaLabel = {
  ...baseProps,
  // @ts-expect-error The visible title owns the modal's accessible name.
  "aria-label": "Hidden override",
} satisfies ModalOverlayProps;

const externalLabel = {
  ...baseProps,
  // @ts-expect-error Consumers cannot replace the visible title relationship.
  "aria-labelledby": "external-title",
} satisfies ModalOverlayProps;

export {
  arbitraryNodeTitle,
  baseProps,
  elementTitle,
  externalLabel,
  fragmentTitle,
  hiddenAriaLabel,
  nullTitle,
};
