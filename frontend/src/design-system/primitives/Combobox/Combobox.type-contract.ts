import type { ReactElement } from "react";

import type { ComboboxOption, ComboboxProps } from "./Combobox";

type Base = {
  label: string;
  options: readonly [];
  loadingMessage: string;
  emptyMessage: string;
  resultsMessage: (count: number) => string;
};
type Expect<T extends true> = T;

export type RequiredSelectionMessageContract = Expect<
  Base & { required: true } extends ComboboxProps ? false : true
>;

export type DynamicRequiredSelectionContract = Expect<
  Base & {
    required: boolean;
    requiredSelectionMessage: string;
  } extends ComboboxProps
    ? true
    : false
>;

export type ComboboxDescriptionContract = Expect<
  Exclude<ComboboxOption["description"], undefined> extends string ? true : false
>;

type SelectionChange = Exclude<ComboboxProps["onValueChange"], undefined>;

export type NullableComboboxValueContract = Expect<
  null extends ComboboxProps["value"] ? true : false
>;

export type NullableComboboxDefaultValueContract = Expect<
  null extends ComboboxProps["defaultValue"] ? true : false
>;

export type NullableComboboxChangeContract = Expect<
  null extends Parameters<SelectionChange>[0] ? true : false
>;

const interactiveOptionDescription = {
  value: "unsafe",
  label: "Unsafe option",
  // @ts-expect-error Option descriptions are inert localized text, not React subtrees.
  description: {} as ReactElement,
} satisfies ComboboxOption;

void interactiveOptionDescription;

const interactiveStatus = {
  ...({} as Base),
  // @ts-expect-error Popup status copy is inert localized text.
  loadingMessage: {} as ReactElement,
} satisfies ComboboxProps;

void interactiveStatus;
