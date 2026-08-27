// Server component wrapper — opts into dynamic rendering so
// createClient() in the client component doesn't run during SSG.

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { getAuthCapabilities } from "@/lib/auth-capabilities";
import { isPrivateBetaInviteOnly } from "@/lib/private-beta-admission";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const capabilities = await getAuthCapabilities();

  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen bg-background" />}>
      <LoginForm
        capabilities={capabilities}
        inviteOnly={isPrivateBetaInviteOnly()}
      />
    </Suspense>
  );
}
