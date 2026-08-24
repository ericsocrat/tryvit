import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AuthenticationReference } from "./AuthenticationReference";
import { GOLDEN_ASSET_BOARDS } from "./asset-contract";
import {
  GOLDEN_DEFAULT_STATE,
  GOLDEN_REFERENCE_STATES,
  PHASE5A2_GOLDEN_REFERENCES,
  type GoldenLocale,
  type GoldenReference,
  type GoldenRouteState,
} from "./contract";
import { GoldenAssetBoardView } from "./GoldenAssetBoard";
import { GoldenFrame } from "./GoldenFrame";
import { HomeReference } from "./HomeReference";
import { LandingReference } from "./LandingReference";
import { ProductReference } from "./ProductReference";
import { ScannerReference } from "./ScannerReference";
import { SearchReference } from "./SearchReference";

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterAll(() => {
  if (originalShowModal) HTMLDialogElement.prototype.showModal = originalShowModal;
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (originalClose) HTMLDialogElement.prototype.close = originalClose;
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

afterEach(() => cleanup());

function route(
  reference: GoldenReference,
  state = GOLDEN_DEFAULT_STATE[reference],
  locale: GoldenLocale = "en",
): GoldenRouteState {
  return {
    reference,
    state,
    locale,
    theme: reference === "scanner" ? "dark" : "light",
    motion: "reduced",
    capture: true,
  };
}

function referenceElement(candidate: GoldenRouteState) {
  switch (candidate.reference) {
    case "landing": return <LandingReference route={candidate} />;
    case "authentication": return <AuthenticationReference route={candidate} />;
    case "home": return <HomeReference route={candidate} />;
    case "search": return <SearchReference route={candidate} />;
    case "product": return <ProductReference route={candidate} />;
    case "scanner": return <ScannerReference route={candidate} />;
  }
}

function renderFramed(candidate: GoldenRouteState) {
  return render(<GoldenFrame route={candidate}>{referenceElement(candidate)}</GoldenFrame>);
}

describe("Phase 5A.2 Golden Reference rendered contracts", () => {
  it("renders every finite state and every localized default without missing primary content", () => {
    for (const reference of PHASE5A2_GOLDEN_REFERENCES) {
      for (const state of GOLDEN_REFERENCE_STATES[reference]) {
        const view = render(referenceElement(route(reference, state)));
        expect(view.container.querySelector("h1")?.textContent?.trim()).toBeTruthy();
        expect(view.container.textContent?.length).toBeGreaterThan(120);
        cleanup();
      }
      for (const locale of ["pl", "de"] as const) {
        const candidate = route(reference, GOLDEN_DEFAULT_STATE[reference], locale);
        const view = renderFramed(candidate);
        expect(view.container.querySelector("[data-golden-reference]")).toHaveAttribute("lang", locale);
        expect(view.container.querySelector("h1")?.textContent?.trim()).toBeTruthy();
        cleanup();
      }
    }
  });

  it("renders every bounded identity board and both review-frame modes", () => {
    for (const board of GOLDEN_ASSET_BOARDS) {
      const view = render(<GoldenAssetBoardView board={board} theme={board === "social-og" ? "dark" : "light"} />);
      expect(view.container.querySelector(`[data-golden-asset-board='${board}']`)).toBeInTheDocument();
      cleanup();
    }
    for (const capture of [false, true]) {
      const candidate = { ...route("landing"), capture };
      const view = renderFramed(candidate);
      expect(view.container.querySelector("[data-capture]") !== null).toBe(capture);
      expect(screen.getByRole("main")).toHaveAttribute("data-ds-overlay-host");
      cleanup();
    }
  });

  it("executes the landing narrative and theme controls", () => {
    renderFramed(route("landing"));
    const unfold = screen.getByRole("button", { name: "Unfold the evidence" });
    fireEvent.click(unfold);
    expect(screen.getByRole("button", { name: "Fold back to source" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Preview dark system" }));
    expect(document.querySelector("[data-golden-reference]")).toHaveAttribute("data-theme", "dark");
    fireEvent.click(screen.getByRole("button", { name: "Return to light system" }));
    expect(document.querySelector("[data-golden-reference]")).toHaveAttribute("data-theme", "light");
    fireEvent.click(screen.getByRole("button", { name: "Fold back to source" }));
    expect(screen.getByRole("button", { name: "Unfold the evidence" })).toHaveAttribute("aria-pressed", "false");
  });

  it("executes authentication validation, failure, recovery, registration, and success", async () => {
    renderFramed(route("authentication", "sign-in"));
    const email = screen.getByRole("textbox", { name: /Email address/u });
    const password = screen.getByLabelText(/Password/u);
    fireEvent.change(email, { target: { value: "" } });
    fireEvent.change(password, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Correct the following fields")).toBeInTheDocument();

    fireEvent.change(email, { target: { value: "wrong@example.test" } });
    fireEvent.change(password, { target: { value: "evidence" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/do not match/u)).toBeInTheDocument();

    fireEvent.change(email, { target: { value: "review@tryvit.local" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Local sign-in completed", {}, { timeout: 2_500 });
    cleanup();

    renderFramed(route("authentication", "sign-in"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Display name/u }), { target: { value: "Marta" } });
    fireEvent.click(screen.getByRole("button", { name: "Review registration" }));
    await screen.findByText("Local sign-in completed");
    cleanup();

    renderFramed(route("authentication", "sign-in"));
    fireEvent.click(screen.getByRole("button", { name: "Recover access" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare recovery instructions" }));
    expect(await screen.findByText("Recovery instructions prepared")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to sign in" }));
    expect(await screen.findByRole("button", { name: "Continue" })).toBeInTheDocument();
    cleanup();

    renderFramed(route("authentication", "sign-in"));
    fireEvent.change(screen.getByRole("textbox", { name: /Email address/u }), { target: { value: "offline@tryvit.local" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Local account simulation unavailable")).toBeInTheDocument();
  });

  it("executes Home recovery and decision menu actions", async () => {
    const view = renderFramed(route("home", "paused-partial"));
    const homeControls = within(view.container.querySelector("[data-golden-client='home-controls']") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Resume evidence review" }));
    expect(homeControls.getByRole("status")).toHaveTextContent("resumed");
    const menuTrigger = screen.getByRole("button", { name: "More decision actions" });
    fireEvent.click(menuTrigger);
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Save this decision" }));
    expect(homeControls.getByRole("status")).toHaveTextContent("saved");
    fireEvent.click(menuTrigger);
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Hide this record" }));
    expect(homeControls.getByRole("status")).toHaveTextContent("");
  });

  it("executes Search query, deterministic settlement, filters, and retry", async () => {
    const view = renderFramed(route("search", "no-query"));
    const workspace = within(view.container.querySelector("[data-golden-client='search-workspace']") as HTMLElement);
    const resultCount = view.container.querySelector("[data-golden-result-count]") as HTMLElement;
    const input = screen.getByLabelText("Search synthetic products");
    fireEvent.change(input, { target: { value: "oat" } });
    expect(screen.getByText("Query in progress")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
    await waitFor(() => expect(resultCount).toHaveTextContent("3 synthetic records"), { timeout: 2_500 });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog", { name: "Filters" });
    fireEvent.click(within(dialog).getByLabelText("Include records without a score"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(resultCount).toHaveTextContent("2 synthetic records"), { timeout: 2_500 });
    cleanup();

    renderFramed(route("search", "service-error"));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(/synthetic records shown/u)).toBeInTheDocument();
  });

  it("executes Product tabs, provenance, and comparison actions", async () => {
    const view = renderFramed(route("product", "unknown"));
    fireEvent.click(screen.getByRole("tab", { name: "Ingredients" }));
    expect(screen.getByRole("tab", { name: "Ingredients" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Open provenance" }));
    const dialog = await screen.findByRole("dialog", { name: "Source and method provenance" });
    expect(within(dialog).getByText(/confidence is not assessed/u)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Comparison actions" }));
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Add to local comparison" }));
    expect(within(view.container.querySelector("[data-golden-client='product-actions']") as HTMLElement).getByRole("status")).toHaveTextContent("Added to the local comparison");
  });

  it("keeps incomplete numeric output secondary to the not-assessed decision", () => {
    const view = renderFramed(route("home", "returning"));
    const summary = within(view.container.querySelector("[data-golden-decision-summary]") as HTMLElement);
    expect(summary.getByText("Not assessed")).toBeInTheDocument();
    expect(summary.getByText(/Provisional method output: 72\/100/u)).toBeInTheDocument();
    expect(view.container.querySelector("[class*='scoreValue']")).toBeNull();
  });

  it("executes Scanner permission, recognition, interruption, manual, and contribution paths", async () => {
    renderFramed(route("scanner", "not-requested"));
    fireEvent.click(screen.getByRole("button", { name: "Review permission request" }));
    fireEvent.click(screen.getByRole("button", { name: "Allow simulation" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue acquisition" }));
    fireEvent.click(screen.getByRole("button", { name: "Recognize synthetic barcode" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume interrupted scan" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Build evidence result" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Build evidence result" }));
    await screen.findByText(/matched with moderate data confidence/u, {}, { timeout: 2_500 });
    fireEvent.click(screen.getByRole("button", { name: "Start another simulated scan" }));
    cleanup();

    renderFramed(route("scanner", "manual-entry"));
    const barcode = screen.getByLabelText("EAN-13 barcode");
    fireEvent.change(barcode, { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Check local barcode" }));
    expect(screen.getByText("The manual barcode is invalid.")).toBeInTheDocument();
    fireEvent.change(barcode, { target: { value: "5901234123457" } });
    fireEvent.click(screen.getByRole("button", { name: "Check local barcode" }));
    expect(screen.getByText(/Product identity is not matched yet/u)).toBeInTheDocument();
    cleanup();

    renderFramed(route("scanner", "uncertain-match"));
    fireEvent.click(screen.getByRole("button", { name: "Contribute missing record" }));
    fireEvent.change(screen.getByLabelText("Product name on the package"), { target: { value: "Review oat drink" } });
    fireEvent.click(screen.getByRole("button", { name: "Prepare local contribution" }));
    expect(screen.getByText(/Permission has not been requested/u)).toBeInTheDocument();
  });

  it("keeps all queued reduced-motion transitions inside React act", async () => {
    renderFramed(route("scanner", "processing"));
    await act(async () => Promise.resolve());
    expect(screen.getByText(/lookup is in progress/u)).toBeInTheDocument();
  });
});
