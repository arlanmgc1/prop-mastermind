export type MarginMethod = "proportional" | "power";

export interface TwoWayFair {
  pOver: number | null;
  pUnder: number | null;
  overround: number | null;
  method: MarginMethod;
}

const NO_RESULT = (method: MarginMethod): TwoWayFair => ({
  pOver: null,
  pUnder: null,
  overround: null,
  method,
});

/**
 * Remoção de margem em mercado de duas vias.
 * null (indisponível) nunca é convertido em zero.
 */
export function removeMargin(
  oddOver: number | null | undefined,
  oddUnder: number | null | undefined,
  method: MarginMethod = "proportional",
): TwoWayFair {
  if (oddOver == null || oddUnder == null) return NO_RESULT(method);
  if (!(oddOver > 1) || !(oddUnder > 1)) return NO_RESULT(method);

  const qOver = 1 / oddOver;
  const qUnder = 1 / oddUnder;
  const overround = qOver + qUnder - 1;

  if (method === "proportional") {
    const sum = qOver + qUnder;
    return { pOver: qOver / sum, pUnder: qUnder / sum, overround, method };
  }

  // Power method: encontra k tal que qOver^k + qUnder^k = 1
  let lo = 0.5;
  let hi = 1.5;
  const f = (k: number) => Math.pow(qOver, k) + Math.pow(qUnder, k) - 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  const pOver = Math.pow(qOver, k);
  const pUnder = Math.pow(qUnder, k);
  const s = pOver + pUnder;
  return { pOver: pOver / s, pUnder: pUnder / s, overround, method };
}

export function impliedProbability(odd: number | null | undefined): number | null {
  if (odd == null || !(odd > 1)) return null;
  return 1 / odd;
}
