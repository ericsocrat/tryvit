import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Why the TryVit score is retired",
  description:
    "Understand why TryVit uses recorded facts and their limitations instead of an unsupported overall health grade.",
};

export default function TryVitScoreLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <>{children}</>;
}
