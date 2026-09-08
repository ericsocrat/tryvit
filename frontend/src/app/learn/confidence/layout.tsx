import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Understanding product evidence",
  description:
    "Distinguish source-recorded facts, unverified catalog values, missing information and the limits of freshness dates.",
};

export default function ConfidenceLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <>{children}</>;
}
