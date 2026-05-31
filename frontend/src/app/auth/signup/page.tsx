// Server component wrapper — opts into dynamic rendering.

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Suspense } from "react";

import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen bg-background" />}>
      <SignupForm />
    </Suspense>
  );
}
