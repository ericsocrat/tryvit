import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingSocialCard } from "./LandingSocialCard";

describe("LandingSocialCard", () => {
  it.each([600 as const, 630 as const])(
    "renders a truthful trilingual evidence card at %spx",
    (height) => {
      const { container } = render(<LandingSocialCard height={height} />);
      expect(screen.getByText("Evidence stays visible.")).toBeInTheDocument();
      expect(screen.getByText("Źródła pozostają widoczne.")).toBeInTheDocument();
      expect(screen.getByText("Evidenz bleibt sichtbar.")).toBeInTheDocument();
      expect(container).toHaveTextContent("Food intelligence");
      expect(container.textContent).not.toMatch(
        /instantly|health score|healthy|harmful|scan, score|multi-axis/iu,
      );
    },
  );
});
