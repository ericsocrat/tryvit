"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Input } from "@/design-system/primitives/Field";

export type ScannerState =
  | "permission"
  | "ready"
  | "recognized"
  | "processing"
  | "matched"
  | "partial"
  | "not-found"
  | "offline"
  | "camera-unavailable"
  | "manual";

export interface ScannerStudyCopy {
  readonly stateLabel: Readonly<Record<ScannerState, string>>;
  readonly begin: string;
  readonly buildResult: string;
  readonly cancel: string;
  readonly retry: string;
  readonly useManual: string;
  readonly manualLabel: string;
  readonly manualHint: string;
  readonly manualSubmit: string;
  readonly manualInvalid: string;
}

type ScannerAction = Readonly<{
  label: string;
  variant: "primary" | "secondary";
}>;

function scannerAction(state: ScannerState, copy: ScannerStudyCopy): ScannerAction | null {
  switch (state) {
    case "permission":
    case "ready":
      return { label: copy.begin, variant: "primary" };
    case "recognized":
      return { label: copy.buildResult, variant: "primary" };
    case "processing":
      return { label: copy.cancel, variant: "secondary" };
    case "matched":
    case "partial":
      return { label: copy.retry, variant: "secondary" };
    case "not-found":
    case "offline":
    case "camera-unavailable":
      return { label: copy.useManual, variant: "secondary" };
    case "manual":
      return null;
  }
}

export function ScannerStudy({
  className,
  copy,
  direction,
  ean,
  initialState,
}: Readonly<{
  className: string;
  copy: ScannerStudyCopy;
  direction: string;
  ean: string;
  initialState: ScannerState;
}>) {
  const [state, setState] = useState<ScannerState>(initialState);
  const [manualValue, setManualValue] = useState(ean);
  const [manualError, setManualError] = useState<string | undefined>();
  const [processingArmed, setProcessingArmed] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const focusAfterTransitionRef = useRef<"action" | "manual" | null>(null);
  const action = scannerAction(state, copy);

  useEffect(() => {
    if (state !== "processing" || !processingArmed) return;
    const completion = window.setTimeout(() => {
      setProcessingArmed(false);
      setState("matched");
    }, 720);
    return () => window.clearTimeout(completion);
  }, [processingArmed, state]);

  useEffect(() => {
    const focusTarget = focusAfterTransitionRef.current;
    if (focusTarget === "manual" && state === "manual") {
      manualInputRef.current?.focus();
      focusAfterTransitionRef.current = null;
      return;
    }
    if (focusTarget === "action" && state !== "manual") {
      actionRef.current?.focus();
      focusAfterTransitionRef.current = null;
    }
  }, [state]);

  const runAction = () => {
    switch (state) {
      case "permission":
      case "processing":
      case "matched":
      case "partial":
        setProcessingArmed(false);
        setState("ready");
        return;
      case "ready":
        setState("recognized");
        return;
      case "recognized":
        setProcessingArmed(true);
        setState("processing");
        return;
      case "not-found":
      case "offline":
      case "camera-unavailable":
        focusAfterTransitionRef.current = "manual";
        setManualError(undefined);
        setState("manual");
        return;
      case "manual":
        return;
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manualValue === ean) {
      setManualError(undefined);
      focusAfterTransitionRef.current = "action";
      setState("matched");
      return;
    }
    setManualError(copy.manualInvalid);
    manualInputRef.current?.focus();
  };

  return (
    <section
      aria-label={copy.stateLabel[state]}
      className={className}
      data-phase5a2-scanner=""
      data-phase5a2-state={state}
      data-phase5a2-direction={direction}
    >
      <div aria-atomic="true" aria-live="polite" className="phase5a2-scanner-status" role="status">
        <span>{copy.stateLabel[state]}</span>
        {(state === "recognized" || state === "processing" || state === "matched" || state === "partial")
          ? <strong dir="ltr">{ean}</strong>
          : null}
      </div>

      {state === "manual" ? (
        <form className="phase5a2-scanner-manual" onSubmit={submitManual}>
          <Input
            ref={manualInputRef}
            announceError
            error={manualError}
            hint={copy.manualHint}
            inputMode="numeric"
            label={copy.manualLabel}
            maxLength={13}
            onChange={(event) => {
              setManualError(undefined);
              setManualValue(event.currentTarget.value);
            }}
            value={manualValue}
          />
          <Button type="submit">{copy.manualSubmit}</Button>
        </form>
      ) : null}

      <div className="phase5a2-scanner-actions">
        {action ? (
          <Button ref={actionRef} onClick={runAction} variant={action.variant}>
            {action.label}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
