const GLYPHS = Object.freeze({
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
} as const);

function labelPath(label: "A" | "B" | "C"): string {
  const text = `CANDIDATE ${label}`;
  const cell = 2;
  const glyphWidth = 5 * cell;
  const gap = 2 * cell;
  const originX = 16;
  const originY = 10;
  const commands: string[] = [];

  for (const [glyphIndex, character] of [...text].entries()) {
    const glyph = GLYPHS[character as keyof typeof GLYPHS];
    if (!glyph) throw new Error("[P5A2_EVIDENCE] contact-label-character-invalid");
    const glyphX = originX + glyphIndex * (glyphWidth + gap);
    for (const [rowIndex, row] of glyph.entries()) {
      for (const [columnIndex, pixel] of [...row].entries()) {
        if (pixel !== "1") continue;
        const x = glyphX + columnIndex * cell;
        const y = originY + rowIndex * cell;
        commands.push(`M${x} ${y}h${cell}v${cell}h-${cell}Z`);
      }
    }
  }
  return commands.join("");
}

export function createDirectionSelectionContactLabelSvg(
  label: "A" | "B" | "C",
  width: number,
  height: number,
): Buffer {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 24
  ) {
    throw new Error("[P5A2_EVIDENCE] contact-label-dimensions-invalid");
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill="#161616" d="M0 0H${width}V${height}H0Z"/><path fill="#ffffff" d="${labelPath(label)}"/></svg>`,
    "utf8",
  );
}
