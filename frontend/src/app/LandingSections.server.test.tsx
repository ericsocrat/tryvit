import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingSections } from "./LandingSections";

describe("server-rendered landing locales", () => {
  it.each([
    [
      "en" as const,
      "Read the package. See the reasoning. Make your own call.",
      "Food intelligence · Poland and Germany",
    ],
    [
      "pl" as const,
      "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
      "Dane o żywności · Polska i Niemcy",
    ],
    [
      "de" as const,
      "Verpackung lesen. Begründung verstehen. Selbst entscheiden.",
      "Lebensmittelinformation · Polen und Deutschland",
    ],
  ])("renders complete %s content", (language, heading, identityLabel) => {
    render(<LandingSections language={language} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(screen.getByText(identityLabel)).toBeInTheDocument();
  });

  it("keeps the paused service state server-rendered", () => {
    render(<LandingSections language="en" dataAvailable={false} />);
    expect(
      screen.getByText("The website is available; live product data is paused"),
    ).toBeInTheDocument();
  });
});
