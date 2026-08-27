import { describe, expect, it } from "vitest";
import {
  blendProbabilities,
  comparableProbability,
  logistic,
  logit,
  MAX_COMPARISON_WEIGHT,
} from "../comparison/blendProbabilities";
import { expectedValue, fairOdd, decide } from "../risk/expectedValue";
import { fractionalKelly, fullKelly } from "../risk/kelly";
import { computePlayerRate, projectPlayerMean, rate90, shareFromRates } from "../player/projectPlayerMean";
import { buildPropLadder } from "../player/buildPropLadder";

describe("blend", () => {
  it("peso 0 devolve o modelo puro", () => {
    const r = blendProbabilities(0.618, 0.572, 0);
    expect(r.pFinal!).toBeCloseTo(0.618, 10);
  });
  it("peso 30% fica entre modelo e comparativo", () => {
    const r = blendProbabilities(0.618, 0.572, 0.3);
    expect(r.pFinal!).toBeLessThan(0.618);
    expect(r.pFinal!).toBeGreaterThan(0.572);
    expect(r.pFinal!).toBeCloseTo(logistic(0.7 * logit(0.618) + 0.3 * logit(0.572)), 10);
  });
  it("peso é limitado a 30%", () => {
    expect(blendProbabilities(0.6, 0.4, 0.9).weight).toBe(MAX_COMPARISON_WEIGHT);
  });
  it("comparativo ausente não vira zero", () => {
    const r = blendProbabilities(0.6, null, 0.15);
    expect(r.pFinal!).toBeCloseTo(0.6, 10);
    expect(r.pComparable).toBeNull();
  });
  it("desconto heurístico é rotulado", () => {
    const a = comparableProbability(0.6, null);
    expect(a.method).toBe("sem_desconto");
    const b = comparableProbability(0.6, 0.05);
    expect(b.method).toBe("desconto_heuristico");
    expect(b.p!).toBeCloseTo(0.57, 10);
  });
});

describe("EV e Kelly", () => {
  it("EV = p*odd - 1", () => {
    expect(expectedValue(0.6, 1.9)!).toBeCloseTo(0.14, 10);
    expect(fairOdd(0.5)!).toBe(2);
  });
  it("EV null com odd ausente", () => {
    expect(expectedValue(0.6, null)).toBeNull();
    expect(fullKelly(0.6, null)).toBeNull();
  });
  it("Kelly completo e fracionado", () => {
    expect(fullKelly(0.6, 2)!).toBeCloseTo(0.2, 10);
    expect(fractionalKelly(0.6, 2, 4)!).toBeCloseTo(0.05, 10);
    expect(fractionalKelly(0.6, 2, 0)).toBeNull();
    expect(fractionalKelly(0.4, 2, 4)!).toBe(0);
  });
  it("decisão", () => {
    expect(decide(0.1)).toBe("valor");
    expect(decide(0)).toBe("neutro");
    expect(decide(-0.2)).toBe("sem_valor");
    expect(decide(null)).toBe("sem_valor");
  });
});

describe("projeção do jogador", () => {
  it("rate90", () => {
    expect(rate90(20, 900)!).toBeCloseTo(2, 10);
    expect(rate90(null, 900)).toBeNull();
    expect(rate90(20, null)).toBeNull();
    expect(rate90(20, 0)).toBeNull();
  });
  it("shrinkage puxa para o prior", () => {
    const r = computePlayerRate({
      totalCount: 10,
      totalMinutes: 450,
      priorRate90: 1,
      priorStrengthMinutes: 450,
    });
    expect(r.rate90!).toBeCloseTo(2, 10);
    expect(r.shrunkRate90!).toBeCloseTo(1.5, 10);
  });
  it("mu do jogador", () => {
    const r = projectPlayerMean({
      lambdaTeam: 12,
      playerShare: 0.2,
      expectedMinutes: 72,
      matchupMultiplier: 1.05,
      roleMultiplier: 1,
    });
    expect(r.muPlayer!).toBeCloseTo(12 * 0.2 * (72 / 90) * 1.05, 10);
  });
  it("entrada ausente não é substituída por zero", () => {
    const r = projectPlayerMean({ lambdaTeam: null, playerShare: 0.2, expectedMinutes: 70 });
    expect(r.muPlayer).toBeNull();
    expect(r.missing).toContain("lambda_team");
    expect(shareFromRates(2, null)).toBeNull();
  });
});

describe("escada de props", () => {
  it("probabilidades decrescem monotonicamente", () => {
    const rows = buildPropLadder({ mu: 2.4, k: 6, kind: "negbin" });
    expect(rows.length).toBeGreaterThan(2);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.pModel).toBeLessThanOrEqual(rows[i - 1]!.pModel);
    }
    expect(rows[0]!.label).toBe("1+");
    expect(rows[1]!.label).toBe("2+");
  });
  it("mu ausente devolve escada vazia", () => {
    expect(buildPropLadder({ mu: null, k: 6, kind: "negbin" })).toEqual([]);
  });
  it("blend aplicado apenas na linha do comparativo", () => {
    const rows = buildPropLadder({
      mu: 2.4,
      k: 6,
      kind: "negbin",
      pComparable: 0.4,
      comparisonWeight: 0.3,
      comparisonLine: 1.5,
    });
    const target = rows.find((r) => r.line === 1.5)!;
    const other = rows.find((r) => r.line === 0.5)!;
    expect(target.pFinal).not.toBeCloseTo(target.pModel, 6);
    expect(other.pFinal).toBeCloseTo(other.pModel, 10);
  });
});
