import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ConfidencePage from "./page";
vi.mock("@/components/learn/EvidenceLearnArticle", () => ({
  EvidenceLearnArticle: ({ topic }: { topic: string }) => <article>{topic}</article>,
}));
it("keeps the existing URL on the current evidence-policy article", () => {
  render(<ConfidencePage />);
  expect(screen.getByRole("article")).toHaveTextContent("confidence");
});
