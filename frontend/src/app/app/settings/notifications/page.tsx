"use client";

import { Button } from "@/components/common/Button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import surface from "@/components/layout/CustomerSurface.module.css";
import { deletePushSubscription } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { inspectCurrentPushSubscription, isPushSupported } from "@/lib/push-manager";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/** No new permission prompt while there is no supported notification service. */
export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "removing" | "removed">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState("loading");
    if (!isPushSupported()) { setState("ready"); return; }
    inspectCurrentPushSubscription().then((value) => {
      if (active) { setSubscription(value); setState("ready"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [attempt]);

  async function removeSubscription() {
    if (!subscription) return;
    setState("removing");
    try {
      const result = await deletePushSubscription(createClient(), subscription.endpoint);
      if (!result.ok || result.data.success !== true || result.data.error) throw new Error("Removal not confirmed");
      // Successful idempotent backend deletion may report deleted=false.
      if (!(await subscription.unsubscribe())) throw new Error("Browser removal not confirmed");
      setSubscription(null);
      setState("removed");
    } catch { setState("error"); }
  }

  return <AppPage className={surface.appPage}>
    <Breadcrumbs items={[{ labelKey: "nav.home", href: "/app" }, { labelKey: "nav.settings", href: "/app/settings" }, { labelKey: "notifications.title" }]} />
    <AppPageHeader eyebrow={t("nav.settings")} title={t("notifications.title")} description={t("evidenceActivity.notificationsPaused")} />
    <section className={surface.panel}>
      <h2 className="font-semibold">{t("evidenceActivity.notificationsPausedTitle")}</h2>
      <p className="mt-2 text-sm text-foreground-secondary">{t("evidenceActivity.notificationsPreserved")}</p>
      {state === "loading" && <p role="status" className="mt-3 text-sm">{t("common.loading")}</p>}
      {state === "error" && <div role="alert" className="mt-3 text-sm text-error-text">
        <p>{t("evidenceActivity.subscriptionUnavailable")}</p>
        <Button variant="secondary" className="mt-2" onClick={() => setAttempt((value) => value + 1)}>{t("common.retry")}</Button>
      </div>}
      {subscription && state !== "loading" && <Button className="mt-3" variant="secondary" disabled={state === "removing"} onClick={() => void removeSubscription()}>
        {state === "removing" ? t("common.loading") : t("evidenceActivity.removeSubscription")}
      </Button>}
      {state === "removed" && <p role="status" className="mt-3 text-sm">{t("notifications.disabled")}</p>}
    </section>
  </AppPage>;
}
