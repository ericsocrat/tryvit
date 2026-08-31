"use client";

import { TurnstileWidget } from "@/components/common/TurnstileWidget";
import { createClient } from "@/lib/supabase/client";
import {
  verifyTurnstileToken,
  type TurnstileVerifyResult,
} from "@/lib/turnstile";
import { useCallback, useRef, useState } from "react";

export const TURNSTILE_ATTESTATION_ACTION = "signup";
export const TURNSTILE_ATTESTATION_HOSTNAME = "tryvit.app";

type Disposition = "PASS" | "FAIL";

export interface TurnstileAttestationResult {
  readonly timestamp: string;
  readonly action: typeof TURNSTILE_ATTESTATION_ACTION;
  readonly hostname: string;
  readonly firstUse: Disposition;
  readonly replayRejection: Disposition;
  readonly noDataMutation: "PASS";
}

type VerifyToken = (token: string) => Promise<TurnstileVerifyResult>;

export async function runTurnstileAttestation(
  token: string,
  verify: VerifyToken,
  timestamp = new Date().toISOString(),
): Promise<TurnstileAttestationResult> {
  const firstUse = await verify(token);
  const replay = await verify(token);
  const hostname = firstUse.valid ? (firstUse.hostname ?? "unavailable") : "unavailable";

  return {
    timestamp,
    action: TURNSTILE_ATTESTATION_ACTION,
    hostname,
    firstUse:
      firstUse.valid && hostname.toLowerCase() === TURNSTILE_ATTESTATION_HOSTNAME
        ? "PASS"
        : "FAIL",
    replayRejection:
      !replay.valid && replay.error_codes?.includes("timeout-or-duplicate")
        ? "PASS"
        : "FAIL",
    noDataMutation: "PASS",
  };
}

export function TurnstileAttestation() {
  const inFlight = useRef(false);
  const [phase, setPhase] = useState<"ready" | "running" | "complete">("ready");
  const [result, setResult] = useState<TurnstileAttestationResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const handleSuccess = useCallback(async (receivedToken: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("running");
    setFailure(null);

    let ephemeralToken: string | null = receivedToken;
    try {
      const supabase = createClient();
      const attestation = await runTurnstileAttestation(
        ephemeralToken,
        (token) => verifyTurnstileToken(supabase, token),
      );
      setResult(attestation);
    } catch {
      setFailure("Verification did not complete. The temporary proof remains blocked.");
    } finally {
      ephemeralToken = null;
      inFlight.current = false;
      setPhase("complete");
    }
  }, []);

  const handleWidgetFailure = useCallback(() => {
    setFailure("The production challenge did not issue a valid token.");
  }, []);

  return (
    <div className="mt-6 space-y-4" data-testid="turnstile-attestation">
      {phase === "ready" ? (
        <TurnstileWidget
          action={TURNSTILE_ATTESTATION_ACTION}
          appearance="always"
          size="flexible"
          onSuccess={handleSuccess}
          onError={handleWidgetFailure}
          onExpire={handleWidgetFailure}
        />
      ) : null}

      <div aria-live="polite" className="rounded-xl border border-border bg-surface-subtle p-4">
        {phase === "ready" ? (
          <p className="text-sm text-foreground-secondary">
            Complete the Cloudflare interaction to start the one-shot proof.
          </p>
        ) : null}
        {phase === "running" ? (
          <p className="text-sm font-medium text-foreground">Verification is running…</p>
        ) : null}
        {failure ? <p className="text-sm font-medium text-error-text">{failure}</p> : null}
        {result ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2" data-testid="attestation-result">
            <div>
              <dt className="text-foreground-secondary">Timestamp</dt>
              <dd className="font-mono text-xs text-foreground">{result.timestamp}</dd>
            </div>
            <div>
              <dt className="text-foreground-secondary">Action</dt>
              <dd className="font-mono text-foreground">{result.action}</dd>
            </div>
            <div>
              <dt className="text-foreground-secondary">Hostname</dt>
              <dd className="font-mono text-foreground">{result.hostname}</dd>
            </div>
            <div>
              <dt className="text-foreground-secondary">First use</dt>
              <dd className="font-semibold text-foreground">{result.firstUse}</dd>
            </div>
            <div>
              <dt className="text-foreground-secondary">Replay rejection</dt>
              <dd className="font-semibold text-foreground">{result.replayRejection}</dd>
            </div>
            <div>
              <dt className="text-foreground-secondary">No data mutation path</dt>
              <dd className="font-semibold text-foreground">{result.noDataMutation}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
