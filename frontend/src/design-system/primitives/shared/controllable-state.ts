import { useCallback, useState } from "react";

/**
 * Small dependency-free controlled/uncontrolled state helper for V2 widgets.
 * The callback is fired only when the resolved value actually changes.
 */
export function useControllableState<Value>({
  value,
  defaultValue,
  onChange,
}: Readonly<{
  value: Value | undefined;
  defaultValue: Value;
  onChange?: (value: Value) => void;
}>): readonly [Value, (next: Value) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const resolvedValue = isControlled ? value : uncontrolledValue;

  const setValue = useCallback(
    (next: Value) => {
      if (Object.is(next, resolvedValue)) return;
      if (!isControlled) setUncontrolledValue(next);
      onChange?.(next);
    },
    [isControlled, onChange, resolvedValue],
  );

  return [resolvedValue, setValue] as const;
}
