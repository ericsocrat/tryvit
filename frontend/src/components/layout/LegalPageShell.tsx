"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import type { ReactNode } from "react";

interface LegalPageShellProps {
  readonly title: string;
  readonly intro: string;
  readonly updatedText: string;
  readonly children: ReactNode;
}

export function LegalPageShell(props: Readonly<LegalPageShellProps>) {
  const { title, intro, updatedText, children } = props;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(22,163,74,0.08),transparent_42%),linear-gradient(to_bottom,rgba(248,250,252,0.92),rgba(241,245,249,0.72))] dark:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_42%),linear-gradient(to_bottom,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
      <Header />

      <main id="main-content" className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <article className="w-full max-w-4xl overflow-hidden rounded-4xl border border-border/70 bg-surface/95 shadow-[0_24px_72px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-surface/95 dark:shadow-[0_24px_72px_rgba(0,0,0,0.35)]">
          <header className="border-b border-border/60 px-6 py-8 sm:px-10 sm:py-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
              Legal
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-secondary sm:text-lg">
              {intro}
            </p>
            <p className="mt-4 inline-flex rounded-full border border-border/60 bg-surface-subtle/80 px-3 py-1 text-xs font-medium tracking-wide text-foreground-secondary sm:text-sm">
              {updatedText}
            </p>
          </header>

          <div className="grid gap-6 px-6 py-8 sm:px-10 sm:py-10">
            {children}
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
