import {
  THEME_CHROME_COLORS,
  THEME_MODE_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "@/design-system/accessibility/theme-contract";

import styles from "./landing.module.css";

function createLandingThemeToggleScript(): string {
  return `
(function() {
  var control = document.querySelector('[data-landing-theme-toggle]');
  if (!control) return;
  control.addEventListener('click', function() {
    var root = document.documentElement;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    try { localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)}, next); } catch (e) {}
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    var color = next === 'dark' ? ${JSON.stringify(THEME_CHROME_COLORS.dark)} : ${JSON.stringify(THEME_CHROME_COLORS.light)};
    for (var index = 0; index < metas.length; index += 1) metas[index].setAttribute('content', color);
    try {
      window.dispatchEvent(new CustomEvent(${JSON.stringify(THEME_MODE_CHANGE_EVENT)}, { detail: next }));
    } catch (e) {}
  });
})();
`;
}

export function LandingThemeToggle({
  label,
  lightLabel,
  darkLabel,
}: Readonly<{ label: string; lightLabel: string; darkLabel: string }>) {
  return (
    <>
      <button
        className={`${styles.themeToggle} ${styles.themeToggleInteractive}`}
        data-landing-theme-toggle
        title={label}
        type="button"
      >
        <span aria-hidden="true" className={styles.themeGlyph} />
        <span className={`${styles.visuallyHidden} ${styles.themeLightAction}`}>{darkLabel}</span>
        <span className={`${styles.visuallyHidden} ${styles.themeDarkAction}`}>{lightLabel}</span>
      </button>
      <noscript>
        <button
          aria-label={label}
          className={styles.themeToggle}
          disabled
          title={label}
          type="button"
        >
          <span aria-hidden="true" className={styles.themeGlyph} />
        </button>
      </noscript>
      <script
        dangerouslySetInnerHTML={{ __html: createLandingThemeToggleScript() }}
        id="landing-theme-toggle-bootstrap"
      />
    </>
  );
}
