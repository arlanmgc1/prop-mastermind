import { logFactorial } from "./poisson";

function logGammaRatio(k: number, r: number): number {
  // log( Gamma(k + r) / (Gamma(r) * k!) )
  let s = 0;
  for (let i = 0; i < k; i++) s += Math.log(r + i);
  return s - logFactorial(k);
}

/**
 * Binomial negativa parametrizada por média mu e dispersão k (r).
 * Var(X) = mu + mu^2 / k
 */
export function negBinPmf(x: number, mu: number, k: number): number {
  if (x < 0 || !Number.isInteger(x) || mu <= 0 || k <= 0) return x === 0 && mu === 0 ? 1 : 0;
  const p = k / (k + mu);
  return Math.exp(logGammaRatio(x, k) + k * Math.log(p) + x * Math.log(1 - p));
}

/** P(X <= x) */
export function negBinCdf(x: number, mu: number, k: number): number {
  if (x < 0) return 0;
  let sum = 0;
  for (let i = 0; i <= Math.floor(x); i++) sum += negBinPmf(i, mu, k);
  return Math.min(1, sum);
}

/** P(X > x) */
export function negBinSf(x: number, mu: number, k: number): number {
  return Math.max(0, 1 - negBinCdf(x, mu, k));
}

export function negBinOver(line: number, mu: number, k: number): number {
  return negBinSf(Math.floor(line), mu, k);
}

export function distributionOver(
  line: number,
  mu: number,
  k: number | null,
  kind: "poisson" | "negbin",
): number {
  if (kind === "poisson" || k == null || !(k > 0)) {
    // fallback explícito para Poisson
    const { poissonOver } = require("./poisson") as typeof import("./poisson");
    return poissonOver(line, mu);
  }
  return negBinOver(line, mu, k);
}
