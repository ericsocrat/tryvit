import { GOLDEN_ASSET_BOARDS, type GoldenAssetBoard } from "./asset-contract";
import type { GoldenTheme } from "./contract";
import { GOLDEN_DOMAIN_GLYPHS, GoldenGlyph } from "./GoldenGlyph";
import { GoldenLockup, GoldenMark, GoldenWordmark } from "./GoldenIdentity";
import styles from "./golden.module.css";

const BOARD_TITLE: Readonly<Record<GoldenAssetBoard, string>> = {
  identity: "Master identity",
  lockups: "Responsive lockups",
  "compact-favicon": "Compact and favicon proof",
  maskable: "Maskable safe-area proof",
  "social-og": "Social and Open Graph composition",
  typography: "Typography assay",
  "domain-glyphs": "Domain-glyph grammar",
};

export function GoldenAssetBoardView({
  board,
  theme,
}: Readonly<{ board: GoldenAssetBoard; theme: GoldenTheme }>) {
  return (
    <div className={styles.assetBoard} data-design-system="v2" data-golden-asset-board={board} data-theme={theme}>
      <header className={styles.assetBoardHeader}>
        <div><p className={styles.eyebrow}>Checkpoint 2 · review-only vector system</p><h1>{BOARD_TITLE[board]}</h1></div>
        <nav aria-label="Asset boards">
          {GOLDEN_ASSET_BOARDS.map((item) => <a aria-current={item === board ? "page" : undefined} href={`/dev/phase5a2/golden-assets/${item}?theme=${theme}`} key={item}>{BOARD_TITLE[item]}</a>)}
        </nav>
      </header>

      {board === "identity" ? (
        <section className={styles.identityBoard}>
          <article className={styles.identityHero}><GoldenMark label="TryVit folded label master symbol" size="large" /><GoldenWordmark /><p>Folded Label Register · asymmetric source sheet · square registration aperture · rust reverse face</p></article>
          <article data-swatch="paper"><GoldenMark label="TryVit symbol on paper" size="large" /><strong>Paper / forest</strong></article>
          <article data-swatch="forest"><GoldenMark label="TryVit inverse symbol" size="large" tone="inverse" /><strong>Forest / paper / rust</strong></article>
          <article data-swatch="mono"><GoldenMark label="TryVit monochrome symbol" size="large" tone="monochrome" /><strong>Monochrome / forced colors</strong></article>
        </section>
      ) : null}

      {board === "lockups" ? (
        <section className={styles.lockupBoard}>
          <article><span>Horizontal · ≥120px</span><GoldenLockup /></article>
          <article className={styles.stackedLockup}><span>Stacked · ≥80px</span><GoldenMark size="large" /><GoldenWordmark /></article>
          <article><span>Compact · symbol only</span><GoldenLockup compact /></article>
          <article><span>Clear space · 0.25H outer / 0.1875H symbol gap</span><div className={styles.clearSpace}><GoldenLockup /></div></article>
          <article className={styles.misuseTile}><span>Misuse · preserve the source fold</span><div className={styles.misuseExample}><GoldenMark size="large" /><b aria-hidden="true">×</b></div><small>Never stretch, rotate, recolor one face, close the aperture, add effects, or set the mark below 16px.</small></article>
          <article className={styles.accessibilityTile}><span>Accessibility · name and meaning</span><GoldenLockup /><small>Keep the visible TryVit name with primary lockups. Hide decorative marks from assistive technology; label standalone marks and never encode evidence status by color alone.</small></article>
        </section>
      ) : null}

      {board === "compact-favicon" ? (
        <section className={styles.compactBoard}>
          {([16, 20, 24, 32] as const).map((pixels) => <article key={pixels}><div className={styles.pixelCell}><GoldenMark label={`TryVit ${pixels}px symbol`} size={pixels} /></div><strong>{pixels}×{pixels}</strong><small>{pixels <= 20 ? "Dedicated reduction · 1px safe edge · 2px minimum feature" : "Master geometry · registration aperture and source rule"}</small></article>)}
          <article className={styles.faviconStrip}><GoldenMark size="micro" /><GoldenMark size="small" /><span>Browser light</span></article>
          <article className={styles.faviconStrip} data-dark="true"><GoldenMark size="micro" tone="inverse" /><GoldenMark size="small" tone="inverse" /><span>Browser dark</span></article>
        </section>
      ) : null}

      {board === "maskable" ? (
        <section className={styles.maskableBoard}>
          {(["square", "circle", "squircle"] as const).map((shape) => <article data-shape={shape} key={shape}><div><GoldenMark label={`${shape} mask proof`} size="large" /></div><strong>{shape}</strong><small>Critical geometry remains inside the 80% safe circle.</small></article>)}
        </section>
      ) : null}

      {board === "social-og" ? (
        <section className={styles.socialBoard}>
          <article className={styles.socialAvatar}><GoldenMark label="TryVit social avatar" size="large" /></article>
          <article className={styles.ogComposition}><GoldenLockup /><h2>Read the package. See the reasoning.</h2><p>Synthetic Checkpoint 2 review composition · no production metadata change</p><div className={styles.ogEvidence}><GoldenGlyph name="observed" /><GoldenGlyph name="derived" /><GoldenGlyph name="context" /><GoldenGlyph name="decision" /></div></article>
          <article className={styles.splashComposition}><GoldenMark label="TryVit splash symbol" size="large" /><strong>TryVit</strong><span>Source → evidence → decision</span></article>
        </section>
      ) : null}

      {board === "typography" ? (
        <section className={styles.typeBoard}>
          <header><p className={styles.eyebrow}>Rendered control · zero font bytes</p><h2>System UI stack</h2><p>Candidate Manrope + Source Serif 4 remains blocked: immutable upstream commit, checked-in license/RFN text, complete message corpus, fallback metrics, size adjustment and CLS proof are absent.</p></header>
          <article><span>Display / 64</span><strong>Evidence should be readable before it is persuasive.</strong></article>
          <article><span>Polski / 32</span><strong>Wiarygodność danych nie ukrywa brakujących informacji.</strong></article>
          <article><span>Deutsch / 24</span><strong>Verpackungsangaben, abgeleitete Einordnung und Datenverlässlichkeit bleiben unterscheidbar.</strong></article>
          <article className={styles.typeNumbers}><span>Tabular figures / 14–56</span><strong>003.20 · 072/100 · 2026-07-14 · 5901234123457</strong></article>
        </section>
      ) : null}

      {board === "domain-glyphs" ? (
        <section className={styles.glyphBoard}>
          {GOLDEN_DOMAIN_GLYPHS.map((glyph) => <article key={glyph}><GoldenGlyph label={`${glyph} domain glyph`} name={glyph} size={32} /><strong>{glyph}</strong><div><GoldenGlyph name={glyph} size={24} /><GoldenGlyph name={glyph} size={16} /></div></article>)}
          <p>One 24×24 optical grid · 1.75px rounded stroke · 2px optical micro stroke · meaning always paired with text.</p>
        </section>
      ) : null}
    </div>
  );
}
