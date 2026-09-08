import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TryVitScorePage from "./page";
vi.mock("@/components/learn/EvidenceLearnArticle", () => ({
  EvidenceLearnArticle: ({ topic }: { topic: string }) => <article>{topic}</article>,
}));
it("keeps the existing URL on the current evidence-policy article", () => {
  render(<TryVitScorePage />);
  expect(screen.getByRole("article")).toHaveTextContent("score");
});
