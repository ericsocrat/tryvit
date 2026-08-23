"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Input } from "@/design-system/primitives/Field";

import type { GoldenCommonCopy } from "./common-copy";
import type { GOLDEN_REFERENCE_STATES, GoldenRouteState } from "./contract";
import { DecisionSummary } from "./GoldenEvidence";
import { GoldenGlyph } from "./GoldenGlyph";
import type { ScannerCopy } from "./scanner-copy";
import styles from "./golden.module.css";

type ScannerState = (typeof GOLDEN_REFERENCE_STATES.scanner)[number];
type ScannerEvent =
  | "request"
  | "grant"
  | "deny"
  | "assist"
  | "recognize"
  | "process"
  | "match"
  | "retry"
  | "manual"
  | "invalid"
  | "contribute"
  | "interrupt"
  | "resume"
  | "cancel";


function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
  switch (event) {
    case "request": return "permission-request";
    case "grant": return "ready";
    case "deny": return "permission-denied";
    case "assist": return "acquisition-assist";
    case "recognize": return "recognized";
    case "process": return "processing";
    case "match": return "matched";
    case "manual": return "manual-entry";
    case "invalid": return "invalid-barcode";
    case "contribute": return "contribution-entry";
    case "interrupt": return "interrupted";
    case "resume": return "resumed";
    case "retry": return state === "permission-denied" || state === "camera-unavailable" ? "not-requested" : "ready";
    case "cancel": return "not-requested";
  }
}

export function ScannerExperience({
  route,
  copy,
  common,
}: Readonly<{
  route: GoldenRouteState;
  copy: ScannerCopy;
  common: GoldenCommonCopy;
}>) {
  const [state, dispatch] = useReducer(scannerReducer, route.state as ScannerState);
  const [barcode, setBarcode] = useState(route.state === "invalid-barcode" ? "123" : "5901234123457");
  const [contribution, setContribution] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const armedRef = useRef(false);
  const resumeTargetRef = useRef<ScannerState>("recognized");

  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, [state]);

  useEffect(() => {
    if (!armedRef.current) return;
    queueMicrotask(() => statusRef.current?.focus());
  }, [state]);

  useEffect(() => {
    if (state !== "processing" || !armedRef.current) return;
    const generation = ++generationRef.current;
    const timeout = window.setTimeout(() => {
      if (generationRef.current === generation) dispatch("match");
    }, route.motion === "reduced" ? 0 : 360);
    return () => window.clearTimeout(timeout);
  }, [route.motion, state]);

  function send(event: ScannerEvent) {
    armedRef.current = true;
    if (event === "interrupt") {
      resumeTargetRef.current = state === "processing" ? "recognized" : state;
      generationRef.current += 1;
    }
    if (event === "resume") {
      dispatch("resume");
      queueMicrotask(() => dispatch(resumeTargetRef.current === "recognized" ? "recognize" : "retry"));
      return;
    }
    dispatch(event);
  }

  function submitBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (barcode !== "5901234123457") {
      send("invalid");
      return;
    }
    send("recognize");
  }

  const stateText = copy.stateLabel[state];
  const uncertain = state === "uncertain-match" || state === "partial-match";

  return (
    <article className={styles.scannerReference} data-golden-client="scanner-machine" data-golden-live-state={state} ref={rootRef}>
      <header className={styles.scannerHeader}>
        <div><p className={styles.eyebrow}>{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p></div>
        <span className={styles.noCamera}><GoldenGlyph name="scanner" />{copy.noCamera}</span>
      </header>

      <section className={styles.scannerWorkspace}>
        <div className={styles.scannerViewport} data-scanner-state={state}>
          <span className={styles.scannerCorner} aria-hidden="true" />
          <div className={styles.barcode} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
          <p>{state === "ready" || state === "acquisition-assist" ? stateText : copy.noCamera}</p>
        </div>

        <div className={styles.scannerTask}>
          <div aria-atomic="true" aria-live="polite" className={styles.scannerStatus} ref={statusRef} role="status" tabIndex={-1}>
            <GoldenGlyph name={uncertain || state.includes("unavailable") || state.includes("denied") ? "unknown" : state === "matched" ? "decision" : "scanner"} size={32} />
            <div><span className={styles.eyebrow}>{state}</span><strong>{stateText}</strong></div>
          </div>

          {state === "permission-request" ? <div className={styles.permissionPanel}><h2>{copy.permissionTitle}</h2><p>{copy.permissionBody}</p></div> : null}
          {state === "processing" ? <div className={styles.scannerProgress} aria-busy="true"><label htmlFor="golden-scan-progress">{copy.progress}</label><progress id="golden-scan-progress" max={4} value={3}>3 / 4</progress></div> : null}
          {state === "manual-entry" || state === "invalid-barcode" ? (
            <form className={styles.manualForm} onSubmit={submitBarcode}>
              <Input error={state === "invalid-barcode" ? copy.invalid : undefined} hint={copy.manualHint} inputMode="numeric" label={copy.manualLabel} maxLength={13} name="golden-barcode" onChange={(event) => setBarcode(event.currentTarget.value)} value={barcode} />
              <Button type="submit">{copy.manualSubmit}</Button>
            </form>
          ) : null}
          {state === "contribution-entry" ? (
            <form className={styles.manualForm} onSubmit={(event) => { event.preventDefault(); send("cancel"); }}>
              <Input hint={copy.contributionHint} label={copy.contributionLabel} name="golden-contribution" onChange={(event) => setContribution(event.currentTarget.value)} value={contribution} />
              <Button type="submit">{copy.contributionSubmit}</Button>
            </form>
          ) : null}

          <div className={styles.scannerActions}>
            {state === "not-requested" ? <><Button onClick={() => send("request")}>{copy.request}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button></> : null}
            {state === "permission-request" ? <><Button onClick={() => send("grant")}>{copy.allow}</Button><Button onClick={() => send("deny")} variant="secondary">{copy.deny}</Button><Button onClick={() => send("cancel")} variant="quiet">{copy.cancel}</Button></> : null}
            {state === "ready" ? <><Button onClick={() => send("assist")}>{copy.continue}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button></> : null}
            {state === "acquisition-assist" || state === "resumed" ? <Button onClick={() => send("recognize")}>{copy.recognize}</Button> : null}
            {state === "recognized" ? <><Button onClick={() => send("process")}>{copy.process}</Button><Button onClick={() => send("interrupt")} variant="secondary">{copy.cancel}</Button></> : null}
            {state === "processing" ? <Button onClick={() => send("interrupt")} variant="secondary">{copy.cancel}</Button> : null}
            {state === "interrupted" ? <><Button onClick={() => send("resume")}>{copy.resume}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button></> : null}
            {["permission-denied", "camera-unavailable", "offline"].includes(state) ? <><Button onClick={() => send("manual")}>{copy.manual}</Button><Button onClick={() => send("retry")} variant="secondary">{copy.retry}</Button></> : null}
            {["partial-match", "uncertain-match", "not-found"].includes(state) ? <><Button onClick={() => send("retry")}>{copy.retry}</Button><Button onClick={() => send("manual")} variant="secondary">{copy.manual}</Button><Button onClick={() => send("contribute")} variant="quiet">{copy.contribute}</Button></> : null}
            {state === "matched" ? <Button onClick={() => send("retry")}>{copy.rescan}</Button> : null}
            {(state === "manual-entry" || state === "invalid-barcode" || state === "contribution-entry") ? <Button onClick={() => send("cancel")} variant="quiet">{copy.cancel}</Button> : null}
          </div>
        </div>
      </section>

      {state === "matched" ? (
        <DecisionSummary copy={common} decision={copy.resultDecision} mainReason={copy.resultReason} nextAction={<a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/product?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=partial`}>{common.referenceNames.product}</a>} score={72} />
      ) : uncertain ? (
        <DecisionSummary confidence={common.unknown} confidenceReason={common.unknownInvariant} copy={common} decision={copy.resultDecision} mainReason={stateText} nextAction={<Button onClick={() => send("retry")}>{copy.retry}</Button>} score={null} />
      ) : null}
    </article>
  );
}

