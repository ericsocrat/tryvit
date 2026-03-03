// ─── Onboarding layout ───────────────────────────────────────────────────────
// Minimal chrome for the onboarding wizard.

import { Logo } from "@/components/common/Logo";
import { SkipLink } from "@/components/common/SkipLink";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <SkipLink />
      <header className="border-b border bg-surface">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-center px-4">
          <span className="text-lg font-bold text-brand">
            <Logo variant="lockup" size={28} />
          </span>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
