import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reading Polish Food Labels",
  description:
    "Read Polish food labels, compare values per 100 g or 100 ml and per portion, and understand common requirements and exemptions.",
};

export default function ReadingLabelsLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <>{children}</>;
}
