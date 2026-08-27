import { describe, expect, it } from "vitest";
import { removeMargin, impliedProbability } from "../odds/removeMargin";
import { buildConsensus, median } from "../odds/consensus";

describe("removeMargin (proporcional)", () => {
  it("Over 14,5 @1,80 / Under 14,5 @1,90", () => {
    const r = removeMargin(1.8, 1.9);
    expect(r.pOver!).toBeCloseTo(0.5135, 4);
    expect(r.pUnder!).toBeCloseTo(0.4865, 4);
    expect(r.overround!).toBeCloseTo(0.0819, 4);
  });

  it("Over 19,5 @1,93 / Under 19,5 @1,82", () => {
    expect(removeMargin(1.93, 1.82).pOver!).toBeCloseTo(0.4853, 4);
  });

  it("Over 17,5 @1,88 / Under 17,5 @1,85", () => {
    expect(removeMargin(1.88, 1.85).pOver!).toBeCloseTo(0.4960, 3);
  });

  it("soma das probabilidades justas é 1", () => {
    const r = removeMargin(2.1, 1.75);
    expect(r.pOver! + r.pUnder!).toBeCloseTo(1, 10);
  });

  it("método power também normaliza", () => {
    const r = removeMargin(1.8, 1.9, "power");
    expect(r.method).toBe("power");
    expect(r.pOver! + r.pUnder!).toBeCloseTo(1, 8);
    expect(r.pOver!).toBeGreaterThan(0.5);
  });

  it("null não vira zero", () => {
    expect(removeMargin(null, 1.9).pOver).toBeNull();
    expect(removeMargin(1.8, null).pOver).toBeNull();
    expect(removeMargin(undefined, undefined).overround).toBeNull();
    expect(impliedProbability(null)).toBeNull();
    expect(impliedProbability(0.5)).toBeNull();
  });
});

describe("consenso de odds", () => {
  it("média implícita e odd consenso", () => {
    const r = buildConsensus([
      { id: "a", decimalOdd: 1.8 },
      { id: "b", decimalOdd: 1.9 },
      { id: "c", decimalOdd: 2.0 },
    ]);
    expect(r.count).toBe(3);
    expect(r.min).toBe(1.8);
    expect(r.max).toBe(2.0);
    expect(r.mean!).toBeCloseTo(1.9, 10);
    expect(r.median!).toBeCloseTo(1.9, 10);
    const expected = (1 / 1.8 + 1 / 1.9 + 1 / 2.0) / 3;
    expect(r.impliedMean!).toBeCloseTo(expected, 10);
    expect(r.consensusOdd!).toBeCloseTo(1 / expected, 10);
  });

  it("exclui a odd-alvo quando pedido", () => {
    const r = buildConsensus(
      [
        { id: "a", decimalOdd: 1.8, isTargetOdd: true },
        { id: "b", decimalOdd: 1.9 },
      ],
      { excludeTargetOdd: true },
    );
    expect(r.count).toBe(1);
    expect(r.removed[0]!.reason).toMatch(/alvo/);
  });

  it("remove outliers e informa motivo", () => {
    const r = buildConsensus([
      { id: "a", decimalOdd: 1.8 },
      { id: "b", decimalOdd: 1.82 },
      { id: "c", decimalOdd: 1.79 },
      { id: "d", decimalOdd: 1.81 },
      { id: "e", decimalOdd: 5.0 },
    ], { outlierZ: 1.5 });
    expect(r.removed.some((x) => x.reason.includes("Outlier"))).toBe(true);
    expect(r.count).toBe(4);
  });

  it("odds ausentes não viram zero", () => {
    const r = buildConsensus([{ id: "a", decimalOdd: null }]);
    expect(r.count).toBe(0);
    expect(r.impliedMean).toBeNull();
    expect(r.consensusOdd).toBeNull();
  });

  it("mediana de lista vazia é null", () => {
    expect(median([])).toBeNull();
  });
});
