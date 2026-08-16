"use client";

import { useState } from "react";

import { Switch } from "@/design-system/primitives/Field";

export function CatalogSwitch({
  label,
  offLabel,
  onLabel,
  probe,
  defaultChecked = false,
}: Readonly<{
  label: string;
  offLabel: string;
  onLabel: string;
  probe: string;
  defaultChecked?: boolean;
}>) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <Switch
      checked={checked}
      data-catalog-probe={probe}
      label={label}
      onChange={(event) => setChecked(event.currentTarget.checked)}
      stateLabel={checked ? onLabel : offLabel}
    />
  );
}
