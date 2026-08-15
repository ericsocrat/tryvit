import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useControllableState } from "./controllable-state";

describe("useControllableState", () => {
  it("applies concrete uncontrolled values and reports each actual change", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: "first", onChange, value: undefined }),
    );

    act(() => result.current[1]("second"));
    expect(result.current[0]).toBe("second");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("second");

    act(() => result.current[1]("second"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("reports a controlled request without inventing local requested state", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }: Readonly<{ value: string }>) =>
        useControllableState({ defaultValue: "first", onChange, value }),
      { initialProps: { value: "first" } },
    );

    act(() => result.current[1]("second"));
    expect(result.current[0]).toBe("first");
    expect(onChange).toHaveBeenCalledWith("second");

    rerender({ value: "second" });
    expect(result.current[0]).toBe("second");
  });
});
