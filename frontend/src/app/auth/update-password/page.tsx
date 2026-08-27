import { Suspense } from "react";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appendAuthRedirect, sanitizeAuthRedirect } from "@/lib/validation";
import { redirect as nextRedirect } from "next/navigation";

import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

interface UpdatePasswordPageProps {
  readonly searchParams: Promise<{ readonly redirect?: string }>;
}

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const { redirect } = await searchParams;
  const safeRedirect = sanitizeAuthRedirect(redirect);
  let recoveryUser = null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    recoveryUser = error ? null : data.user;
  } catch {
    recoveryUser = null;
  }

  if (!recoveryUser) {
    nextRedirect(appendAuthRedirect("/auth/login?reason=expired", safeRedirect));
  }

  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen bg-background" />}>
      <UpdatePasswordForm redirect={safeRedirect} />
    </Suspense>
  );
}
