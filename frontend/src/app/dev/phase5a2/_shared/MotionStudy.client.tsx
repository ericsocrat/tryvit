"use client";

import { useState } from "react";

import { Button } from "@/design-system/primitives/Button/Button";

export interface MotionStudyCopy {
  readonly stages: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
  }[];
  readonly previous: string;
  readonly next: string;
  readonly restart: string;
}

export function MotionStudy({
  className,
  copy,
  direction,
  initialStage,
  motionMode,
}: Readonly<{
  className: string;
  copy: MotionStudyCopy;
  direction: string;
  initialStage: number;
  motionMode: "full" | "reduced";
}>) {
  const [activeStage, setActiveStage] = useState(initialStage);
  const maximumStage = copy.stages.length - 1;

  return (
    <section
      aria-labelledby={`${direction}-motion-heading`}
      className={className}
      data-phase5a2-direction={direction}
      data-phase5a2-motion={motionMode}
      data-phase5a2-motion-stage={copy.stages[activeStage]?.id}
    >
      <h2
        aria-atomic="true"
        aria-live="polite"
        id={`${direction}-motion-heading`}
      >
        {copy.stages[activeStage]?.label}
      </h2>
      <ol className="phase5a2-motion-stages">
        {copy.stages.map((stage, index) => (
          <li
            aria-current={index === activeStage ? "step" : undefined}
            className="phase5a2-motion-stage"
            data-active={index === activeStage}
            key={stage.id}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{stage.label}</strong>
              <p>{stage.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="phase5a2-motion-actions">
        <Button
          disabled={activeStage === 0}
          onClick={() => setActiveStage((current) => Math.max(0, current - 1))}
          variant="secondary"
        >
          {copy.previous}
        </Button>
        <Button
          onClick={() => setActiveStage((current) => current >= maximumStage ? 0 : current + 1)}
        >
          {copy.next}
        </Button>
        <Button onClick={() => setActiveStage(0)} variant="quiet">
          {copy.restart}
        </Button>
      </div>
    </section>
  );
}
