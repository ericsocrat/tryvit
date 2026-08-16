interface ScrollLockState {
  count: number;
  readonly overflow: string;
  readonly paddingRight: string;
}

const locks = new WeakMap<Document, ScrollLockState>();

/** Locks document scrolling without requiring a root provider. */
export function lockDocumentScroll(ownerDocument: Document): () => void {
  const body = ownerDocument.body;
  let state = locks.get(ownerDocument);
  if (!state) {
    state = {
      count: 0,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const view = ownerDocument.defaultView;
    const scrollbarWidth = view
      ? Math.max(0, view.innerWidth - ownerDocument.documentElement.clientWidth)
      : 0;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPadding = view
        ? Number.parseFloat(view.getComputedStyle(body).paddingRight) || 0
        : 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    locks.set(ownerDocument, state);
  }
  state.count += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = locks.get(ownerDocument);
    if (!current) return;
    current.count = Math.max(0, current.count - 1);
    if (current.count === 0) {
      body.style.overflow = current.overflow;
      body.style.paddingRight = current.paddingRight;
      locks.delete(ownerDocument);
    }
  };
}
