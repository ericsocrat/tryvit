import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileSearch } from "lucide-react";
import { translate } from "@/lib/i18n-core";
import { EvidenceLearnArticle } from "./EvidenceLearnArticle";
let language: "en" | "pl" | "de" = "en";
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ language, t: (key: string) => translate(language, key) }) }));
vi.mock("./LearnRouteShell", () => ({ LearnRouteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("./LearnTopicNav", () => ({ LearnTopicNav: () => <nav aria-label="Related topics" /> }));
afterEach(cleanup);
describe("evidence articles", () => {
  for (const locale of ["en", "pl", "de"] as const) for (const topic of ["score", "confidence", "additives", "choices"] as const) {
    it(`${locale}/${topic} presents current policy, limitations, action and primary sources`, () => {
      language = locale;
      render(<EvidenceLearnArticle topic={topic} icon={FileSearch} />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(translate(locale, `evidenceLearn.${topic}.title`));
      for (const section of ["meaning", "limits", "action"]) {
        expect(screen.getByText(translate(locale, `evidenceLearn.${topic}.${section}Text`))).toBeVisible();
      }
      expect(screen.getByRole("link")).toHaveAttribute("href", expect.stringMatching(/^https:\/\//));
      expect(screen.queryByText(/evidenceLearn\./)).not.toBeInTheDocument();
      expect(document.querySelector("meter, [role=progressbar]")).toBeNull();
    });
  }
  it("does not turn guidance or a confidence count into scientific validation", () => {
    language = "en";
    render(<EvidenceLearnArticle topic="score" icon={FileSearch} />);
    expect(screen.getByText(/not a validated measure of health/)).toBeVisible();
    expect(screen.getByText(/do not validate a TryVit health formula/)).toBeVisible();
    expect(screen.queryByText(/scientifically-justified ceilings|9 penalty factors|EFSA concern tiers/)).not.toBeInTheDocument();
  });
});
