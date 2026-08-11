const overlayStack: symbol[] = [];

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
