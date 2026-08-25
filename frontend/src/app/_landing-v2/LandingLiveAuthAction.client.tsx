"use client";

import { useLivePublicAuth } from "@/components/layout/LivePublicAuthActions";

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
    <a className={className} href={isAuthenticated ? "/app" : signedOutHref}>
      {isAuthenticated ? dashboardLabel : signedOutLabel}
    </a>
  );
}
