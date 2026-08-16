const overlayStack: symbol[] = [];
const claimedPointerDismissals = new WeakSet<Event>();

export function registerOverlay(id: symbol): () => void {
  overlayStack.push(id);
  return () => {
    const index = overlayStack.lastIndexOf(id);
    if (index >= 0) overlayStack.splice(index, 1);
  };
}

export function isTopOverlay(id: symbol): boolean {
  return overlayStack.at(-1) === id;
}

/**
 * Preserve top-overlay ownership for the lifetime of one native pointer
 * gesture without cancelling propagation or browser default behavior.
 */
export function claimOverlayPointerDismissal(event: Event): void {
  claimedPointerDismissals.add(event);
}

export function isOverlayPointerDismissalClaimed(event: Event): boolean {
  return claimedPointerDismissals.has(event);
}
