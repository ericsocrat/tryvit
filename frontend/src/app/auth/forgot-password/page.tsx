import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { sanitizeAuthRedirect } from "@/lib/validation";
import { Suspense } from "react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

interface ForgotPasswordPageProps {
  readonly searchParams: Promise<{ readonly redirect?: string }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { redirect } = await searchParams;

  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen bg-background" />}>
      <ForgotPasswordForm redirect={sanitizeAuthRedirect(redirect)} />
    </Suspense>
  );
}
