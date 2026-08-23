import { AUTH_COPY } from "./authentication-copy";
import { AuthenticationForm } from "./AuthenticationForm.client";
import { GOLDEN_COMMON_COPY } from "./common-copy";
import type { GoldenRouteState } from "./contract";
import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

export function AuthenticationReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = AUTH_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  return (
    <article className={styles.authReference}>
      <section className={styles.authEditorial}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <dl className={styles.authTrustList}>
          <div><dt><GoldenGlyph name="source" />{common.observed}</dt><dd>{common.packageReminder}</dd></div>
          <div><dt><GoldenGlyph name="confidence" />{common.dataConfidence}</dt><dd>{copy.privacy}</dd></div>
        </dl>
      </section>
      <AuthenticationForm copy={copy} route={route} />
    </article>
  );
}
