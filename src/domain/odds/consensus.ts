export interface ConsensusInput {
  id: string;
  source?: string | undefined;
  decimalOdd: number | null;
  weight?: number | undefined;
  isTargetOdd?: boolean | undefined;
}

export interface ConsensusResult {
  used: { id: string; source?: string | undefined; decimalOdd: number; weight: number }[];
  removed: { id: string; source?: string | undefined; decimalOdd: number | null; reason: string }[];
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  /** Média ponderada de 1/odd — consenso bruto, contém margem desconhecida. */
  impliedMean: number | null;
  consensusOdd: number | null;
}

const EMPTY = (removed: ConsensusResult["removed"]): ConsensusResult => ({
  used: [],
  removed,
  count: 0,
  min: null,
  max: null,
  mean: null,
  median: null,
  impliedMean: null,
  consensusOdd: null,
});

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Consenso unilateral (apenas Over). O resultado é "consenso bruto":
 * NÃO está livre de margem.
 */
export function buildConsensus(
  inputs: ConsensusInput[],
  opts: { excludeTargetOdd?: boolean | undefined; outlierZ?: number | undefined } = {},
): ConsensusResult {
  const removed: ConsensusResult["removed"] = [];
  let pool = inputs.filter((i) => {
    if (i.decimalOdd == null || !(i.decimalOdd > 1)) {
      removed.push({
        id: i.id,
        source: i.source,
        decimalOdd: i.decimalOdd,
        reason: "Odd inválida ou ausente",
      });
      return false;
    }
    if (opts.excludeTargetOdd && i.isTargetOdd) {
      removed.push({
        id: i.id,
        source: i.source,
        decimalOdd: i.decimalOdd,
        reason: "Odd-alvo excluída do consenso",
      });
      return false;
    }
    return true;
  });

  if (pool.length === 0) return EMPTY(removed);

  if (pool.length >= 4) {
    const z = opts.outlierZ ?? 2.5;
    const vals = pool.map((p) => p.decimalOdd as number);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
    if (sd > 0) {
      pool = pool.filter((p) => {
        const dev = Math.abs((p.decimalOdd as number) - m) / sd;
        if (dev > z) {
          removed.push({
            id: p.id,
            source: p.source,
            decimalOdd: p.decimalOdd,
            reason: `Outlier (${dev.toFixed(2)} desvios-padrão)`,
          });
          return false;
        }
        return true;
      });
    }
  }

  if (pool.length === 0) return EMPTY(removed);

  const used = pool.map((p) => ({
    id: p.id,
    source: p.source,
    decimalOdd: p.decimalOdd as number,
    weight: p.weight != null && p.weight > 0 ? p.weight : 1,
  }));
  const vals = used.map((u) => u.decimalOdd);
  const wSum = used.reduce((a, b) => a + b.weight, 0);
  const impliedMean = used.reduce((a, b) => a + (1 / b.decimalOdd) * b.weight, 0) / wSum;

  return {
    used,
    removed,
    count: used.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    median: median(vals),
    impliedMean,
    consensusOdd: 1 / impliedMean,
  };
}
