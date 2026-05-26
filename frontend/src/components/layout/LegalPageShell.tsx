"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import type { ReactNode } from "react";

interface LegalPageShellProps {
  title: string;
  intro: string;
  updatedText: string;
  children: ReactNode;
}

export function LegalPageShell({
  title,
  intro,
  updatedText,
  children,
}: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(22,163,74,0.08),_transparent_42%),linear-gradient(to_bottom,_rgba(248,250,252,0.92),_rgba(241,245,249,0.72))] dark:bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_42%),linear-gradient(to_bottom,_rgba(15,23,42,0.98),_rgba(15,23,42,0.92))]">
      <Header />

      <main id="main-content" className="flex flex-1 justify-center px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <article className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-strong/40 bg-surface shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <header className="border-b border-strong/20 px-6 py-8 sm:px-10 sm:py-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
              Legal
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-secondary sm:text-lg">
              {intro}
            </p>
            <p className="mt-4 text-sm text-foreground-secondary">
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