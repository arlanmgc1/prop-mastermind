import { describe, expect, it } from "vitest";
import { parseLadderPaste } from "../parseLadderPaste";

describe("parseLadderPaste", () => {
  it("lê uma linha textual copiada da casa", () => {
    expect(
      parseLadderPaste("AC Milan Total de Faltas Mais de 11.5 2.05 Menos de 11.5 1.72"),
    ).toEqual([{ line: 11.5, oddOver: 2.05, oddUnder: 1.72 }]);
  });

  it("aceita vírgulas e vários mercados", () => {
    expect(
      parseLadderPaste(
        "Time Total de Chutes Mais de 10,5 1,80 Menos de 10,5 1,90\n" +
          "Time Total de Chutes Mais de 11,5 2,10 Menos de 11,5 1,65",
      ),
    ).toEqual([
      { line: 10.5, oddOver: 1.8, oddUnder: 1.9 },
      { line: 11.5, oddOver: 2.1, oddUnder: 1.65 },
    ]);
  });

  it("preserva o formato de tabela numérica", () => {
    expect(parseLadderPaste("10,5  1,70  2,15")).toEqual([
      { line: 10.5, oddOver: 1.7, oddUnder: 2.15 },
    ]);
  });
});
