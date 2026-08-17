import {
  PHASE5A2_CANDIDATES,
  PHASE5A2_LOCALES,
  PHASE5A2_MOTION_MODES,
  PHASE5A2_SURFACES,
  PHASE5A2_THEMES,
  phase5A2ReviewHref,
  type Phase5A2RouteState,
} from "./contract";

import styles from "./review-frame.module.css";

const CANDIDATE_LABELS = {
  "source-fold": "Candidate A",
  "evidence-register": "Candidate B",
  "open-core": "Candidate C",
} as const;

export function ReviewFrame({
  route,
  children,
}: Readonly<{
  route: Phase5A2RouteState;
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.environment} data-phase5a2-capture={route.capture || undefined}>
      {!route.capture ? (
        <aside className={styles.controls} data-phase5a2-review-controls="">
          <div className={styles.controlHeading}>
            <p>Phase 5A.2 · Checkpoint 1</p>
            <strong>{CANDIDATE_LABELS[route.candidate]}</strong>
            <span>Synthetic review fixture · non-production</span>
          </div>
          <nav aria-label="Direction review controls" className={styles.controlGroups}>
            <div>
              <span>Direction</span>
              {PHASE5A2_CANDIDATES.map((candidate) => (
                <a
                  aria-current={candidate === route.candidate ? "page" : undefined}
                  href={phase5A2ReviewHref(
                    candidate,
                    route.surface,
                    route.locale,
                    route.theme,
                    route.motion,
                    route.state,
                  )}
                  key={candidate}
                >
                  {CANDIDATE_LABELS[candidate]}
                </a>
              ))}
            </div>
            <div>
              <span>Surface</span>
              {PHASE5A2_SURFACES.map((surface) => (
                <a
                  aria-current={surface === route.surface ? "page" : undefined}
                  href={phase5A2ReviewHref(
                    route.candidate,
                    surface,
                    route.locale,
                    route.theme,
                    route.motion,
                  )}
                  key={surface}
                >
                  {surface}
                </a>
              ))}
            </div>
            <div>
              <span>Locale</span>
              {PHASE5A2_LOCALES.map((locale) => (
                <a
                  aria-current={locale === route.locale ? "page" : undefined}
                  href={phase5A2ReviewHref(
                    route.candidate,
                    route.surface,
                    locale,
                    route.theme,
                    route.motion,
                    route.state,
                  )}
                  key={locale}
                >
                  {locale.toUpperCase()}
                </a>
              ))}
            </div>
            <div>
              <span>Theme</span>
              {PHASE5A2_THEMES.map((theme) => (
                <a
                  aria-current={theme === route.theme ? "page" : undefined}
                  href={phase5A2ReviewHref(
                    route.candidate,
                    route.surface,
                    route.locale,
                    theme,
                    route.motion,
                    route.state,
                  )}
                  key={theme}
                >
                  {theme}
                </a>
              ))}
            </div>
            <div>
              <span>Motion</span>
              {PHASE5A2_MOTION_MODES.map((motion) => (
                <a
                  aria-current={motion === route.motion ? "page" : undefined}
                  href={phase5A2ReviewHref(
                    route.candidate,
                    route.surface,
                    route.locale,
                    route.theme,
                    motion,
                    route.state,
                  )}
                  key={motion}
                >
                  {motion === "full" ? "Full" : "Reduced"}
                </a>
              ))}
            </div>
          </nav>
        </aside>
      ) : null}
      {children}
    </div>
  );
}
