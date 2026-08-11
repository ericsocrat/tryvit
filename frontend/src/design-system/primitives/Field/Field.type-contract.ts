import type { ReactElement } from "react";

import type { CheckboxProps, FieldProps, InputProps, SwitchProps, TextareaProps } from "./Field";

type Expect<T extends true> = T;

export type FieldLabelIsInertText = Expect<FieldProps["label"] extends string ? true : false>;

export type TextareaCountLabelIsInertText = Expect<
  NonNullable<TextareaProps["count"]>["label"] extends string ? true : false
>;

const interactiveFieldLabel = {
  // @ts-expect-error Field labels are localized inert text, not React subtrees.
  label: {} as ReactElement,
  children: () => null,
} satisfies FieldProps;

const inputWithChildren = {
  label: "Source",
  // @ts-expect-error Native input controls cannot accept children.
  children: "Invalid child",
} satisfies InputProps;

const checkboxWithChildren = {
  label: "Include evidence",
  // @ts-expect-error Native checkbox controls cannot accept children.
  children: "Invalid child",
} satisfies CheckboxProps;

const switchWithChildren = {
  label: "Automatic updates",
  // @ts-expect-error Native switch controls cannot accept children.
  children: "Invalid child",
} satisfies SwitchProps;

void interactiveFieldLabel;
void inputWithChildren;
void checkboxWithChildren;
void switchWithChildren;
