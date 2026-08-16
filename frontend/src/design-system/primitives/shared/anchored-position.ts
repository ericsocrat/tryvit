import type { CSSProperties } from "react";

/**
 * Computes a stable fixed-position popup without freezing a public placement API.
 * Widgets close on document scroll and recompute on their next opening.
 */
export function anchoredPopupStyle(
  anchor: HTMLElement | null,
  options: Readonly<{
    matchWidth?: boolean;
    estimatedWidth?: number;
    minimumWidth?: number;
  }> = {},
): CSSProperties | undefined {
  const view = anchor?.ownerDocument.defaultView;
  if (!anchor || !view) return undefined;
  const rectangle = anchor.getBoundingClientRect();
  const visualViewport = view.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportRight = viewportLeft + (visualViewport?.width ?? view.innerWidth);
  const viewportBottom = viewportTop + (visualViewport?.height ?? view.innerHeight);
  const gutter = 8;
  const gap = 4;
  const estimatedWidth = options.matchWidth ? rectangle.width : (options.estimatedWidth ?? 240);
  const left = Math.max(
    viewportLeft + gutter,
    Math.min(rectangle.left, viewportRight - estimatedWidth - gutter),
  );
  const availableWidth = Math.max(0, viewportRight - left - gutter);
  const requestedMinimumWidth = options.matchWidth ? rectangle.width : options.minimumWidth;
  const roomBelow = viewportBottom - rectangle.bottom - gutter - gap;
  const roomAbove = rectangle.top - viewportTop - gutter - gap;
  const placeAbove = roomBelow < 160 && roomAbove > roomBelow;
  const availableHeight = Math.max(0, placeAbove ? roomAbove : roomBelow);
  return {
    left,
    minWidth:
      requestedMinimumWidth === undefined
        ? undefined
        : Math.min(requestedMinimumWidth, availableWidth),
    maxWidth: availableWidth,
    maxHeight: availableHeight,
    ...(placeAbove
      ? { bottom: view.innerHeight - rectangle.top + gap }
      : { top: rectangle.bottom + gap }),
  };
}
