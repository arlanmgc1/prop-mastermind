import { describe, expect, it } from "vitest";
import { parseLadderPaste } from "../parseLadderPaste";

describe("lote de linhas copiado em colunas", () => {
  it("alinha linha, Mais de e Menos de pela posição", () => {
    const text = [
      "**Total de Chutes**", "**AC Milan**", "**Partida**",
      "10.5", "12.5", "14.5", "16.5", "18.5", "20.5", "22.5", "24.5",
      "**Mais de**",
      "1.083", "1.22", "1.50", "1.90", "2.62", "4.00", "6.00", "8.50",
      "**Menos de**",
      "7.00", "4.00", "2.50", "1.80", "1.44", "1.22", "1.11", "1.05",
    ].join("\n");

    expect(parseLadderPaste(text)).toEqual([
      { line: 10.5, oddOver: 1.083, oddUnder: 7 },
      { line: 12.5, oddOver: 1.22, oddUnder: 4 },
      { line: 14.5, oddOver: 1.5, oddUnder: 2.5 },
      { line: 16.5, oddOver: 1.9, oddUnder: 1.8 },
      { line: 18.5, oddOver: 2.62, oddUnder: 1.44 },
      { line: 20.5, oddOver: 4, oddUnder: 1.22 },
      { line: 22.5, oddOver: 6, oddUnder: 1.11 },
      { line: 24.5, oddOver: 8.5, oddUnder: 1.05 },
    ]);
  });
});
