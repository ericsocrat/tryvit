export const GOLDEN_DOMAIN_GLYPHS = [
  "source",
  "observed",
  "derived",
  "context",
  "decision",
  "confidence",
  "unknown",
  "scanner",
  "compare",
] as const;

export type GoldenDomainGlyphName = (typeof GOLDEN_DOMAIN_GLYPHS)[number];

export interface GoldenGlyphProps {
  readonly name: GoldenDomainGlyphName;
  readonly label?: string;
  readonly size?: 16 | 20 | 24 | 32;
  readonly className?: string;
}

function GlyphPath({ name }: Readonly<{ name: GoldenDomainGlyphName }>) {
  switch (name) {
    case "source":
      return <><path d="M4 3h10l6 6v12H4z" /><path d="M14 3v6h6M7 13h10M7 17h7" /></>;
    case "observed":
      return <><path d="M5 3h12l2 2v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /><path d="M3 3v18" /></>;
    case "derived":
      return <><path d="M4 4h6v6H4zM14 14h6v6h-6z" /><path d="M10 7h4l3 3v4M7 10v7h7" /><path d="m10 14 4 3-4 3" /></>;
    case "context":
      return <><path d="M8 4H4v16h4M16 4h4v16h-4" /><path d="M8 8h8M8 12h6M8 16h8" /></>;
    case "decision":
      return <><path d="M4 3h10l6 6v12H4z" /><path d="M14 3v6h6M8 15l3 3 6-7" /></>;
    case "confidence":
      return <><path d="M4 19h4v2H4zM10 14h4v7h-4zM16 7h4v14h-4z" /><path d="M4 4h16" /></>;
    case "unknown":
      return <><path d="M4 3h10l6 6v12H4z" strokeDasharray="3 2" /><path d="M9 10a3 3 0 1 1 4.2 2.8c-.9.4-1.2 1-1.2 2M12 18h.01" /></>;
    case "scanner":
      return <><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" /><path d="M8 9v6M11 8v8M14 9v6M17 8v8" /></>;
    case "compare":
      return <><path d="M3 5h7v14H3zM14 5h7v14h-7z" /><path d="M6 9h1M6 13h1M17 9h1M17 13h1M10 12h4" /></>;
  }
}

export function GoldenGlyph({
  name,
  label,
  size = 24,
  className,
}: Readonly<GoldenGlyphProps>) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      data-golden-glyph={name}
      fill="none"
      height={size}
      role={label ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={size === 16 ? 2 : 1.75}
      viewBox="0 0 24 24"
      width={size}
    >
      <GlyphPath name={name} />
    </svg>
  );
}

export const GOLDEN_GLYPH_CONTRACT = Object.freeze({
  grid: "24x24",
  opticalMicroGrid: "16x16",
  stroke: 1.75,
  microStroke: 2,
  linecap: "round",
  linejoin: "round",
  stateCarrier: "morphology-plus-text-never-color-only",
});
