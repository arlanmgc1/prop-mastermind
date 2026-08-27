import { negBinOver } from "../distributions/negativeBinomial";
import { poissonOver } from "../distributions/poisson";
import { decide, expectedValue, fairOdd, type Decision } from "../risk/expectedValue";
import { blendProbabilities } from "../comparison/blendProbabilities";
import type { DistributionKind } from "../types";

export interface PropLadderRow {
  line: number;
  /** Rótulo "1+", "2+", ... */
  label: string;
  pModel: number;
  pFinal: number;
  fair: number;
  marketOdd: number | null;
  ev: number | null;
  decision: Decision;
}

export interface BuildLadderOptions {
  mu: number | null;
  k: number | null;
  kind: DistributionKind;
  /** odds de mercado conhecidas por linha */
  marketOdds?: Record<string, number | null>;
  pComparable?: number | null;
  comparisonWeight?: number;
  /** linha à qual o comparativo se refere (só ela recebe blend) */
  comparisonLine?: number | null;
  minProbability?: number;
  maxLines?: number;
}

export function buildPropLadder(opts: BuildLadderOptions): PropLadderRow[] {
  const { mu, k, kind } = opts;
  if (mu == null || !(mu > 0)) return [];
  const minP = opts.minProbability ?? 0.02;
  const maxLines = opts.maxLines ?? 12;
  const rows: PropLadderRow[] = [];

  let prev = 1;
  for (let n = 0; n < maxLines; n++) {
    const line = n + 0.5;
    let pModel = kind === "negbin" && k ? negBinOver(line, mu, k) : poissonOver(line, mu);
    // monotonicidade garantida
    pModel = Math.min(pModel, prev);
    prev = pModel;

    const isComparisonLine =
      opts.comparisonLine != null && Math.abs(opts.comparisonLine - line) < 1e-9;
    const blend = blendProbabilities(
      pModel,
      isComparisonLine ? (opts.pComparable ?? null) : null,
      isComparisonLine ? (opts.comparisonWeight ?? 0) : 0,
    );
    const pFinal = blend.pFinal ?? pModel;
    const marketOdd = opts.marketOdds?.[String(line)] ?? null;
    const ev = expectedValue(pFinal, marketOdd);

    rows.push({
      line,
      label: `${n + 1}+`,
      pModel,
      pFinal,
      fair: fairOdd(pFinal) as number,
      marketOdd,
      ev,
      decision: decide(ev),
    });

    if (pModel < minP && n >= 1) break;
  }
  return rows;
}
