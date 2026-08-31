import type { Metadata } from "next";

import { TurnstileAttestation } from "./TurnstileAttestation.client";

export const metadata: Metadata = {
  title: "Turnstile Attestation | TryVit",
  robots: { index: false, follow: false },
};

export default function TurnstileAttestationPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-4 py-6"
      data-route-id="admin-turnstile-attestation"
    >
      <section className="rounded-2xl border border-border/70 bg-surface/95 p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Temporary production security attestation
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          Turnstile first-use and replay proof
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">
          This unlinked, admin-only surface verifies one production challenge through
          TryVit&apos;s existing backend. It cannot create an account or write product data.
        </p>

        <TurnstileAttestation />
      </section>
    </main>
  );
}
