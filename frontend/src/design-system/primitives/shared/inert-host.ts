import type { DOMAttributes, HTMLAttributes } from "react";

type EventHandlerKey = keyof DOMAttributes<HTMLElement>;
type InteractiveHostKey =
  | EventHandlerKey
  | "accessKey"
  | "autoFocus"
  | "contentEditable"
  | "dangerouslySetInnerHTML"
  | "draggable"
  | "role"
  | "tabIndex";

/** Attributes that cannot turn a semantic container into an interactive widget. */
export type InertHostAttributes = Omit<
  HTMLAttributes<HTMLElement>,
  InteractiveHostKey
>;

const INTERACTIVE_HOST_KEYS = new Set([
  "accessKey",
  "autoFocus",
  "contentEditable",
  "dangerouslySetInnerHTML",
  "draggable",
  "role",
  "tabIndex",
]);

/** Fail closed when JavaScript or an unsafe cast bypasses the TypeScript surface. */
export function assertInertHostProps(
  props: Readonly<Record<string, unknown>>,
  owner: string,
): void {
  const unsafeKey = Object.entries(props).find(
    ([key, value]) =>
      value !== undefined &&
      (INTERACTIVE_HOST_KEYS.has(key) || /^on[A-Z]/u.test(key)),
  )?.[0];

  if (unsafeKey) {
    throw new TypeError(
      `${owner} is a noninteractive container and does not accept ${unsafeKey}.`,
    );
  }
}
