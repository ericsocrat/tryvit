"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
} from "react";

export interface IndeterminateCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "type"> {
  readonly indeterminate: boolean;
}

/** The only browser-only island required by the native Checkbox primitive. */
export const IndeterminateCheckbox = forwardRef<
  HTMLInputElement,
  IndeterminateCheckboxProps
>(function IndeterminateCheckbox({ indeterminate, ...props }, forwardedRef) {
  const internalRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (internalRef.current) internalRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      {...props}
      ref={(node) => {
        internalRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      type="checkbox"
      aria-checked={indeterminate ? "mixed" : props["aria-checked"]}
    />
  );
});
