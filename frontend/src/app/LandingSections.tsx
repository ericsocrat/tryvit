import type { SupportedLanguage } from "@/stores/language-store";
import { getLandingCopy, type LandingCopy } from "./_landing-v2/copy";
import {
  LandingGlyph,
  LandingLockup,
  LandingMark,
  type LandingGlyphName,
} from "./_landing-v2/LandingIdentity";
import { LandingLiveAuthAction } from "./_landing-v2/LandingLiveAuthAction.client";
import { PackageLabelNarrative } from "./_landing-v2/PackageLabelNarrative";
import styles from "./_landing-v2/landing.module.css";

function StatusBand({ copy }: Readonly<{ copy: LandingCopy }>) {
  return (
    <section aria-labelledby="service-status-heading" className={styles.statusBand} id="service-status">
      <div>
        <p className={styles.eyebrow}>{copy.statusEyebrow}</p>
        <h2 id="service-status-heading">{copy.statusTitle}</h2>
        <p>{copy.statusBody}</p>
      </div>
      <dl>
        <div>
          <dt>{copy.siteStatus}</dt>
          <dd>{copy.siteAvailable}</dd>
        </div>
        <div>
          <dt>{copy.dataStatus}</dt>
          <dd>{copy.dataPaused}</dd>
        </div>
      </dl>
    </section>
  );
}

function Hero({ dataAvailable, copy }: Readonly<{ dataAvailable: boolean; copy: LandingCopy }>) {
  return (
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.heroCopy}>
        <div className={styles.surfaceOwner}>
          <LandingLockup />
          <span>{copy.identityLabel}</span>
        </div>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 id="landing-title">{copy.title}</h1>
        <p className={styles.heroIntro}>{dataAvailable ? copy.liveIntro : copy.demoIntro}</p>
        <div className={styles.heroActions}>
          <a className={styles.primaryAction} href="#evidence">
            {copy.primary}
          </a>
          {dataAvailable ? (
            <LandingLiveAuthAction
              className={styles.secondaryAction}
              dashboardLabel={copy.navigation.dashboard}
              signedOutHref="/auth/signup"
              signedOutLabel={copy.secondary}
            />
          ) : (
            <a className={styles.secondaryAction} href="/contact">
              {copy.navigation.contact}
            </a>
          )}
        </div>
      </div>
      <div aria-hidden="true" className={styles.heroWatermark}>
        <LandingMark size={80} />
      </div>
      <PackageLabelNarrative
        actionLabel={copy.decode}
        contextualLabel={copy.contextual}
        decisionLabel={copy.decision}
        derivedLabel={copy.derived}
        observedLabel={copy.observed}
        packageLabel={copy.package}
        packageName={copy.packageName}
        resetLabel={copy.reset}
        syntheticLabel={copy.synthetic}
      />
    </section>
  );
}

interface EvidenceRowProps {
  readonly kind: LandingGlyphName;
  readonly label: string;
  readonly title: string;
  readonly detail: string;
  readonly meta: string;
}

function EvidenceRow({ kind, label, title, detail, meta }: EvidenceRowProps) {
  return (
    <article className={styles.evidenceRow} data-evidence-kind={kind}>
      <div className={styles.evidenceKind}>
        <LandingGlyph name={kind} />
        <span>{label}</span>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <p className={styles.evidenceMeta}>{meta}</p>
    </article>
  );
}

function EvidenceSection({ copy }: Readonly<{ copy: LandingCopy }>) {
  return (
    <section aria-labelledby="evidence-title" className={styles.editorialSection} id="evidence">
      <header className={styles.sectionHeading}>
        <p className={styles.eyebrow}>01 · {copy.navigation.evidence}</p>
        <h2 id="evidence-title">{copy.evidenceTitle}</h2>
        <p className={styles.editorialLead}>{copy.evidenceIntro}</p>
      </header>
      <div className={styles.evidenceSpine}>
        <EvidenceRow kind="observed" label={copy.observed} title={copy.observed} detail={copy.observedDetail} meta={copy.observedMeta} />
        <EvidenceRow kind="derived" label={copy.derived} title={copy.derived} detail={copy.derivedDetail} meta={copy.derivedMeta} />
        <EvidenceRow kind="context" label={copy.contextual} title={copy.contextual} detail={copy.contextDetail} meta={copy.contextMeta} />
        <EvidenceRow kind="decision" label={copy.decision} title={copy.decision} detail={copy.decisionDetail} meta={copy.decisionMeta} />
      </div>
    </section>
  );
}

function Principles({ copy }: Readonly<{ copy: LandingCopy }>) {
  const principles = [
    { id: "method", number: "02", glyph: "derived" as const, title: copy.methodTitle, body: copy.methodBody },
    { id: "labels", number: "03", glyph: "context" as const, title: copy.marketTitle, body: copy.marketBody },
    { id: "trust", number: "04", glyph: "confidence" as const, title: copy.privacyTitle, body: copy.privacyBody },
  ];

  return (
    <section aria-label={copy.navigation.method} className={styles.principles}>
      {principles.map((principle) => (
        <article id={principle.id} key={principle.number}>
          <LandingGlyph name={principle.glyph} />
          <p className={styles.eyebrow}>{principle.number}</p>
          <h2>{principle.title}</h2>
          <p>{principle.body}</p>
        </article>
      ))}
    </section>
  );
}

function FinalAction({ dataAvailable, copy }: Readonly<{ dataAvailable: boolean; copy: LandingCopy }>) {
  return (
    <section aria-labelledby="landing-final-title" className={styles.finalAction}>
      <div>
        <p className={styles.eyebrow}>05 · {copy.finalEyebrow}</p>
        <h2 id="landing-final-title">{copy.finalTitle}</h2>
        <p>{copy.finalBody}</p>
      </div>
      <div className={styles.finalActions}>
        <a className={styles.primaryAction} href="#method">
          {copy.finalPrimary}
        </a>
        {dataAvailable ? (
          <LandingLiveAuthAction
            className={styles.secondaryAction}
            dashboardLabel={copy.navigation.dashboard}
            signedOutHref="/auth/login"
            signedOutLabel={copy.finalSecondary}
          />
        ) : (
          <a className={styles.secondaryAction} href="/contact">
            {copy.navigation.contact}
          </a>
        )}
      </div>
    </section>
  );
}

export function LandingSections({
  dataAvailable = true,
  language,
}: Readonly<{ dataAvailable?: boolean; language: SupportedLanguage }>) {
  const copy = getLandingCopy(language);

  return (
    <>
      <Hero copy={copy} dataAvailable={dataAvailable} />
      {!dataAvailable ? <StatusBand copy={copy} /> : null}
      <EvidenceSection copy={copy} />
      <Principles copy={copy} />
      <FinalAction copy={copy} dataAvailable={dataAvailable} />
    </>
  );
}
