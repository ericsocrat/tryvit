"use client";

import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Illustration panel (desktop only) ─────────────────────── */}
      <div className="auth-illustration hidden flex-col items-center justify-center gap-8 p-10 lg:flex lg:w-1/2 lg:p-12 xl:p-14">
        <Logo variant="lockup" size={40} />
        <Image
          src="/illustrations/onboarding/step-1-welcome.svg"
          alt=""
          aria-hidden="true"
          width={280}
          height={280}
          className="w-full max-w-xs drop-shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
          priority
        />
        <p className="max-w-xs text-center text-sm font-medium leading-relaxed text-foreground-secondary">
          {t("auth.marketingBlurb")}
        </p>
      </div>

      {/* ── Form panel ────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
