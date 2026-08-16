import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Button as FacadeButton,
  ButtonLink as FacadeButtonLink,
  buttonClasses as facadeButtonClasses,
} from "@/components/common/Button";
import { Card as FacadeCard } from "@/components/common/Card";
import { ConfirmDialog as FacadeConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState as FacadeEmptyState } from "@/components/common/EmptyState";
import { InfoTooltip as FacadeInfoTooltip } from "@/components/common/InfoTooltip";

import { Button, ButtonLink, buttonClasses } from "./Button";
import { Card } from "./Card";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { InfoTooltip } from "./InfoTooltip";

describe("required V1 compatibility facades", () => {
  it("re-exports the exact production implementations without wrapper DOM", () => {
    expect(FacadeButton).toBe(Button);
    expect(FacadeButtonLink).toBe(ButtonLink);
    expect(facadeButtonClasses).toBe(buttonClasses);
    expect(FacadeCard).toBe(Card);
    expect(FacadeConfirmDialog).toBe(ConfirmDialog);
    expect(FacadeEmptyState).toBe(EmptyState);
    expect(FacadeInfoTooltip).toBe(InfoTooltip);
  });

  it("freezes the established Button class recipe at the consumer boundary", () => {
    expect(buttonClasses("secondary", "lg", { fullWidth: true })).toBe(
      "inline-flex items-center justify-center select-none font-semibold transition-[background-color,color,box-shadow,transform] press-scale motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 border border-strong bg-surface/95 text-foreground-secondary shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:bg-surface-subtle dark:border-white/20 dark:bg-white/[0.02] dark:text-foreground dark:hover:bg-white/10 px-6 py-3 text-base gap-2.5 rounded-lg min-h-[44px] w-full",
    );
  });

  it("preserves the established Card DOM and exact default classes", () => {
    render(<FacadeCard>Reviewed product</FacadeCard>);
    const card = screen.getByText("Reviewed product");
    expect(card.tagName).toBe("DIV");
    expect(card.className).toBe(
      "rounded-xl border border-default bg-surface/95 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none p-4",
    );
  });
});
