import type { LandingCopy } from "./copy";
import { LandingGlyph } from "./LandingIdentity";
import styles from "./landing.module.css";

/** Server-rendered illustration using the explicitly synthetic landing example. */
export function LandingProductPreview({ copy }: Readonly<{ copy: LandingCopy }>) {
  return (
    <figure className={styles.productPreview} aria-labelledby="landing-preview-caption">
      <div className={styles.previewStage}>
        <div className={styles.previewHalo} aria-hidden="true" />
        <svg className={styles.botanical} viewBox="0 0 180 240" fill="none" aria-hidden="true">
          <path d="M86 232C106 167 95 90 143 11M106 137C65 119 42 90 26 48M118 93C145 77 163 50 167 25" stroke="currentColor" strokeWidth="2" />
          {[0, 1, 2, 3].map((n) => (
            <g key={n} transform={`translate(${n * 10} ${-n * 30})`}>
              <ellipse cx="93" cy="142" rx="9" ry="20" transform="rotate(-38 93 142)" fill="currentColor" />
              <ellipse cx="114" cy="129" rx="8" ry="19" transform="rotate(33 114 129)" fill="currentColor" />
            </g>
          ))}
        </svg>
        <div className={styles.previewCarton} aria-hidden="true">
          <span className={styles.cartonTop} />
          <span className={styles.cartonBrand}>TryVit</span>
          <span className={styles.cartonName}>{copy.packageName}</span>
          <span className={styles.cartonOat}>✳</span>
          <span className={styles.cartonBasis}>100 ml</span>
        </div>
        <div className={styles.previewCard}>
          <div className={styles.previewCardTop}>
            <span className={styles.previewScanIcon} aria-hidden="true"><LandingGlyph name="observed" /></span>
            <span>{copy.preview.heading}</span>
            <span className={styles.previewDot} aria-hidden="true" />
          </div>
          <p className={styles.previewProductName}>{copy.packageName}</p>
          <p className={styles.previewBasis}>{copy.preview.basis}</p>
          <dl className={styles.previewNutrients}>
            <div><dt>{copy.preview.sugars}</dt><dd>{copy.preview.sugarValue}</dd></div>
            <div><dt>{copy.preview.saturatedFat}</dt><dd>{copy.preview.saturatedFatValue}</dd></div>
          </dl>
          <p className={styles.previewMissing}><span aria-hidden="true">↗</span>{copy.preview.missing}</p>
          <div className={styles.previewSource}><LandingGlyph name="observed" /><span>{copy.synthetic}</span></div>
        </div>
        <span className={styles.previewSpark} aria-hidden="true">✳</span>
      </div>
      <figcaption id="landing-preview-caption">{copy.preview.note}</figcaption>
    </figure>
  );
}
