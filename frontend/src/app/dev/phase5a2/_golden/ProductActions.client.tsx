"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Menu } from "@/design-system/primitives/Menu";
import { Dialog } from "@/design-system/primitives/Overlay";

import styles from "./golden.module.css";

export function ProductActions({
  provenanceLabel,
  provenanceTitle,
  provenanceDescription,
  provenanceBody,
  closeLabel,
  compareLabel,
  addCompareLabel,
  openAlternativeLabel,
  savedMessage,
  fixtureLabel,
  observedLabel,
  methodLabel,
  checksLabel,
  noChecksLabel,
}: Readonly<{
  provenanceLabel: string;
  provenanceTitle: string;
  provenanceDescription: string;
  provenanceBody: string;
  closeLabel: string;
  compareLabel: string;
  addCompareLabel: string;
  openAlternativeLabel: string;
  savedMessage: string;
  fixtureLabel: string;
  observedLabel: string;
  methodLabel: string;
  checksLabel: string;
  noChecksLabel: string;
}>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, []);
  const entries = useMemo(() => [
    {
      id: "add-compare",
      label: addCompareLabel,
      textValue: addCompareLabel,
      onSelect: () => setMessage(savedMessage),
    },
    {
      id: "open-alternative",
      label: openAlternativeLabel,
      textValue: openAlternativeLabel,
      onSelect: () => setMessage(openAlternativeLabel),
    },
  ], [addCompareLabel, openAlternativeLabel, savedMessage]);
  return (
    <div className={styles.productActions} data-golden-client="product-actions" ref={rootRef}>
      <Button onClick={() => setDialogOpen(true)} variant="secondary">{provenanceLabel}</Button>
      <Menu entries={entries} triggerLabel={compareLabel} />
      <span aria-atomic="true" aria-live="polite" role="status">{message}</span>
      <Dialog
        closeLabel={closeLabel}
        description={provenanceDescription}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={provenanceTitle}
      >
        <p>{provenanceBody}</p>
        <dl className={styles.provenanceList}>
          <div><dt>{fixtureLabel}</dt><dd>north-grain-oat-drink</dd></div>
          <div><dt>{observedLabel}</dt><dd>2026-07-14</dd></div>
          <div><dt>{methodLabel}</dt><dd>review-v0.9</dd></div>
          <div><dt>{checksLabel}</dt><dd>{noChecksLabel}</dd></div>
        </dl>
      </Dialog>
    </div>
  );
}
