import { describe, expect, it } from "vitest";
import { allocateLadderStakes, ladderLabel, parsePlayerLadderPaste } from "../playerLadder";

describe("escada do jogador", () => {
  it("lê a escada Over copiada", () => {
    expect(
      parsePlayerLadderPaste(
        "Jovane Cabral Total de Chutes\nMais de 1.5 1.80\nMais de 2.5 2.70\nMais de 3.5 4.20",
      ),
    ).toEqual([
      { line: 1.5, oddOver: 1.8 },
      { line: 2.5, oddOver: 2.7 },
      { line: 3.5, oddOver: 4.2 },
    ]);
  });

  it("limita a principal a 2u e a escada a 3,25u", () => {
    const rows = allocateLadderStakes(
      [
        { line: 1.5, probability: 0.8, odd: 2.5 },
        { line: 2.5, probability: 0.6, odd: 3.5 },
        { line: 3.5, probability: 0.4, odd: 5 },
      ],
      0.25,
    );
    expect(rows[0]!.units).toBeLessThanOrEqual(2);
    expect(rows.reduce((sum, row) => sum + row.units, 0)).toBeLessThanOrEqual(3.25);
    expect(rows[1]!.units).toBeLessThanOrEqual(rows[0]!.units);
    expect(rows[2]!.units).toBeLessThanOrEqual(rows[1]!.units);
  });

  it("formata linhas em contagem mínima", () => {
    expect(ladderLabel(1.5)).toBe("2+");
    expect(ladderLabel(3.5)).toBe("4+");
  });
});
