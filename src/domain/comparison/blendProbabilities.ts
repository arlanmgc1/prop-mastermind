export const MAX_COMPARISON_WEIGHT = 0.3;

export function logit(p: number): number {
  return Math.log(p / (1 - p));
}

export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export interface BlendResult {
  pModel: number | null;
  pComparable: number | null;
  weight: number;
  pFinal: number | null;
  method: "sem_desconto" | "desconto_heuristico";
  heuristicDiscount: number | null;
}

/**
 * pComparable a partir do consenso bruto (unilateral).
 * Sem calibração histórica, o padrão é NÃO descontar margem.
 */
export function comparableProbability(
  qConsensus: number | null,
  heuristicDiscount: number | null,
): { p: number | null; method: BlendResult["method"] } {
  if (qConsensus == null) return { p: null, method: "sem_desconto" };
  if (heuristicDiscount == null || heuristicDiscount === 0) {
    return { p: clamp(qConsensus, 0.001, 0.999), method: "sem_desconto" };
  }
  return {
    p: clamp(qConsensus * (1 - heuristicDiscount), 0.001, 0.999),
    method: "desconto_heuristico",
  };
}

export function blendProbabilities(
  pModel: number | null,
  pComparable: number | null,
  weight: number,
  method: BlendResult["method"] = "sem_desconto",
  heuristicDiscount: number | null = null,
): BlendResult {
  const w = clamp(weight, 0, MAX_COMPARISON_WEIGHT);
  if (pModel == null) {
    return { pModel: null, pComparable, weight: w, pFinal: null, method, heuristicDiscount };
  }
  if (pComparable == null || w === 0) {
    return {
      pModel,
      pComparable,
      weight: w,
      pFinal: clamp(pModel, 0.0001, 0.9999),
      method,
      heuristicDiscount,
    };
  }
  const pm = clamp(pModel, 0.001, 0.999);
  const pc = clamp(pComparable, 0.001, 0.999);
  const pFinal = logistic((1 - w) * logit(pm) + w * logit(pc));
  return { pModel, pComparable, weight: w, pFinal, method, heuristicDiscount };
}
