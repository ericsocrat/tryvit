import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";

import { Tooltip } from "./Tooltip";

describe("V2 Tooltip", () => {
  it("fails closed before interactive React content can enter role=tooltip", () => {
    const interactiveContent = (
      <button type="button">Injected action</button>
    ) as unknown as string;

    expect(() =>
      render(
        <Tooltip content={interactiveContent} defaultOpen>
          <button type="button">Unsafe tooltip trigger</button>
        </Tooltip>,
      ),
    ).toThrow(/non-empty localized text; React content is not supported/u);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.queryByRole("button", { name: "Injected action" })).toBeNull();
  });

  it("puts the trigger marker and runtime description on the actual focusable element", async () => {
    const user = userEvent.setup();
    render(
      <section data-theme="dark" dir="rtl" lang="pl">
        <Tooltip content="Confidence describes source quality">
          <button type="button">Explain confidence</button>
        </Tooltip>
      </section>,
    );
    const trigger = screen.getByRole("button", { name: "Explain confidence" });
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");

    expect(trigger).toHaveAttribute("data-ds-part", "trigger");
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).not.toBeNull();
    expect(tooltip).toHaveTextContent("Confidence describes source quality");
    const portalRoot = tooltip.closest("[data-ds-portal-root]");
    expect(portalRoot).toHaveAttribute("data-design-system", "v2");
    expect(portalRoot).toHaveAttribute("data-theme", "dark");
    expect(portalRoot).toHaveAttribute("dir", "rtl");
    expect(portalRoot).toHaveAttribute("lang", "pl");
  });

  it("merges an existing trigger description with the open tooltip IDREF", async () => {
    const user = userEvent.setup();
    render(
      <>
        <span id="existing-help">Existing evidence context</span>
        <Tooltip content="Additional confidence context">
          <button aria-describedby="existing-help" type="button">
            Explain confidence
          </button>
        </Tooltip>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Explain confidence" });
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    const describedBy = trigger.getAttribute("aria-describedby")?.split(" ") ?? [];

    expect(describedBy).toContain("existing-help");
    expect(describedBy).toContain(tooltip.id);
    expect(describedBy).toHaveLength(2);
  });

  it("dismisses the top tooltip on Escape without moving trigger focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Supporting explanation">
        <button type="button">Explain</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Explain" });
    await user.tab();
    expect(await screen.findByRole("tooltip")).toBeVisible();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("remains open while the pointer moves from trigger to hoverable content", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Hoverable explanation">
        <button type="button">Hover for help</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole("button", { name: "Hover for help" }));
    const tooltip = await screen.findByRole("tooltip");
    await user.hover(tooltip);
    expect(tooltip).toBeVisible();
  });

  it("maps logical inline placement against RTL direction", async () => {
    render(
      <div dir="rtl">
        <Tooltip content="Logical placement" placement="inline-start" defaultOpen>
          <button type="button">Placed trigger</button>
        </Tooltip>
      </div>,
    );
    expect(await screen.findByRole("tooltip")).toHaveAttribute("data-side", "right");
  });

  it("has no detectable accessibility violations while open", async () => {
    const { container } = render(
      <Tooltip content="Accessible explanation" defaultOpen>
        <button type="button">Accessible trigger</button>
      </Tooltip>,
    );
    const tooltip = await screen.findByRole("tooltip");
    expect((await axe(container)).violations).toHaveLength(0);
    expect((await axe(tooltip)).violations).toHaveLength(0);
  });
});
