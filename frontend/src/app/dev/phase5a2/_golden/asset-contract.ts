export const GOLDEN_ASSET_BOARDS = [
  "identity",
  "lockups",
  "compact-favicon",
  "maskable",
  "social-og",
  "typography",
  "domain-glyphs",
] as const;

export type GoldenAssetBoard = (typeof GOLDEN_ASSET_BOARDS)[number];

export function isGoldenAssetBoard(value: string): value is GoldenAssetBoard {
  return GOLDEN_ASSET_BOARDS.some((board) => board === value);
}
