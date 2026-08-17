import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phase 5A.2 direction selection",
  description: "Guarded TryVit art-direction and identity review environment.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function Phase5A2Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
