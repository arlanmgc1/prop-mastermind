import { describe, expect, it } from "vitest";
import { parseLadderPaste } from "../parseLadderPaste";

describe("lote achatado pelo campo de texto", () => {
  it("reconstrói as colunas mesmo sem quebras de linha", () => {
    const text =
      "Total de Chutes AC Milan Partida 10.5 12.5 14.5 16.5 " +
      "Mais de 1.083 1.22 1.50 1.90 Menos de 7.00 4.00 2.50 1.80";
    expect(parseLadderPaste(text)).toEqual([
      { line: 10.5, oddOver: 1.083, oddUnder: 7 },
      { line: 12.5, oddOver: 1.22, oddUnder: 4 },
      { line: 14.5, oddOver: 1.5, oddUnder: 2.5 },
      { line: 16.5, oddOver: 1.9, oddUnder: 1.8 },
    ]);
  });
});
