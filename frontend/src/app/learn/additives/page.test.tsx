import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AdditivesPage from "./page";
vi.mock("@/components/learn/EvidenceLearnArticle", () => ({
  EvidenceLearnArticle: ({ topic }: { topic: string }) => <article>{topic}</article>,
}));
it("keeps the existing URL on the current evidence-policy article", () => {
  render(<AdditivesPage />);
  expect(screen.getByRole("article")).toHaveTextContent("additives");
});
