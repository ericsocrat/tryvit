import type { ReactNode } from "react";

import type { GoldenCommonCopy } from "./common-copy";
import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

export interface DecisionSummaryProps {
  readonly copy: GoldenCommonCopy;
  readonly decision: string;
  readonly score?: number | null;
  readonly provisionalScore?: number;
  readonly confidence?: string;
  readonly confidenceReason?: string;
  readonly mainReason: string;
  readonly nextAction: ReactNode;
  readonly className?: string;
}

export function DecisionSummary({
  copy,
  decision,
  score,
  provisionalScore,
  confidence = copy.confidenceValue,
  confidenceReason = copy.confidenceReason,
  mainReason,
  nextAction,
  className,
}: Readonly<DecisionSummaryProps>) {
  return (
    <section
      aria-label={copy.decision}
      className={[styles.decisionSummary, className].filter(Boolean).join(" ")}
      data-golden-decision-summary=""
    >
      <div className={styles.decisionLead}>
        <span className={styles.eyebrow}>{copy.decision}</span>
        <strong>{decision}</strong>
      </div>
      <div className={styles.decisionMetric}>
        <span className={styles.eyebrow}>{copy.score}</span>
        {typeof score === "number" ? (
          <strong className={styles.scoreValue}>{score}<small>/100</small></strong>
        ) : (
          <strong className={styles.unknownValue}>{copy.unknown}</strong>
        )}
        <small>{typeof score === "number" ? copy.scoreDerived : copy.unknownInvariant}</small>
        {typeof score !== "number" && typeof provisionalScore === "number" ? (
          <small className={styles.provisionalValue}>
            {copy.provisionalScore}: {provisionalScore}/100 · {copy.incomplete}
          </small>
        ) : null}
      </div>
      <div className={styles.decisionReason}>
        <span className={styles.eyebrow}>{copy.dataConfidence}</span>
        <strong>{confidence}</strong>
        <small>{confidenceReason}</small>
      </div>
      <div className={styles.decisionReason}>
        <span className={styles.eyebrow}>{copy.mainReason}</span>
        <strong>{mainReason}</strong>
      </div>
      <div className={styles.decisionAction}>
        <span className={styles.eyebrow}>{copy.nextAction}</span>
        {nextAction}
      </div>
    </section>
  );
}

export interface EvidenceBandProps {
  readonly kind: "observed" | "derived" | "context" | "decision" | "unknown";
  readonly label: string;
  readonly title: string;
  readonly detail: string;
  readonly meta?: string;
  readonly action?: ReactNode;
}

export function EvidenceBand({
  kind,
  label,
  title,
  detail,
  meta,
  action,
}: Readonly<EvidenceBandProps>) {
  return (
    <article className={styles.evidenceBand} data-evidence-kind={kind}>
      <div className={styles.evidenceKind}>
        <GoldenGlyph name={kind === "context" ? "context" : kind} />
        <span>{label}</span>
      </div>
      <div className={styles.evidenceCopy}>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      {meta ? <p className={styles.evidenceMeta}>{meta}</p> : null}
      {action ? <div className={styles.evidenceAction}>{action}</div> : null}
    </article>
  );
}

export function StateNotice({
  kind,
  title,
  detail,
  action,
}: Readonly<{
  kind: "info" | "warning" | "error" | "offline";
  title: string;
  detail: string;
  action?: ReactNode;
}>) {
  return (
    <aside aria-label={title} className={styles.stateNotice} data-state-kind={kind}>
      <GoldenGlyph name={kind === "error" ? "unknown" : "confidence"} />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {action ? <div className={styles.stateNoticeAction}>{action}</div> : null}
    </aside>
  );
}
