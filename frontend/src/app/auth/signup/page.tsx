// Server component wrapper — opts into dynamic rendering.

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { getAuthCapabilities } from "@/lib/auth-capabilities";
import {
  isNativeSignupCaptchaEnabled,
  isPrivateBetaInviteOnly,
} from "@/lib/private-beta-admission";
import { isTurnstileConfigured } from "@/lib/turnstile";
import { sanitizeAuthRedirect } from "@/lib/validation";
import { Suspense } from "react";

import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

interface SignupPageProps {
  readonly searchParams: Promise<{ readonly redirect?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { redirect } = await searchParams;
  const presentationInviteOnly = isPrivateBetaInviteOnly();
  let inviteOnly = true;
  if (!presentationInviteOnly) {
    const capabilities = await getAuthCapabilities();
    inviteOnly =
      capabilities.status !== "ready" ||
      capabilities.signupDisabled ||
      !capabilities.email ||
      !isTurnstileConfigured() ||
      !isNativeSignupCaptchaEnabled();
  }

  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen bg-background" />}>
      <SignupForm
        inviteOnly={inviteOnly}
        redirect={sanitizeAuthRedirect(redirect)}
      />
    </Suspense>
  );
}
