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
  const normalized = text.replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
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
