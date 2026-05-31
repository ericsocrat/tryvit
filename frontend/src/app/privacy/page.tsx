"use client";

// ─── Privacy policy ──────────────────────────────────────────────────────────

import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { useTranslation } from "@/lib/i18n";
import { Camera, Eye, ShieldCheck, Smartphone, Trash2 } from "lucide-react";

export default function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <LegalPageShell
      title={t("legal.privacyTitle")}
      intro="A concise summary of what we collect, why we collect it, and how image processing stays on your device."
      updatedText={t("legal.lastUpdated")}
    >
      <section className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {t("legal.dataWeCollect")}
        </h2>
        <p className="mt-3 leading-7 text-foreground-secondary">
          {t("legal.dataWeCollectText")}
        </p>
      </section>

      <section className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {t("legal.howWeUse")}
        </h2>
        <p className="mt-3 leading-7 text-foreground-secondary">
          {t("legal.howWeUseText")}
        </p>
      </section>

      <section className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {t("legal.dataStorage")}
        </h2>
        <p className="mt-3 leading-7 text-foreground-secondary">
          {t("legal.dataStorageText")}
        </p>
      </section>

      <section className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {t("legal.imageProcessing")}
        </h2>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl bg-surface-subtle/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              {t("legal.imageWhatWeProcess")}
            </h3>
            <p className="leading-7 text-foreground-secondary">
              {t("legal.imageWhatWeProcessText")}
            </p>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                {t("legal.imageHowWeProcess")}
              </h3>
              <ul className="space-y-3 text-sm leading-6 text-foreground-secondary">
                {(
                  [
                    { icon: Smartphone, key: "legal.imageOnDevice" },
                    { icon: ShieldCheck, key: "legal.imageNeverUploaded" },
                    { icon: Trash2, key: "legal.imageNotStored" },
                    { icon: Eye, key: "legal.imageOnlyText" },
                  ] as const
                ).map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-full bg-brand/10 p-1.5 text-brand">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-brand/15 bg-brand/5 p-5 dark:bg-brand/10">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              {t("legal.imageCamera")}
            </h3>
            <p className="flex items-start gap-3 leading-7 text-foreground-secondary">
              <span className="mt-0.5 rounded-full bg-brand/10 p-1.5 text-brand">
                <Camera size={14} aria-hidden="true" />
              </span>
              <span>{t("legal.imageCameraText")}</span>
            </p>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                {t("legal.imageDataCollected")}
              </h3>
              <p className="leading-7 text-foreground-secondary">
                {t("legal.imageDataCollectedText")}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                {t("legal.imageLegalBasis")}
              </h3>
              <p className="leading-7 text-foreground-secondary">
                {t("legal.imageLegalBasisText")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t("legal.yourRights")}
          </h2>
          <p className="mt-3 leading-7 text-foreground-secondary">
            {t("legal.yourRightsText")}
          </p>
        </div>

        <div className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t("legal.contactSection")}
          </h2>
          <p className="mt-3 leading-7 text-foreground-secondary">
            {t("legal.contactText")}
          </p>
        </div>
      </section>
    </LegalPageShell>
  );
}
