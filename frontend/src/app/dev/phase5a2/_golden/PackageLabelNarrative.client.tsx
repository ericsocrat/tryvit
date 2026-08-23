"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/design-system/primitives/Button/Button";

import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

export function PackageLabelNarrative({
  actionLabel,
  resetLabel,
  packageLabel,
  observedLabel,
  derivedLabel,
  decisionLabel,
  themeActionLabel,
  themeResetLabel,
}: Readonly<{
  actionLabel: string;
  resetLabel: string;
  packageLabel: string;
  observedLabel: string;
  derivedLabel: string;
  decisionLabel: string;
  themeActionLabel: string;
  themeResetLabel: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  const [darkPreview, setDarkPreview] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, []);
  return (
    <section
      className={styles.packageNarrative}
      data-expanded={expanded}
      data-golden-client="landing-narrative"
      ref={rootRef}
    >
      <div className={styles.packageSpecimen} aria-hidden="true">
        <span className={styles.packageFace}>NORTH<br />GRAIN</span>
        <span className={styles.packageFold} />
      </div>
      <ol className={styles.narrativeSteps} role="list">
        <li data-active="true"><GoldenGlyph name="source" /><span>{packageLabel}</span></li>
        <li data-active={expanded || undefined}><GoldenGlyph name="observed" /><span>{observedLabel}</span></li>
        <li data-active={expanded || undefined}><GoldenGlyph name="derived" /><span>{derivedLabel}</span></li>
        <li data-active={expanded || undefined}><GoldenGlyph name="decision" /><span>{decisionLabel}</span></li>
      </ol>
      <Button
        aria-pressed={expanded}
        onClick={() => setExpanded((value) => !value)}
        variant="secondary"
      >
        {expanded ? resetLabel : actionLabel}
      </Button>
      <Button
        onClick={() => {
          const goldenRoot = rootRef.current?.closest<HTMLElement>("[data-golden-reference]");
          const nextDark = !darkPreview;
          if (goldenRoot) goldenRoot.dataset.theme = nextDark ? "dark" : "light";
          setDarkPreview(nextDark);
        }}
        variant="quiet"
      >
        {darkPreview ? themeResetLabel : themeActionLabel}
      </Button>
    </section>
  );
}
