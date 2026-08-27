export type Decision = "valor" | "neutro" | "sem_valor";

export function fairOdd(p: number | null): number | null {
  if (p == null || !(p > 0)) return null;
  return 1 / p;
}

export function expectedValue(p: number | null, offeredOdd: number | null): number | null {
  if (p == null || offeredOdd == null || !(offeredOdd > 1)) return null;
  return p * offeredOdd - 1;
}

export function decide(ev: number | null, threshold = 0.02): Decision {
  if (ev == null) return "sem_valor";
  if (ev > threshold) return "valor";
  if (ev >= -threshold) return "neutro";
  return "sem_valor";
}
