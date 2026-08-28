export interface ParsedLadderLine {
  line: number;
  oddOver: number | null;
  oddUnder: number | null;
}

const decimal = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Aceita tanto tabela numérica ("11,5  2,05  1,72") quanto texto copiado
 * da casa ("Total de Faltas Mais de 11,5 2,05 Menos de 11,5 1,72").
 */
export function parseLadderPaste(text: string): ParsedLadderLine[] {
  const cleanedLines = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\*\*/g, "").trim())
    .filter(Boolean);
  const moreIndex = cleanedLines.findIndex((line) => /^(mais\s+de|over)$/i.test(line));
  const lessIndex = cleanedLines.findIndex((line) => /^(menos\s+de|under)$/i.test(line));
  const numericLines = (lines: string[]) =>
    lines
      .filter((line) => /^[0-9]+(?:[.,][0-9]+)?$/.test(line))
      .map((line) => decimal(line))
      .filter((value): value is number => value != null);

  if (moreIndex >= 0 && lessIndex > moreIndex) {
    const lines = numericLines(cleanedLines.slice(0, moreIndex));
    const overOdds = numericLines(cleanedLines.slice(moreIndex + 1, lessIndex));
    const underOdds = numericLines(cleanedLines.slice(lessIndex + 1));
    const count = Math.min(lines.length, overOdds.length, underOdds.length);
    if (count > 0) {
      return Array.from({ length: count }, (_, index) => ({
        line: lines[index]!,
        oddOver: overOdds[index]!,
        oddUnder: underOdds[index]!,
      }));
    }
  }

  const normalized = text.replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
  const flatMore = /\b(?:mais\s+de|over)\b/i.exec(normalized);
  const flatLess = /\b(?:menos\s+de|under)\b/i.exec(normalized);
  const numericTokens = (segment: string) =>
    [...segment.matchAll(/[0-9]+(?:[.,][0-9]+)?/g)]
      .map((match) => decimal(match[0]))
      .filter((value): value is number => value != null);
  if (
    flatMore?.index != null &&
    flatLess?.index != null &&
    flatLess.index > flatMore.index
  ) {
    const lines = numericTokens(normalized.slice(0, flatMore.index));
    const overOdds = numericTokens(
      normalized.slice(flatMore.index + flatMore[0].length, flatLess.index),
    );
    const underOdds = numericTokens(normalized.slice(flatLess.index + flatLess[0].length));
    const count = Math.min(lines.length, overOdds.length, underOdds.length);
    if (count > 1) {
      return Array.from({ length: count }, (_, index) => ({
        line: lines[index]!,
        oddOver: overOdds[index]!,
        oddUnder: underOdds[index]!,
      }));
    }
  }
  const natural: ParsedLadderLine[] = [];
  const expression =
    /(?:mais\s+de|over)\s*([0-9]+(?:[.,][0-9]+)?)\s+([0-9]+(?:[.,][0-9]+)?)\s+(?:menos\s+de|under)\s*([0-9]+(?:[.,][0-9]+)?)\s+([0-9]+(?:[.,][0-9]+)?)/giu;

  for (const match of normalized.matchAll(expression)) {
    const overLine = decimal(match[1]);
    const oddOver = decimal(match[2]);
    const underLine = decimal(match[3]);
    const oddUnder = decimal(match[4]);
    if (overLine == null || oddOver == null || oddUnder == null) continue;
    if (underLine != null && Math.abs(overLine - underLine) > 1e-9) continue;
    natural.push({ line: overLine, oddOver, oddUnder });
  }
  if (natural.length > 0) return natural;

  const rows: ParsedLadderLine[] = [];
  for (const row of text.split(/\r?\n/)) {
    const values = [...row.matchAll(/[0-9]+(?:[.,][0-9]+)?/g)]
      .map((match) => decimal(match[0]));
    if (values.length < 2 || values[0] == null) continue;
    rows.push({ line: values[0], oddOver: values[1] ?? null, oddUnder: values[2] ?? null });
  }
  return rows;
}
