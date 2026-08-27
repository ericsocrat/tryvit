import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LiveHeaderAuthAction,
  LiveLandingAuthActions,
  LivePublicAuthProvider,
} from "./LivePublicAuthActions";
import { PublicHeader } from "./PublicHeader";

const { mockCreateClient, mockGetUser, mockOnAuthStateChange, mockUnsubscribe } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={prefetch === false ? "false" : undefined} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockReturnValue({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange.mockImplementation(() => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })),
    },
  });
});

describe("live public auth actions", () => {
  it("preserves the live signed-in Dashboard destination", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    render(
      <LivePublicAuthProvider>
        <LiveHeaderAuthAction signInLabel="Sign in" dashboardLabel="Dashboard" />
      </LivePublicAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/app");
    });
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "data-prefetch",
      "false",
    );
  });

  it("preserves the live signed-out signup and login actions", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      <LivePublicAuthProvider>
        <LiveLandingAuthActions
          placement="hero"
          getStartedLabel="Get started"
          signInLabel="Sign in"
          dashboardLabel="Dashboard"
        />
      </LivePublicAuthProvider>,
    );

    expect(screen.getByText("Get started").closest("a")).toHaveAttribute("href", "/auth/signup");
    expect(screen.getByText("Sign in").closest("a")).toHaveAttribute("href", "/auth/login");
  });

  it("shares one auth client and listener across all live landing actions", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(
      <LivePublicAuthProvider>
        <LiveHeaderAuthAction signInLabel="Header sign in" dashboardLabel="Dashboard" />
        <LiveLandingAuthActions
          placement="hero"
          getStartedLabel="Hero start"
          signInLabel="Hero sign in"
          dashboardLabel="Dashboard"
        />
        <LiveLandingAuthActions
          placement="closing"
          getStartedLabel="Closing start"
          signInLabel="Closing sign in"
          dashboardLabel="Dashboard"
        />
      </LivePublicAuthProvider>,
    );

    await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(1));
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient.mock.results[0]?.value.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it("mounts no live auth client for a paused public header", () => {
    render(
      <PublicHeader
        dataAvailable={false}
        contactLabel="Contact"
        signInLabel="Sign in"
        dashboardLabel="Dashboard"
        demoLabel="Demo mode"
        themeLabel="Theme"
        lightThemeLabel="Light"
        darkThemeLabel="Dark"
      />,
    );

    expect(screen.getByText("Demo mode").closest("a")).toHaveAttribute("href", "#service-status");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("degrades to signed-out actions when the auth probe rejects", async () => {
    mockGetUser.mockRejectedValue(new Error("auth unavailable"));

    render(
      <LivePublicAuthProvider>
        <LiveHeaderAuthAction signInLabel="Sign in" dashboardLabel="Dashboard" />
      </LivePublicAuthProvider>,
    );

    await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Sign in").closest("a")).toHaveAttribute("href", "/auth/login");
  });

  it("degrades to signed-out actions when the auth client cannot initialize", () => {
    mockCreateClient.mockImplementation(() => {
      throw new Error("missing live auth configuration");
    });

    render(
      <LivePublicAuthProvider>
        <LiveHeaderAuthAction signInLabel="Sign in" dashboardLabel="Dashboard" />
      </LivePublicAuthProvider>,
    );

    expect(screen.getByText("Sign in").closest("a")).toHaveAttribute("href", "/auth/login");
  });

  it("tracks live auth changes and removes the shared listener on unmount", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { unmount } = render(
      <LivePublicAuthProvider>
        <LiveHeaderAuthAction signInLabel="Sign in" dashboardLabel="Dashboard" />
      </LivePublicAuthProvider>,
    );

    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1));
    const handleAuthChange = mockOnAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
      session: { user: { id: string } },
    ) => void;
    act(() => handleAuthChange("SIGNED_IN", { user: { id: "user-1" } }));
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/app");

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
