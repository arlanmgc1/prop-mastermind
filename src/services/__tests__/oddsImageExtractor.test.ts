import { describe, expect, it } from "vitest";
import { parseComparisonRow } from "../oddsImageExtractor";

describe("parseComparisonRow", () => {
  it("separa a linha Over das odds de todas as casas", () => {
    const result = parseComparisonRow(
      "Alphadjo Cisse Over 1.5 2.1 2.25 2.8 2.05 3.4 3.75 2.8 2.63 2.88 3.0",
    );
    expect(result.playerName).toBe("Alphadjo Cisse");
    expect(result.line).toBe(1.5);
    expect(result.odds).toEqual([2.1, 2.25, 2.8, 2.05, 3.4, 3.75, 2.8, 2.63, 2.88, 3]);
  });

  it("aceita vírgula decimal", () => {
    const result = parseComparisonRow("Jogador Over 1,5 2,10 2,25 3,75");
    expect(result.line).toBe(1.5);
    expect(result.odds).toEqual([2.1, 2.25, 3.75]);
  });
});
