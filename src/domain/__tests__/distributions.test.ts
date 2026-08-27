import { describe, expect, it } from "vitest";
import { poissonCdf, poissonOver, poissonPmf, poissonSf } from "../distributions/poisson";
import { negBinCdf, negBinOver, negBinPmf, negBinSf } from "../distributions/negativeBinomial";
import {
  enforceMonotonic,
  fitTeamLadder,
  solveMuFromSingleLine,
} from "../distributions/fitTeamLadder";
import type { LadderRow } from "../types";

describe("Poisson", () => {
  it("PMF conhecida", () => {
    expect(poissonPmf(0, 2)).toBeCloseTo(Math.exp(-2), 10);
    expect(poissonPmf(1, 2)).toBeCloseTo(2 * Math.exp(-2), 10);
    expect(poissonPmf(3, 2.5)).toBeCloseTo(0.213763, 5);
  });
  it("CDF e SF são complementares", () => {
    expect(poissonCdf(3, 2.5) + poissonSf(3, 2.5)).toBeCloseTo(1, 10);
  });
  it("Over n.5 = P(X >= n+1)", () => {
    expect(poissonOver(1.5, 2)).toBeCloseTo(1 - (poissonPmf(0, 2) + poissonPmf(1, 2)), 10);
  });
  it("PMF soma ~1", () => {
    let s = 0;
    for (let i = 0; i <= 60; i++) s += poissonPmf(i, 12);
    expect(s).toBeCloseTo(1, 6);
  });
});

describe("Binomial negativa", () => {
  it("PMF soma ~1", () => {
    let s = 0;
    for (let i = 0; i <= 200; i++) s += negBinPmf(i, 12, 8);
    expect(s).toBeCloseTo(1, 6);
  });
  it("variância = mu + mu^2/k", () => {
    const mu = 5;
    const k = 4;
    let m1 = 0;
    let m2 = 0;
    for (let i = 0; i <= 300; i++) {
      const p = negBinPmf(i, mu, k);
      m1 += i * p;
      m2 += i * i * p;
    }
    expect(m1).toBeCloseTo(mu, 4);
    expect(m2 - m1 * m1).toBeCloseTo(mu + (mu * mu) / k, 3);
  });
  it("CDF e SF complementares", () => {
    expect(negBinCdf(4, 5, 6) + negBinSf(4, 5, 6)).toBeCloseTo(1, 10);
  });
  it("tende a Poisson quando k é grande", () => {
    expect(negBinOver(2.5, 3, 100000)).toBeCloseTo(poissonOver(2.5, 3), 4);
  });
});

describe("monotonicidade", () => {
  it("corrige curva invertida", () => {
    const { points, fixed } = enforceMonotonic([
      { line: 8.5, pOver: 0.6, overround: null },
      { line: 9.5, pOver: 0.7, overround: null },
    ]);
    expect(fixed).toBe(true);
    expect(points[0]!.pOver).toBeGreaterThanOrEqual(points[1]!.pOver);
  });
  it("mantém curva já monotônica", () => {
    const { fixed } = enforceMonotonic([
      { line: 8.5, pOver: 0.7, overround: null },
      { line: 9.5, pOver: 0.5, overround: null },
    ]);
    expect(fixed).toBe(false);
  });
  it("corrige cadeia de três inversões sem criar nova inversão", () => {
    const { points, fixed } = enforceMonotonic([
      { line: 8.5, pOver: 0.5, overround: null },
      { line: 9.5, pOver: 0.8, overround: null },
      { line: 10.5, pOver: 0.9, overround: null },
    ]);
    expect(fixed).toBe(true);
    expect(points[0]!.pOver).toBeGreaterThanOrEqual(points[1]!.pOver);
    expect(points[1]!.pOver).toBeGreaterThanOrEqual(points[2]!.pOver);
  });
});

describe("ajuste da escada de equipe", () => {
  const rows = (mu: number, k: number, lines: number[]): LadderRow[] =>
    lines.map((line, i) => {
      const p = negBinOver(line, mu, k);
      return { id: String(i), line, oddOver: 1 / p, oddUnder: 1 / (1 - p) };
    });

  it("recupera mu de uma escada sintética", () => {
    const fit = fitTeamLadder(rows(12.4, 20, [9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5]), "negbin");
    expect(fit.mu!).toBeGreaterThan(11.8);
    expect(fit.mu!).toBeLessThan(13.0);
    expect(fit.rmse!).toBeLessThan(0.02);
    expect(fit.points.length).toBe(7);
  });

  it("usa todas as linhas, não só a central", () => {
    const fit = fitTeamLadder(rows(10, 15, [8.5, 12.5]), "negbin");
    expect(fit.points.map((p) => p.line)).toEqual([8.5, 12.5]);
  });

  it("linhas sem odds geram aviso e não zeram", () => {
    const fit = fitTeamLadder([{ id: "1", line: 10.5, oddOver: null, oddUnder: 1.8 }], "poisson");
    expect(fit.mu).toBeNull();
    expect(fit.warnings.join(" ")).toMatch(/incompletas/);
  });
});

describe("resolução de mu com linha única", () => {
  it("inverte a probabilidade justa", () => {
    const mu = solveMuFromSingleLine(10.5, negBinOver(10.5, 11.3, 12), 12, "negbin");
    expect(mu!).toBeCloseTo(11.3, 2);
  });
  it("Poisson como fallback", () => {
    const mu = solveMuFromSingleLine(2.5, 0.5, null, "poisson");
    expect(mu!).toBeGreaterThan(2.5);
  });
  it("probabilidade nula retorna null", () => {
    expect(solveMuFromSingleLine(10.5, null, 10)).toBeNull();
  });
});
