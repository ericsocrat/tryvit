"use client";

import { ButtonLink } from "@/components/common/Button";
import { ChevronRight } from "lucide-react";

import { useLivePublicAuth } from "./LivePublicAuthState";

export { LivePublicAuthProvider, useLivePublicAuth } from "./LivePublicAuthState";

export function LiveHeaderAuthAction({
  signInLabel,
  dashboardLabel,
}: {
  readonly signInLabel: string;
  readonly dashboardLabel: string;
}) {
  const isAuthenticated = useLivePublicAuth();

  return (
    <ButtonLink href={isAuthenticated ? "/app" : "/auth/login"}>
      {isAuthenticated ? dashboardLabel : signInLabel}
    </ButtonLink>
  );
}

export function LiveLandingAuthActions({
  placement,
  getStartedLabel,
  signInLabel,
  dashboardLabel,
}: {
  readonly placement: "hero" | "closing";
  readonly getStartedLabel: string;
  readonly signInLabel: string;
  readonly dashboardLabel: string;
}) {
  const isAuthenticated = useLivePublicAuth();
  const padding = placement === "hero" ? "px-8" : "px-10";

  if (isAuthenticated) {
    return (
      <ButtonLink
        href="/app"
        size="lg"
        className={`w-full ${padding} sm:w-auto`}
        iconRight={<ChevronRight size={18} aria-hidden="true" />}
      >
        {dashboardLabel}
      </ButtonLink>
    );
  }

  return (
    <>
      <ButtonLink
        href="/auth/signup"
        size="lg"
        className={`w-full ${padding} sm:w-auto`}
        iconRight={<ChevronRight size={18} aria-hidden="true" />}
      >
        {getStartedLabel}
      </ButtonLink>
      <ButtonLink
        href="/auth/login"
        variant="secondary"
        size="lg"
        className={`w-full ${padding} sm:w-auto`}
      >
        {signInLabel}
      </ButtonLink>
    </>
  );
}
