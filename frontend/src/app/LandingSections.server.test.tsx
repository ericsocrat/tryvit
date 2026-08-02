import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingSections } from "./LandingSections";

describe("server-rendered landing locales", () => {
  it.each([
    ["en" as const, "healthier choices, made simple", "Food Health Scanner"],
    ["pl" as const, "zdrowsze wybory, po prostu", "Skaner jakości żywności"],
    ["de" as const, "Gesündere Entscheidungen, einfach gemacht", "Lebensmittel-Gesundheitsscanner"],
  ])("renders complete %s content", (language, heading, productLabel) => {
    render(<LandingSections language={language} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(screen.getByText(productLabel)).toBeInTheDocument();
  });

  it("keeps the paused service state server-rendered", () => {
    render(<LandingSections language="en" dataAvailable={false} />);
    expect(
      screen.getByText("The TryVit website is available; live data features are paused"),
    ).toBeInTheDocument();
  });
});
