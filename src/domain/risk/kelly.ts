export type KellyDivisor = 0 | 4 | 8 | 10 | 12;

export function fullKelly(p: number | null, offeredOdd: number | null): number | null {
  if (p == null || offeredOdd == null || !(offeredOdd > 1)) return null;
  return (p * offeredOdd - 1) / (offeredOdd - 1);
}

/** divisor 0 = sem Kelly (retorna null). */
export function fractionalKelly(
  p: number | null,
  offeredOdd: number | null,
  divisor: KellyDivisor,
): number | null {
  if (divisor === 0) return null;
  const f = fullKelly(p, offeredOdd);
  if (f == null) return null;
  return Math.max(0, f / divisor);
}
