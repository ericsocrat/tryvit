"use client";

import { useState } from "react";

import { Button } from "@/design-system/primitives/Button/Button";

export function ButtonActivationProbe({
  label,
  resultLabel,
}: Readonly<{ label: string; resultLabel: string }>) {
  const [count, setCount] = useState(0);

  return (
    <div className="catalog-v2-activation-probe">
      <Button
        data-catalog-probe="button-primary"
        onClick={() => setCount((current) => current + 1)}
      >
        {label}
      </Button>
      <output
        aria-live="polite"
        className="catalog-v2-muted text-sm"
        data-catalog-probe="button-result"
        data-count={count}
      >
        {resultLabel}: {count}
      </output>
    </div>
  );
}
