import { useCallback, useState } from "react";

type StateUpdater<Value> = Value | ((current: Value) => Value);

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
}>): readonly [Value, (next: StateUpdater<Value>) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const resolvedValue = isControlled ? value : uncontrolledValue;

  const setValue = useCallback(
    (next: StateUpdater<Value>) => {
      const nextValue = typeof next === "function"
        ? (next as (current: Value) => Value)(resolvedValue)
        : next;
      if (Object.is(nextValue, resolvedValue)) return;
      if (!isControlled) setUncontrolledValue(nextValue);
      onChange?.(nextValue);
    },
    [isControlled, onChange, resolvedValue],
  );

  return [resolvedValue, setValue] as const;
}
