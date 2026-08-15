import type { useControllableState } from "./controllable-state";

type Setter = ReturnType<typeof useControllableState<number>>[1];
type Expect<T extends true> = T;

export type ControllableStateSetterAcceptsConcreteValues = Expect<
  number extends Parameters<Setter>[0] ? true : false
>;

export type ControllableStateSetterRejectsFunctionalUpdates = Expect<
  ((current: number) => number) extends Parameters<Setter>[0] ? false : true
>;

declare const setValue: Setter;

// @ts-expect-error Sequential updater semantics are not part of this helper's contract.
setValue((current) => current + 1);
