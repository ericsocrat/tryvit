"use client";

import { useState } from "react";

import { Combobox } from "@/design-system/primitives/Combobox";

export type CatalogComboboxState = "ready" | "loading" | "empty" | "error";

interface CatalogComboboxProps {
  readonly state: CatalogComboboxState;
  readonly label: string;
  readonly hint: string;
  readonly placeholder: string;
  readonly optionLabels: readonly [string, string, string];
  readonly loadingMessage: string;
  readonly emptyMessage: string;
  readonly loadError: string;
  readonly resultsMessage: string;
}

export function CatalogCombobox({
  state,
  label,
  hint,
  placeholder,
  optionLabels,
  loadingMessage,
  emptyMessage,
  loadError,
  resultsMessage,
}: Readonly<CatalogComboboxProps>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const options = optionLabels.map((optionLabel, index) => ({
    value: `evidence-source-${index + 1}`,
    label: optionLabel,
  }));
  let stateLabel = resultsMessage.replace("{count}", String(options.length));
  if (state === "loading") stateLabel = loadingMessage;
  if (state === "empty") stateLabel = emptyMessage;
  if (state === "error") stateLabel = loadError;

  return (
    <div className="space-y-1" data-catalog-probe={`combobox-${state}`}>
      <p className="catalog-v2-row-label text-sm font-medium">{stateLabel}</p>
      <Combobox
        emptyMessage={emptyMessage}
        hint={hint}
        label={label}
        loadError={state === "error" ? loadError : undefined}
        loading={state === "loading"}
        loadingMessage={loadingMessage}
        onOpenChange={setOpen}
        onValueChange={setValue}
        open={open}
        options={state === "empty" ? [] : options}
        placeholder={placeholder}
        resultsMessage={(count) => resultsMessage.replace("{count}", String(count))}
        value={value}
      />
    </div>
  );
}
