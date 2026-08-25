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
  return (
    <details aria-label={packageLabel} className={styles.packageNarrative}>
      <summary className={styles.narrativeSummary}>
        <div className={styles.packageSpecimen} aria-hidden="true">
          <span className={styles.packageFold} />
          <span className={styles.packageFace}>
            TryVit
            <br />
            {packageName}
          </span>
          <span className={styles.packageSynthetic}>{syntheticLabel}</span>
        </div>
        <span className={styles.narrativePreview}>
          <span aria-hidden="true" className={styles.narrativeSource}>
            <span>01</span>
            <span>{packageLabel}</span>
          </span>
          <span className={styles.narrativeButton}>
            <span className={styles.narrativeClosedLabel}>{actionLabel}</span>
            <span className={styles.narrativeOpenLabel}>{resetLabel}</span>
          </span>
        </span>
      </summary>
      <ol className={styles.narrativeSteps}>
        {[observedLabel, derivedLabel, contextualLabel, decisionLabel].map((step, index) => (
          <li key={step}>
            <span>{String(index + 2).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
