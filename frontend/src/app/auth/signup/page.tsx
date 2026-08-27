// Server component wrapper — opts into dynamic rendering.

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { isPrivateBetaInviteOnly } from "@/lib/private-beta-admission";
import { Suspense } from "react";

import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen bg-background" />}>
      <SignupForm inviteOnly={isPrivateBetaInviteOnly()} />
    </Suspense>
  );
}
