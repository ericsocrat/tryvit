"use client";

import { PublicUtilityShell } from "@/components/layout/PublicUtilityShell";
import type { ReactNode } from "react";

interface LegalPageShellProps {
  readonly title: string;
  readonly intro: string;
  readonly updatedText: string;
  readonly children: ReactNode;
}

export function LegalPageShell(props: Readonly<LegalPageShellProps>) {
  const { title, intro, updatedText, children } = props;

  return (
    <PublicUtilityShell
      title={title}
      description={intro}
      register={<span>{updatedText}</span>}
    >
      {children}
    </PublicUtilityShell>
  );
}
