import type { SurfaceElement, SurfaceProps } from "./Surface";

type Expect<T extends true> = T;

/** Compile-time guard against widening Surface back to interactive roots. */
export type SurfaceElementContract = Expect<
  Extract<
    SurfaceElement,
    "a" | "button" | "input" | "select" | "textarea"
  > extends never
    ? true
    : false
>;

const interactiveSurface = {
  children: "Unsafe surface",
  // @ts-expect-error Surface hosts cannot become event-driven controls.
  onClick: () => undefined,
} satisfies SurfaceProps;

void interactiveSurface;
