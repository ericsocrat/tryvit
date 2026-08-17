"use client";

import { useState } from "react";

import { Combobox, type ComboboxOption } from "@/design-system/primitives/Combobox";

export interface ProductLookupCopy {
  readonly label: string;
  readonly hint: string;
  readonly placeholder: string;
  readonly empty: string;
  readonly loading: string;
  readonly results: string;
}

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

function filterProductLookup(option: ComboboxOption, rawQuery: string): boolean {
  const query = normalizeLookupValue(rawQuery);
  if (!query) return true;
  return (
    normalizeLookupValue(option.label).includes(query) ||
    normalizeLookupValue(option.description ?? "").includes(query)
  );
}

export function ProductLookup({
  className,
  copy,
  ean,
  fixtureName,
}: Readonly<{
  className?: string;
  copy: ProductLookupCopy;
  ean: string;
  fixtureName: string;
}>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);

  return (
    <Combobox
      className={className}
      emptyMessage={copy.empty}
      filterOption={filterProductLookup}
      hint={copy.hint}
      label={copy.label}
      loadingMessage={copy.loading}
      onOpenChange={setOpen}
      onValueChange={setValue}
      open={open}
      options={[
        {
          value: "north-grain-oat-drink",
          label: fixtureName,
          description: ean,
        },
      ]}
      placeholder={copy.placeholder}
      resultsMessage={(count) => copy.results.replace("{count}", String(count))}
      value={value}
    />
  );
}
