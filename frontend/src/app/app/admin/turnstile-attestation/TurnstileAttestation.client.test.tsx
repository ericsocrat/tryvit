import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyTurnstileToken } = vi.hoisted(() => ({
  mockVerifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ functions: {} }) }));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: mockVerifyTurnstileToken,
}));
vi.mock("@/components/common/TurnstileWidget", () => ({
  TurnstileWidget: forwardRef(function MockTurnstileWidget(
    {
      action,
      onSuccess,
    }: {
      readonly action: string;
      readonly onSuccess: (token: string) => void;
    },
  ) {
    return (
      <button
        type="button"
        data-action={action}
        onClick={() => onSuccess("synthetic-token")}
      >
        Complete challenge
      </button>
    );
  }),
}));

import {
  TURNSTILE_ATTESTATION_ACTION,
  TurnstileAttestation,
  runTurnstileAttestation,
} from "./TurnstileAttestation.client";

describe("TurnstileAttestation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the signup action and replays the exact same in-memory token", async () => {
    mockVerifyTurnstileToken
      .mockResolvedValueOnce({ valid: true, hostname: "tryvit.app" })
      .mockResolvedValueOnce({
        valid: false,
        error: "Turnstile verification failed.",
        error_codes: ["timeout-or-duplicate"],
      });

    render(<TurnstileAttestation />);
    const challenge = screen.getByRole("button", { name: "Complete challenge" });
    expect(challenge).toHaveAttribute("data-action", TURNSTILE_ATTESTATION_ACTION);

    fireEvent.click(challenge);

    await waitFor(() => expect(mockVerifyTurnstileToken).toHaveBeenCalledTimes(2));
    expect(mockVerifyTurnstileToken.mock.calls[0]?.[1]).toBe("synthetic-token");
    expect(mockVerifyTurnstileToken.mock.calls[1]?.[1]).toBe("synthetic-token");
    expect(screen.queryByText("synthetic-token")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete challenge" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("attestation-result")).toHaveTextContent("tryvit.app");
    expect(screen.getByTestId("attestation-result")).toHaveTextContent("First usePASS");
    expect(screen.getByTestId("attestation-result")).toHaveTextContent(
      "Replay rejectionPASS",
    );
    expect(screen.getByTestId("attestation-result")).toHaveTextContent(
      "No data mutation pathPASS",
    );
  });

  it("returns only sanitized fields and never returns the token", async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce({ valid: true, hostname: "tryvit.app" })
      .mockResolvedValueOnce({
        valid: false,
        error: "duplicate",
        error_codes: ["timeout-or-duplicate"],
      });

    const result = await runTurnstileAttestation(
      "synthetic-token",
      verify,
      "2026-08-31T12:00:00.000Z",
    );

    expect(verify).toHaveBeenNthCalledWith(1, "synthetic-token");
    expect(verify).toHaveBeenNthCalledWith(2, "synthetic-token");
    expect(JSON.stringify(result)).not.toContain("synthetic-token");
    expect(result).toEqual({
      timestamp: "2026-08-31T12:00:00.000Z",
      action: "signup",
      hostname: "tryvit.app",
      firstUse: "PASS",
      replayRejection: "PASS",
      noDataMutation: "PASS",
    });
  });
});
