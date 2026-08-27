const DASH = "—";

export function pct(p: number | null | undefined, digits = 1): string {
  if (p == null || !Number.isFinite(p)) return DASH;
  return `${(p * 100).toFixed(digits).replace(".", ",")}%`;
}

export function odd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return v.toFixed(2).replace(".", ",");
}

export function param(v: number | null | undefined, digits = 3): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return v.toFixed(digits).replace(".", ",");
}

export function signed(v: number | null | undefined, digits = 3): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = v.toFixed(digits).replace(".", ",");
  return v > 0 ? `+${s}` : s;
}

export function int(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return String(Math.round(v));
}

export { DASH };
