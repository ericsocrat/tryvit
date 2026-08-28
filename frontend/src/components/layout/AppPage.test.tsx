import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppPage, AppPageHeader, AppSectionHeader } from "./AppPage";

describe("AppPage", () => {
  it("keeps one semantic page heading and exposes the register", () => {
    render(
      <AppPage>
        <AppPageHeader
          eyebrow="Product register"
          title="Search"
          description="Find a product"
          register={<><span>Poland</span><span>Evidence aware</span></>}
        />
      </AppPage>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Search" })).toBeInTheDocument();
    expect(screen.getByText("Product register")).toBeInTheDocument();
    expect(screen.getByText("Evidence aware")).toBeInTheDocument();
  });

  it("renders section labels without changing heading order", () => {
    render(<AppSectionHeader label="Results" title="Matching products" meta={0} />);
    expect(screen.getByRole("heading", { level: 2, name: "Matching products" })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
