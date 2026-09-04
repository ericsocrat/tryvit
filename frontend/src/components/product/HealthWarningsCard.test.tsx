import type {
    HealthProfileActiveResponse,
    HealthWarningsResponse,
    RpcResult,
} from "@/lib/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthWarningBadge, HealthWarningsCard } from "./HealthWarningsCard";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetActiveHealthProfile = vi.fn();
const mockGetProductHealthWarnings = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/lib/api", () => ({
  getActiveHealthProfile: (...args: unknown[]) =>
    mockGetActiveHealthProfile(...args),
  getProductHealthWarnings: (...args: unknown[]) =>
    mockGetProductHealthWarnings(...args),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

function err<T>(message: string): RpcResult<T> {
  return { ok: false, error: { code: "UNAVAILABLE", message } };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const noProfile: HealthProfileActiveResponse = {
  api_version: "1.0",
  profile: null,
};

const activeProfile: HealthProfileActiveResponse = {
  api_version: "1.0",
  profile: {
    profile_id: "p-1",
    profile_name: "My Health",
    is_active: true,
    health_conditions: ["diabetes", "hypertension"],
    max_sugar_g: 10,
    max_salt_g: 1,
    max_saturated_fat_g: null,
    max_calories_kcal: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

const noWarnings: HealthWarningsResponse = {
  api_version: "1.0",
  product_id: 42,
  warning_count: 0,
  warnings: [],
  evaluation_disposition: "evaluated",
  evidence_completeness: {
    status: "complete",
    required_count: 2,
    evaluated_count: 2,
    required: ["diabetes.high_sugar_flag", "diabetes.sugars_g"],
    evaluated: ["diabetes.high_sugar_flag", "diabetes.sugars_g"],
    missing: [],
  },
};

const twoWarnings: HealthWarningsResponse = {
  api_version: "1.0",
  product_id: 42,
  warning_count: 2,
  evaluation_disposition: "evaluated",
  evidence_completeness: {
    status: "complete",
    required_count: 4,
    evaluated_count: 4,
    required: [
      "diabetes.high_sugar_flag",
      "diabetes.sugars_g",
      "hypertension.high_salt_flag",
      "hypertension.salt_g",
    ],
    evaluated: [
      "diabetes.high_sugar_flag",
      "diabetes.sugars_g",
      "hypertension.high_salt_flag",
      "hypertension.salt_g",
    ],
    missing: [],
  },
  warnings: [
    {
      condition: "diabetes",
      severity: "high",
      message: "Sugar meets or exceeds your limit: 13.5g vs max 10g",
    },
    {
      condition: "hypertension",
      severity: "moderate",
      message: "Salt is elevated for hypertension",
    },
  ],
};

const criticalWarning: HealthWarningsResponse = {
  api_version: "1.0",
  product_id: 42,
  warning_count: 1,
  evaluation_disposition: "evaluated",
  evidence_completeness: {
    status: "complete",
    required_count: 1,
    evaluated_count: 1,
    required: ["celiac_disease.gluten_assessment"],
    evaluated: ["celiac_disease.gluten_assessment"],
    missing: [],
  },
  warnings: [
    {
      condition: "celiac_disease",
      severity: "critical",
      message: "Contains gluten — unsafe for celiac disease",
    },
  ],
};

const withheldWarnings: HealthWarningsResponse = {
  api_version: "1.0",
  product_id: 42,
  warning_count: 0,
  warnings: [],
  evaluation_disposition: "withheld",
  evidence_completeness: {
    status: "incomplete",
    required_count: 2,
    evaluated_count: 1,
    required: ["diabetes.high_sugar_flag", "diabetes.sugars_g"],
    evaluated: ["diabetes.high_sugar_flag"],
    missing: ["diabetes.sugars_g"],
  },
};

const partialWarnings: HealthWarningsResponse = {
  ...criticalWarning,
  evaluation_disposition: "partial",
  evidence_completeness: {
    status: "incomplete",
    required_count: 2,
    evaluated_count: 1,
    required: [
      "celiac_disease.gluten_assessment",
      "heart_disease.saturated_fat_g",
    ],
    evaluated: ["celiac_disease.gluten_assessment"],
    missing: ["heart_disease.saturated_fat_g"],
  },
};

const noApplicableChecks: HealthWarningsResponse = {
  api_version: "1.0",
  product_id: 42,
  warning_count: 0,
  warnings: [],
  evaluation_disposition: "not_applicable",
  evidence_completeness: {
    status: "not_applicable",
    required_count: 0,
    evaluated_count: 0,
    required: [],
    evaluated: [],
    missing: [],
  },
};

// ─── HealthWarningsCard Tests ───────────────────────────────────────────────

describe("HealthWarningsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows setup prompt when no active profile", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(noProfile));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Personalized health warnings"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/health profile/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/settings");
  });

  it("announces loading without implying a safe result", () => {
    mockGetActiveHealthProfile.mockReturnValue(new Promise(() => {}));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAccessibleName(
      "Checking personalized health warnings…",
    );
    expect(screen.queryByText("Within your limits")).not.toBeInTheDocument();
  });

  it("fails closed when the active profile is unavailable and supports retry", async () => {
    const user = userEvent.setup();
    mockGetActiveHealthProfile.mockResolvedValue(
      err<HealthProfileActiveResponse>("profile unavailable"),
    );

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Health warning evidence unavailable");
    expect(alert).toHaveTextContent(
      "This does not mean the product is within your limits.",
    );
    expect(screen.queryByText("Within your limits")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mockGetActiveHealthProfile).toHaveBeenCalledTimes(2));
  });

  it("fails closed when warning evidence is unavailable", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(
      err<HealthWarningsResponse>("warnings unavailable"),
    );

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Health warning evidence unavailable",
    );
    expect(screen.queryByText("Within your limits")).not.toBeInTheDocument();
  });

  it("shows 'within your limits' when no warnings", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(noWarnings));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Within your limits")).toBeInTheDocument();
    });
    expect(screen.getByText(/My Health/)).toBeInTheDocument();
  });

  it("withholds the all-clear when condition evidence is incomplete", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(withheldWarnings));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Health warning check incomplete",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "TryVit cannot give this product an all-clear.",
    );
    expect(screen.queryByText("Within your limits")).not.toBeInTheDocument();
  });

  it("keeps known warnings visible while disclosing a partial evaluation", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(partialWarnings));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    expect(
      await screen.findByText("Contains gluten — unsafe for celiac disease"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Other checks required by your profile could not be completed.",
    );
    expect(screen.queryByText("Within your limits")).not.toBeInTheDocument();
  });

  it("renders a neutral state when the profile has no applicable checks", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(noApplicableChecks));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    expect(
      await screen.findByText("No health checks configured"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review health profile" }),
    ).toHaveAttribute("href", "/app/settings");
    expect(screen.queryByText("Within your limits")).not.toBeInTheDocument();
  });

  it("renders warnings sorted by severity", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(twoWarnings));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("2 health warnings")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Sugar meets or exceeds your limit: 13.5g vs max 10g"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Salt is elevated for hypertension"),
    ).toBeInTheDocument();
    expect(screen.getByText(/My Health/)).toBeInTheDocument();
  });

  it("renders critical warning with correct severity", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(criticalWarning));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("1 health warning")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Contains gluten — unsafe for celiac disease"),
    ).toBeInTheDocument();
  });

  it("displays profile name for active profile", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(twoWarnings));

    render(<HealthWarningsCard productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Profile: My Health/)).toBeInTheDocument();
    });
  });
});

// ─── HealthWarningBadge Tests ───────────────────────────────────────────────

describe("HealthWarningBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no active profile", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(noProfile));

    const { container } = render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    // Wait for profile query to resolve, badge should be null
    await waitFor(() => {
      expect(mockGetActiveHealthProfile).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders green check when profile exists but no warnings", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(noWarnings));

    const { container } = render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // Check icon renders as SVG (Lucide)
      expect(container.querySelector("svg")).toBeTruthy();
    });
    expect(screen.getByTitle("No health warnings")).toBeInTheDocument();
  });

  it("renders an incomplete badge instead of a green check when all-clear is withheld", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(withheldWarnings));

    render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    const badge = await screen.findByTestId("health-warnings-incomplete-badge");
    expect(badge).toHaveAccessibleName("Health warning check incomplete");
    expect(screen.queryByTitle("No health warnings")).not.toBeInTheDocument();
  });

  it("renders no badge when the profile has no applicable checks", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(noApplicableChecks));

    const { container } = render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockGetProductHealthWarnings).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders an unavailable badge instead of a green check on failure", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(
      err<HealthWarningsResponse>("warnings unavailable"),
    );

    render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    const badge = await screen.findByTestId(
      "health-warnings-unavailable-badge",
    );
    expect(badge).toHaveAccessibleName("Health warning evidence unavailable");
    expect(screen.queryByTitle("No health warnings")).not.toBeInTheDocument();
  });

  it("renders warning count badge when warnings exist", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(twoWarnings));

    render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
    expect(screen.getByTitle("2 health warnings")).toBeInTheDocument();
  });

  it("renders 1 warning with singular title", async () => {
    mockGetActiveHealthProfile.mockResolvedValue(ok(activeProfile));
    mockGetProductHealthWarnings.mockResolvedValue(ok(criticalWarning));

    render(<HealthWarningBadge productId={42} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    expect(screen.getByTitle("1 health warning")).toBeInTheDocument();
  });
});
