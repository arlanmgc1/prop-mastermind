import { negBinOver } from "./negativeBinomial";
import { poissonOver } from "./poisson";
import { removeMargin, type MarginMethod } from "../odds/removeMargin";
import type { DistributionKind, LadderRow } from "../types";

export interface FairLadderPoint {
  line: number;
  pOver: number;
  overround: number | null;
}

export interface LadderFitResult {
  mu: number | null;
  k: number | null;
  kind: DistributionKind;
  points: FairLadderPoint[];
  rmse: number | null;
  monotonicityFixed: boolean;
  warnings: string[];
}

/** Extrai as probabilidades justas de cada linha da escada. */
export function ladderFairPoints(
  rows: LadderRow[],
  method: MarginMethod = "proportional",
): { points: FairLadderPoint[]; warnings: string[] } {
  const warnings: string[] = [];
  const points: FairLadderPoint[] = [];
  for (const r of rows) {
    if (r.oddOver == null || r.oddUnder == null) {
      warnings.push(`Linha ${r.line}: odds Over/Under incompletas — ignorada.`);
      continue;
    }
    const fair = removeMargin(r.oddOver, r.oddUnder, method);
    if (fair.pOver == null) {
      warnings.push(`Linha ${r.line}: odds inválidas.`);
      continue;
    }
    if (fair.overround != null && fair.overround > 0.15) {
      warnings.push(`Linha ${r.line}: overround extremo (${(fair.overround * 100).toFixed(1)}%).`);
    }
    points.push({ line: r.line, pOver: fair.pOver, overround: fair.overround });
  }
  points.sort((a, b) => a.line - b.line);
  return { points, warnings };
}

/** Correção monotônica: probabilidade Over deve cair quando a linha sobe. */
export function enforceMonotonic(points: FairLadderPoint[]): {
  points: FairLadderPoint[];
  fixed: boolean;
} {
  const out = points.map((p) => ({ ...p }));
  let fixed = false;
  for (let i = 1; i < out.length; i++) {
    if (out[i].pOver > out[i - 1].pOver) {
      fixed = true;
      const avg = (out[i].pOver + out[i - 1].pOver) / 2;
      out[i - 1].pOver = Math.min(0.999, avg + 1e-6);
      out[i].pOver = Math.max(0.001, avg - 1e-6);
    }
  }
  return { points: out, fixed };
}

function sse(points: FairLadderPoint[], mu: number, k: number | null, kind: DistributionKind) {
  let s = 0;
  for (const p of points) {
    const model = kind === "negbin" && k ? negBinOver(p.line, mu, k) : poissonOver(p.line, mu);
    s += (model - p.pOver) ** 2;
  }
  return s;
}

/** Ajusta mu (e k, quando negbin) minimizando erro sobre TODAS as linhas. */
export function fitTeamLadder(
  rows: LadderRow[],
  kind: DistributionKind = "negbin",
  method: MarginMethod = "proportional",
): LadderFitResult {
  const { points: raw, warnings } = ladderFairPoints(rows, method);
  if (raw.length === 0) {
    return { mu: null, k: null, kind, points: [], rmse: null, monotonicityFixed: false, warnings };
  }
  const { points, fixed } = enforceMonotonic(raw);
  if (fixed) warnings.push("Curva não monotônica detectada e corrigida antes do ajuste.");

  let bestMu = 1;
  let bestK: number | null = kind === "negbin" ? 10 : null;
  let bestErr = Infinity;

  const muGrid: number[] = [];
  for (let mu = 0.2; mu <= 40; mu += 0.1) muGrid.push(Number(mu.toFixed(2)));
  const kGrid = kind === "negbin" ? [2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50, 100, 250] : [null];

  for (const k of kGrid) {
    for (const mu of muGrid) {
      const err = sse(points, mu, k, kind);
      if (err < bestErr) {
        bestErr = err;
        bestMu = mu;
        bestK = k;
      }
    }
  }
  // refino local em mu
  for (let mu = Math.max(0.05, bestMu - 0.1); mu <= bestMu + 0.1; mu += 0.005) {
    const err = sse(points, mu, bestK, kind);
    if (err < bestErr) {
      bestErr = err;
      bestMu = mu;
    }
  }

  if (points.length === 1) {
    warnings.push("Apenas uma linha disponível — ajuste pouco identificado.");
  }

  return {
    mu: Number(bestMu.toFixed(3)),
    k: bestK,
    kind,
    points,
    rmse: Math.sqrt(bestErr / points.length),
    monotonicityFixed: fixed,
    warnings,
  };
}

/** Resolve mu para uma linha única, dada a probabilidade justa de Over. */
export function solveMuFromSingleLine(
  line: number,
  pOverFair: number | null,
  k: number | null,
  kind: DistributionKind = "negbin",
): number | null {
  if (pOverFair == null || !(pOverFair > 0) || !(pOverFair < 1)) return null;
  let lo = 0.01;
  let hi = 60;
  const f = (mu: number) =>
    (kind === "negbin" && k ? negBinOver(line, mu, k) : poissonOver(line, mu)) - pOverFair;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return Number(((lo + hi) / 2).toFixed(4));
}
