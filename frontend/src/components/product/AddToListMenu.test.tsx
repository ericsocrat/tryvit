import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddToListMenu } from "./AddToListMenu";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAddMutate = vi.fn();
const mockRemoveMutate = vi.fn();
const mockShowToast = vi.fn();
let mockAddError: Error | null = null;
let mockRemoveError: Error | null = null;
const mockMembership =
  vi.fn<() => { data: { list_ids: number[] } | undefined; isPending?: boolean; isError?: boolean; refetch?: () => void }>();
const mockListsData = vi.fn<
  () => {
    data:
      | { lists: Array<{ id: number; name: string; list_type: string }> }
      | undefined;
    isPending?: boolean;
    isError?: boolean;
    refetch?: () => void;
  }
>();

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => mockListsData(),
  useAddToList: () => ({
    mutate: mockAddMutate,
    isPending: false,
    error: mockAddError,
  }),
  useRemoveFromList: () => ({
    mutate: mockRemoveMutate,
    isPending: false,
    error: mockRemoveError,
  }),
  useProductListMembership: () => mockMembership(),
}));

vi.mock("@/lib/toast", () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

const mockIsFavorite = vi.fn<(id: number) => boolean>().mockReturnValue(false);
vi.mock("@/stores/favorites-store", () => ({
  useFavoritesStore: (
    selector: (s: { isFavorite: (id: number) => boolean }) => unknown,
  ) => selector({ isFavorite: mockIsFavorite }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const LISTS = [
  { id: 1, name: "Favorites", list_type: "favorites" },
  { id: 2, name: "Avoid", list_type: "avoid" },
  { id: 3, name: "Groceries", list_type: "custom" },
];

function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function createWrapper() {
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsFavorite.mockReturnValue(false);
  mockAddError = null;
  mockRemoveError = null;
  mockListsData.mockReturnValue({ data: { lists: LISTS } });
  mockMembership.mockReturnValue({ data: { list_ids: [] } });
});

describe("truthful list lookup and primary actions", () => {
  it("shows a visible label when used as the primary save action", () => {
    render(<AddToListMenu productId={42} showLabel />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "Add to list" })).toHaveTextContent("Add to list");
  });
  it("does not offer a mutation before membership is known", () => {
    mockMembership.mockReturnValue({ data: undefined, isPending: true });
    render(<AddToListMenu productId={42} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    for (const item of screen.getAllByRole("menuitem")) expect(item).toBeDisabled();
    expect(screen.queryByText("No lists yet")).not.toBeInTheDocument();
    expect(mockAddMutate).not.toHaveBeenCalled();
  });
  it("distinguishes lookup failure from no lists and retries both reads", () => {
    const retryLists = vi.fn(); const retryMembership = vi.fn();
    mockListsData.mockReturnValue({ data: undefined, isError: true, refetch: retryLists });
    mockMembership.mockReturnValue({ data: undefined, isError: true, refetch: retryMembership });
    render(<AddToListMenu productId={42} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load lists.");
    expect(screen.queryByText("No lists yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Retry" }));
    expect(retryLists).toHaveBeenCalledOnce(); expect(retryMembership).toHaveBeenCalledOnce();
  });
  it("supports arrow-key traversal after opening", async () => {
    render(<AddToListMenu productId={42} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    const items = screen.getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: "End" });
    expect(items[2]).toHaveFocus();
  });
});

// ─── Compact mode ───────────────────────────────────────────────────────────

describe("AddToListMenu — compact mode", () => {
  it("renders heart icon for non-favorite", () => {
    mockIsFavorite.mockReturnValue(false);
    render(<AddToListMenu productId={42} compact />, {
      wrapper: createWrapper(),
    });
    const addBtn = screen.getByRole("button", { name: "Add to Favorites" });
    expect(addBtn.querySelector("svg")).toBeTruthy(); // Heart icon (unfilled)
  });

  it("renders filled heart for favorite", () => {
    mockIsFavorite.mockReturnValue(true);
    render(<AddToListMenu productId={42} compact />, {
      wrapper: createWrapper(),
    });
    const removeBtn = screen.getByRole("button", {
      name: "Remove from Favorites",
    });
    expect(removeBtn.querySelector("svg")).toBeTruthy(); // Heart icon (filled)
  });

  it("calls addMutate when toggling on", () => {
    mockIsFavorite.mockReturnValue(false);
    render(<AddToListMenu productId={42} compact />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));
    expect(mockAddMutate).toHaveBeenCalledWith(
      {
        listId: 1,
        productId: 42,
        listType: "favorites",
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("calls removeMutate when toggling off", () => {
    mockIsFavorite.mockReturnValue(true);
    render(<AddToListMenu productId={42} compact />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Remove from Favorites" }),
    );
    expect(mockRemoveMutate).toHaveBeenCalledWith(
      {
        listId: 1,
        productId: 42,
        listType: "favorites",
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("describes a failed compact mutation and keeps the control retryable", () => {
    mockAddError = new Error("add denied");
    render(<AddToListMenu productId={42} compact />, {
      wrapper: createWrapper(),
    });

    const button = screen.getByRole("button", { name: "Add to Favorites" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute(
      "aria-describedby",
      "list-membership-error-42",
    );
    expect(button).toHaveAccessibleDescription(
      "Could not update this list. Your previous state was kept. Try again.",
    );
  });

  it("shows a visible toast when a compact mutation fails", () => {
    mockAddMutate.mockImplementationOnce(
      (_variables: unknown, options?: { onError?: () => void }) => {
        options?.onError?.();
      },
    );
    render(<AddToListMenu productId={42} compact />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));

    expect(mockShowToast).toHaveBeenCalledWith({
      type: "error",
      messageKey: "productActions.updateFailed",
    });
  });
});

// ─── Full dropdown mode ─────────────────────────────────────────────────────

describe("AddToListMenu — dropdown mode", () => {
  it("renders add-to-list button", () => {
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    expect(
      screen.getByRole("button", { name: "Add to list" }),
    ).toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("Avoid")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("keeps a failed list mutation visible while the menu remains retryable", () => {
    mockRemoveError = new Error("remove denied");
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    const button = screen.getByRole("button", { name: "Add to list" });
    fireEvent.click(button);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not update this list. Your previous state was kept. Try again.",
    );
    expect(button).toHaveAttribute(
      "aria-describedby",
      "list-membership-error-42",
    );
    expect(screen.getByText("Groceries").closest("button")).not.toBeDisabled();
  });

  it("toggles dropdown closed on second click", () => {
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    const btn = screen.getByRole("button", { name: "Add to list" });
    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows 'No lists yet' when empty", () => {
    mockListsData.mockReturnValue({ data: { lists: [] } });
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    expect(screen.getByText("No lists yet")).toBeInTheDocument();
  });

  it("calls addMutate when clicking a list", () => {
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    fireEvent.click(screen.getByText("Groceries"));
    expect(mockAddMutate).toHaveBeenCalledWith({
      listId: 3,
      productId: 42,
      listType: "custom",
    });
  });

  it("calls removeMutate for in-list product", () => {
    mockMembership.mockReturnValue({ data: { list_ids: [3] } });
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    // Product is in Groceries → shows "remove"
    expect(screen.getByText("remove")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Groceries"));
    expect(mockRemoveMutate).toHaveBeenCalledWith({
      listId: 3,
      productId: 42,
      listType: "custom",
    });
  });

  it("sets aria-expanded correctly", () => {
    render(<AddToListMenu productId={42} />, {
      wrapper: createWrapper(),
    });
    const btn = screen.getByRole("button", { name: "Add to list" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on outside click", async () => {
    render(
      <div>
        <p>Outside</p>
        <AddToListMenu productId={42} />
      </div>,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("Outside"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
