import { describe, expect, it } from "vitest";
import { distributeEscadaFromMain } from "../playerLadder";

describe("escada automática para publicação", () => {
  it("transforma 2u em 2u + 0,75u + 0,50u sob teto de 3,25u", () => {
    expect(distributeEscadaFromMain([1.5, 2.5, 3.5], 2, 0.25)).toEqual([
      { line: 1.5, units: 2 },
      { line: 2.5, units: 0.75 },
      { line: 3.5, units: 0.5 },
    ]);
  });

  it("mantém o total abaixo do teto com mais degraus", () => {
    const rows = distributeEscadaFromMain([1.5, 2.5, 3.5, 4.5], 2, 0.25);
    expect(rows.reduce((sum, row) => sum + row.units, 0)).toBeLessThanOrEqual(3.25);
    expect(rows[0]!.units).toBeLessThanOrEqual(2);
    expect(rows[1]!.units).toBeLessThanOrEqual(rows[0]!.units);
    expect(rows[2]!.units).toBeLessThanOrEqual(rows[1]!.units);
    expect(rows[3]!.units).toBeLessThanOrEqual(rows[2]!.units);
  });
  it("mantém toda stake positiva estritamente abaixo do degrau anterior", () => {
    const rows = distributeEscadaFromMain([1.5, 2.5, 3.5], 0.5, 0.25);
    expect(rows).toEqual([
      { line: 1.5, units: 0.5 },
      { line: 2.5, units: 0.25 },
      { line: 3.5, units: 0 },
    ]);
    const indicated = rows.filter((row) => row.units > 0);
    for (let index = 1; index < indicated.length; index++) {
      expect(indicated[index]!.units).toBeLessThan(indicated[index - 1]!.units);
    }
  });
});
