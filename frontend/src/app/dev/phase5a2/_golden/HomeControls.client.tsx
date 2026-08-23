"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/design-system/primitives/Button/Button";
import { Menu } from "@/design-system/primitives/Menu";

import styles from "./golden.module.css";

export function HomeControls({
  resumeLabel,
  menuLabel,
  saveLabel,
  hideLabel,
  resumedMessage,
  savedMessage,
}: Readonly<{
  resumeLabel: string;
  menuLabel: string;
  saveLabel: string;
  hideLabel: string;
  resumedMessage: string;
  savedMessage: string;
}>) {
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, []);
  const entries = useMemo(() => [
    {
      id: "resume-record",
      label: resumeLabel,
      textValue: resumeLabel,
      onSelect: () => setMessage(resumedMessage),
    },
    {
      id: "save-record",
      label: saveLabel,
      textValue: saveLabel,
      onSelect: () => setMessage(savedMessage),
    },
    {
      id: "hide-record",
      label: hideLabel,
      textValue: hideLabel,
      onSelect: () => setMessage(""),
    },
  ], [hideLabel, resumeLabel, resumedMessage, saveLabel, savedMessage]);
  return (
    <div
      className={styles.homeControls}
      data-golden-client="home-controls"
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape") return;
        const trigger = rootRef.current?.querySelector<HTMLButtonElement>(
          "button[aria-haspopup='menu']",
        );
        window.setTimeout(() => trigger?.focus(), 0);
      }}
      ref={rootRef}
    >
      <Button onClick={() => setMessage(resumedMessage)}>{resumeLabel}</Button>
      <Menu entries={entries} triggerLabel={menuLabel} />
      <div aria-atomic="true" aria-live="polite" className={styles.homeLive} role="status">
        {message}
      </div>
    </div>
  );
}
