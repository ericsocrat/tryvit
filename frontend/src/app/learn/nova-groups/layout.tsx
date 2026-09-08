import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "NOVA Food Classification",
  description:
    "Understand NOVA processing groups 1–4, their classification criteria, and why a group is not an individual health-risk assessment.",
};

export default function NovaGroupsLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <>{children}</>;
}
