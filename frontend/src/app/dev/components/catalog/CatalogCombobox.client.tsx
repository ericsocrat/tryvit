"use client";

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
  const options = optionLabels.map((optionLabel, index) => ({
    value: `evidence-source-${index + 1}`,
    label: optionLabel,
  }));
  const stateLabel = state === "loading"
    ? loadingMessage
    : state === "empty"
      ? emptyMessage
      : state === "error"
        ? loadError
        : resultsMessage.replace("{count}", String(options.length));

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
        options={state === "empty" ? [] : options}
        placeholder={placeholder}
        resultsMessage={(count) => resultsMessage.replace("{count}", String(count))}
      />
    </div>
  );
}
