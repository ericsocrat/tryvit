export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

export function focusElement(element: HTMLElement | null | undefined): void {
  if (!element?.isConnected) return;
  element.focus({ preventScroll: true });
}

export function firstFocusable(container: HTMLElement): HTMLElement | null {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .find((element) => {
      if (element.tabIndex < 0 || element.hidden || element.closest("[hidden], [inert]")) {
        return false;
      }
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      return style?.display !== "none" && style?.visibility !== "hidden";
    }) ?? null;
}

export function adjacentTabStop(
  trigger: HTMLElement,
  backwards: boolean,
  excludedRoot?: HTMLElement | null,
): HTMLElement | null {
  const openDialog = trigger.closest<HTMLDialogElement>("dialog[open]");
  const queryRoot: Document | HTMLDialogElement = openDialog ?? trigger.ownerDocument;
  const candidates = Array.from(
    queryRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.tabIndex < 0 || excludedRoot?.contains(element)) return false;
    if (element.hidden || element.closest("[hidden], [inert]")) return false;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return style?.display !== "none" && style?.visibility !== "hidden";
  });
  const index = candidates.indexOf(trigger);
  if (index < 0) return null;
  const destination = index + (backwards ? -1 : 1);
  if (candidates[destination]) return candidates[destination];
  if (!openDialog || candidates.length === 0) return null;
  return candidates[backwards ? candidates.length - 1 : 0] ?? null;
}
