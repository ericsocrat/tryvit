"use client";

import { useLivePublicAuth } from "@/components/layout/LivePublicAuthActions";
import Link from "next/link";

export function LandingLiveAuthAction({
  className,
  dashboardLabel,
  signedOutHref,
  signedOutLabel,
}: Readonly<{
  className?: string;
  dashboardLabel: string;
  signedOutHref: "/auth/login" | "/auth/signup";
  signedOutLabel: string;
}>) {
  const isAuthenticated = useLivePublicAuth();

  return (
    <Link className={className} href={isAuthenticated ? "/app" : signedOutHref}>
      {isAuthenticated ? dashboardLabel : signedOutLabel}
    </Link>
  );
}
