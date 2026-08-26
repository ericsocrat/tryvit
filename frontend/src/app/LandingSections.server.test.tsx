import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getLandingCopy } from "./_landing-v2/copy";
import { LandingSections } from "./LandingSections";

describe("server-rendered landing locales", () => {
  it.each([
    [
      "en" as const,
      "Read the package. See the reasoning. Make your own call.",
    ],
    [
      "pl" as const,
      "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
    ],
    [
      "de" as const,
      "Verpackung lesen. Begründung verstehen. Selbst entscheiden.",
    ],
  ])("renders complete %s content without duplicating the shell identity", (language, heading) => {
    render(<LandingSections language={language} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(screen.queryByRole("img", { name: "TryVit" })).not.toBeInTheDocument();
  });

  it("keeps the paused service state server-rendered", () => {
    render(<LandingSections language="en" dataAvailable={false} />);
    expect(
      screen.getByText("The website is available; live product data is paused"),
    ).toBeInTheDocument();
  });

  it.each([
    ["en" as const, true, "live" as const],
    ["en" as const, false, "demo" as const],
    ["pl" as const, true, "live" as const],
    ["pl" as const, false, "demo" as const],
    ["de" as const, true, "live" as const],
    ["de" as const, false, "demo" as const],
  ])("renders readiness-truthful %s privacy copy in %s state", (language, dataAvailable, mode) => {
    const copy = getLandingCopy(language);
    render(<LandingSections dataAvailable={dataAvailable} language={language} />);

    expect(screen.getByText(copy.privacyBody[mode])).toBeInTheDocument();
    expect(screen.queryByText(copy.privacyBody[mode === "live" ? "demo" : "live"])).toBeNull();
  });
});
