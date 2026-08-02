import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LiveHeaderAuthAction,
  LiveLandingAuthActions,
  LivePublicAuthProvider,
} from "./LivePublicAuthActions";
import { PublicHeader } from "./PublicHeader";

const { mockCreateClient, mockGetUser, mockUnsubscribe } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
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
      onAuthStateChange: vi.fn(() => ({
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
});
