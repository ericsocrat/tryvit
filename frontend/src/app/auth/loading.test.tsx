import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthLoading from "./loading";

describe("AuthLoading", () => {
  it("provides a route-level status while server Auth work resolves", () => {
    render(<AuthLoading />);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });
});
