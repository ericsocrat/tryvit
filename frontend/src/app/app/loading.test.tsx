import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AppLoading from "./loading";

describe("AppLoading", () => {
  it("announces a persistent-shell loading state", () => {
    render(<AppLoading />);

    expect(screen.getByLabelText("Loading application")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getAllByTestId("app-loading-register-cell")).toHaveLength(4);
  });
});
