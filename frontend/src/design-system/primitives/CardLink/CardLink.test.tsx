import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardLink, type CardLinkRootProps } from "./CardLink";
import { Button } from "@/design-system/primitives/Button/Button";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("V2 CardLink", () => {
  it("renders secondary controls as siblings of the stretched link", () => {
    render(
      <CardLink.Root>
        <CardLink.Primary href="/app/product/1">Product evidence</CardLink.Primary>
        <CardLink.Actions>
          <button type="button">Save</button>
        </CardLink.Actions>
      </CardLink.Root>,
    );

    const link = screen.getByRole("link", { name: "Product evidence" });
    const action = screen.getByRole("button", { name: "Save" });
    expect(link).not.toContainElement(action);
    expect(link.parentElement).toBe(action.parentElement?.parentElement);
  });

  it("rejects interactive roots even if an untyped caller bypasses TypeScript", () => {
    const unsafeProps = {
      as: "a",
      children: "Unsafe card root",
    } as unknown as CardLinkRootProps;

    expect(() => render(<CardLink.Root {...unsafeProps} />)).toThrow(
      /CardLink.Root must use a noninteractive container/,
    );
  });

  it("rejects focus behavior on an allowed root after an unsafe cast", () => {
    const unsafeProps = {
      children: "Unsafe card behavior",
      tabIndex: 0,
    } as unknown as CardLinkRootProps;

    expect(() => render(<CardLink.Root {...unsafeProps} />)).toThrow(
      /CardLink.Root is a noninteractive container and does not accept tabIndex/,
    );
  });

  it("requires concrete secondary controls to use the actions slot", () => {
    expect(() =>
      render(
        <CardLink.Root>
          <>
            <CardLink.Primary href="/app/product/1">Product evidence</CardLink.Primary>
            <button type="button">Misplaced action</button>
          </>
        </CardLink.Root>,
      ),
    ).toThrow(/place secondary controls in CardLink.Actions/);
  });

  it("rejects concrete interactive descendants inside the primary link", () => {
    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <span>
            <button type="button">Nested action</button>
          </span>
        </CardLink.Primary>,
      ),
    ).toThrow(/CardLink.Primary cannot contain interactive descendants/);

    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <label htmlFor="nested-control">Nested label</label>
        </CardLink.Primary>,
      ),
    ).toThrow(/CardLink.Primary cannot contain interactive descendants/);
  });

  it("rejects embedded and image-map navigation descendants inside the primary link", () => {
    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <object aria-label="Embedded evidence" data="/embedded-evidence.html" />
        </CardLink.Primary>,
      ),
    ).toThrow(/CardLink.Primary cannot contain interactive descendants/);

    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <map name="evidence-map">
            <area alt="Open evidence source" href="/app/source/1" shape="default" />
          </map>
        </CardLink.Primary>,
      ),
    ).toThrow(/CardLink.Primary cannot contain interactive descendants/);
  });

  it("rejects interactive ARIA roles inside the primary link", () => {
    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <span aria-checked="false" role="menuitemcheckbox">Select evidence</span>
        </CardLink.Primary>,
      ),
    ).toThrow(/CardLink.Primary cannot contain interactive descendants/);
  });

  it("rejects keyboard and pointer event handlers inside protected card content", () => {
    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <span onKeyDown={() => undefined}>Keyboard action</span>
        </CardLink.Primary>,
      ),
    ).toThrow(/CardLink.Primary cannot contain interactive descendants/);

    expect(() =>
      render(
        <CardLink.Root>
          <CardLink.Primary href="/app/product/1">Product evidence</CardLink.Primary>
          <span onPointerDown={() => undefined}>Pointer action</span>
        </CardLink.Root>,
      ),
    ).toThrow(/place secondary controls in CardLink.Actions/);
  });

  it("rejects opaque controls whose rendered descendants cannot be proven safe", () => {
    expect(() =>
      render(
        <CardLink.Primary href="/app/product/1">
          <Button>Nested action</Button>
        </CardLink.Primary>,
      ),
    ).toThrow(/cannot verify opaque custom descendants/);
  });

  it("requires exactly one direct primary link and at most one actions slot", () => {
    expect(() => render(<CardLink.Root>Missing primary</CardLink.Root>)).toThrow(
      /exactly one direct CardLink.Primary/u,
    );
    expect(() =>
      render(
        <CardLink.Root>
          <CardLink.Primary href="/one">One</CardLink.Primary>
          <CardLink.Primary href="/two">Two</CardLink.Primary>
        </CardLink.Root>,
      ),
    ).toThrow(/exactly one direct CardLink.Primary/u);
    expect(() =>
      render(
        <CardLink.Root>
          <CardLink.Primary href="/one">One</CardLink.Primary>
          <CardLink.Actions>First actions</CardLink.Actions>
          <CardLink.Actions>Second actions</CardLink.Actions>
        </CardLink.Root>,
      ),
    ).toThrow(/at most one direct CardLink.Actions/u);
    expect(() =>
      render(
        <CardLink.Root>
          <div>
            <CardLink.Primary href="/nested">Nested</CardLink.Primary>
          </div>
        </CardLink.Root>,
      ),
    ).toThrow(/must be a direct CardLink.Root child/u);
  });

  it("treats fragments as transparent direct composition", () => {
    render(
      <CardLink.Root>
        <>
          <CardLink.Primary href="/app/product/1">Product evidence</CardLink.Primary>
          <CardLink.Actions>Actions</CardLink.Actions>
        </>
      </CardLink.Root>,
    );
    expect(screen.getByRole("link", { name: "Product evidence" })).toBeVisible();
  });
});
