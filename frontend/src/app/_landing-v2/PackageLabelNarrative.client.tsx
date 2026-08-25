"use client";

import { useState, useSyncExternalStore } from "react";

import styles from "./landing.module.css";

interface PackageLabelNarrativeProps {
  readonly actionLabel: string;
  readonly resetLabel: string;
  readonly packageLabel: string;
  readonly observedLabel: string;
  readonly derivedLabel: string;
  readonly contextualLabel: string;
  readonly decisionLabel: string;
  readonly packageName: string;
  readonly syntheticLabel: string;
}

const emptySubscribe = () => () => {};
const getMountedSnapshot = () => globalThis.window !== undefined;
const getMountedServerSnapshot = () => false;

export function PackageLabelNarrative({
  actionLabel,
  resetLabel,
  packageLabel,
  observedLabel,
  derivedLabel,
  contextualLabel,
  decisionLabel,
  packageName,
  syntheticLabel,
}: PackageLabelNarrativeProps) {
  const [expanded, setExpanded] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );

  return (
    <section
      aria-label={actionLabel}
      className={styles.packageNarrative}
      data-expanded={expanded ? "true" : "false"}
    >
      <div className={styles.packageSpecimen} aria-hidden="true">
        <span className={styles.packageFold} />
        <span className={styles.packageFace}>TryVit<br />{packageName}</span>
        <span className={styles.packageSynthetic}>{syntheticLabel}</span>
      </div>
      <ol className={styles.narrativeSteps}>
        {[packageLabel, observedLabel, derivedLabel, contextualLabel, decisionLabel].map(
          (step, index) => (
            <li data-active={expanded || index === 0 ? "true" : undefined} key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ),
        )}
      </ol>
      <button
        aria-expanded={expanded}
        className={styles.narrativeButton}
        disabled={!mounted}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? resetLabel : actionLabel}
      </button>
    </section>
  );
}
