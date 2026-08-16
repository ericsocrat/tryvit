export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "audio[controls]",
  "button",
  "details > summary:first-of-type",
  "embed",
  "iframe",
  "input",
  "object",
  "select",
  "textarea",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

export interface TabbableElement extends Element {
  readonly tabIndex: number;
  focus(options?: FocusOptions): void;
}

const DEFAULT_FOCUS_OPTIONS: FocusOptions = { preventScroll: true };

export function isTabbableElement(element: Element | null): element is TabbableElement {
  return Boolean(
    element &&
    "tabIndex" in element &&
    typeof element.tabIndex === "number" &&
    "focus" in element &&
    typeof element.focus === "function"
  );
}

export function focusElement(
  element: TabbableElement | null | undefined,
  options?: FocusOptions,
): void {
  if (!element?.isConnected) return;
  element.focus(options ?? DEFAULT_FOCUS_OPTIONS);
}

function isRenderedTabStop(element: TabbableElement): boolean {
  if (
    !element.isConnected ||
    element.tabIndex < 0 ||
    (element instanceof HTMLElement && element.hidden) ||
    element.matches(":disabled") ||
    element.closest("[hidden], [inert]") ||
    (element instanceof HTMLElement && Object.hasOwn(element.dataset, "dsFocusGuard")) ||
    (element instanceof HTMLInputElement && element.type === "hidden")
  ) {
    return false;
  }
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return Boolean(
    element.getClientRects().length > 0 &&
    style?.display !== "none" &&
    style?.visibility !== "hidden" &&
    style?.visibility !== "collapse",
  );
}

function isRadioGroupTabStop(
  element: TabbableElement,
  candidates: readonly TabbableElement[],
  backwards: boolean,
): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) {
    return true;
  }
  const group = candidates.filter(
    (candidate): candidate is HTMLInputElement =>
      candidate instanceof HTMLInputElement &&
      candidate.type === "radio" &&
      candidate.name === element.name &&
      candidate.form === element.form &&
      candidate.getRootNode() === element.getRootNode(),
  );
  const orderedGroup = [...group].sort(compareSequentialOrder);
  return (
    element ===
    (orderedGroup.find((candidate) => candidate.checked) ??
      (backwards ? orderedGroup.at(-1) : orderedGroup[0]))
  );
}

function compareDocumentOrder(left: TabbableElement, right: TabbableElement): number {
  if (left === right) return 0;
  const position = left.compareDocumentPosition(right);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function compareSequentialOrder(left: TabbableElement, right: TabbableElement): number {
  const leftIsPositive = left.tabIndex > 0;
  const rightIsPositive = right.tabIndex > 0;
  if (leftIsPositive !== rightIsPositive) return leftIsPositive ? -1 : 1;
  if (leftIsPositive && left.tabIndex !== right.tabIndex) {
    return left.tabIndex - right.tabIndex;
  }
  return compareDocumentOrder(left, right);
}

export function adjacentDomTabStop(
  activeElement: Element,
  candidates: readonly TabbableElement[],
  backwards: boolean,
): TabbableElement | null {
  const ordered = [...candidates].sort(compareDocumentOrder);
  const preceding = ordered.filter((candidate) =>
    Boolean(activeElement.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_PRECEDING),
  );
  const following = ordered.find((candidate) =>
    Boolean(activeElement.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
  return backwards ? (preceding.at(-1) ?? null) : (following ?? null);
}

export function tabbableElements(
  container: Document | HTMLElement,
  backwards = false,
): readonly TabbableElement[] {
  const candidates = renderedTabStopCandidates(container);

  return candidates
    .filter((element) => isRadioGroupTabStop(element, candidates, backwards))
    .sort(compareSequentialOrder);
}

export function renderedTabStopCandidates(
  container: Document | HTMLElement,
): readonly TabbableElement[] {
  return Array.from(container.querySelectorAll<Element>(FOCUSABLE_SELECTOR))
    .filter(isTabbableElement)
    .filter(isRenderedTabStop)
    .sort(compareDocumentOrder);
}

export function programmaticTabStopCandidates(
  container: Document | HTMLElement,
): readonly TabbableElement[] {
  const candidates = renderedTabStopCandidates(container);
  return candidates.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) {
      return true;
    }
    const group = candidates.filter((candidate): candidate is HTMLInputElement =>
      candidate instanceof HTMLInputElement &&
      candidate.type === "radio" &&
      candidate.name === element.name &&
      candidate.form === element.form &&
      candidate.getRootNode() === element.getRootNode()
    );
    const checked = group.find((candidate) => candidate.checked);
    if (checked) return element === checked;
    return true;
  });
}

export function firstFocusable(container: HTMLElement): TabbableElement | null {
  return tabbableElements(container)[0] ?? null;
}

function tabStopsForTrigger(
  trigger: HTMLElement,
  backwards: boolean,
  excludedRoot?: HTMLElement | null,
): {
  readonly candidates: readonly TabbableElement[];
  readonly openDialog: HTMLDialogElement | null;
} {
  const openDialog = trigger.closest<HTMLDialogElement>("dialog[open]");
  const queryRoot: Document | HTMLDialogElement = openDialog ?? trigger.ownerDocument;
  const candidates = tabbableElements(queryRoot, backwards).filter(
    (element) =>
      !excludedRoot?.contains(element) &&
      (!openDialog || element.closest<HTMLDialogElement>("dialog[open]") === openDialog),
  );
  return { candidates, openDialog };
}

export function modalBoundaryTabStop(
  trigger: HTMLElement,
  backwards: boolean,
  excludedRoot?: HTMLElement | null,
): TabbableElement | null {
  const { candidates, openDialog } = tabStopsForTrigger(trigger, backwards, excludedRoot);
  if (!openDialog || candidates.length === 0) return null;
  const index = candidates.indexOf(trigger);
  if (index < 0) return backwards ? (candidates.at(-1) ?? null) : (candidates[0] ?? null);
  if (backwards && index === 0) return candidates.at(-1) ?? null;
  if (!backwards && index === candidates.length - 1) return candidates[0] ?? null;
  return null;
}

export function adjacentTabStop(
  trigger: HTMLElement,
  backwards: boolean,
  excludedRoot?: HTMLElement | null,
): TabbableElement | null {
  const { candidates, openDialog } = tabStopsForTrigger(trigger, backwards, excludedRoot);
  const index = candidates.indexOf(trigger);
  if (index < 0) return null;
  const destination = index + (backwards ? -1 : 1);
  if (candidates[destination]) return candidates[destination];
  if (!openDialog || candidates.length === 0) return null;
  return candidates[backwards ? candidates.length - 1 : 0] ?? null;
}
