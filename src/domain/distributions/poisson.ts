function logGamma(x: number): number {
  // Lanczos
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function logFactorial(n: number): number {
  return logGamma(n + 1);
}

export function poissonPmf(k: number, mu: number): number {
  if (k < 0 || !Number.isInteger(k) || mu < 0) return 0;
  if (mu === 0) return k === 0 ? 1 : 0;
  return Math.exp(-mu + k * Math.log(mu) - logFactorial(k));
}

/** P(X <= k) */
export function poissonCdf(k: number, mu: number): number {
  if (k < 0) return 0;
  let sum = 0;
  for (let i = 0; i <= Math.floor(k); i++) sum += poissonPmf(i, mu);
  return Math.min(1, sum);
}

/** P(X > k) — função de sobrevivência */
export function poissonSf(k: number, mu: number): number {
  return Math.max(0, 1 - poissonCdf(k, mu));
}

/** P(Over line) para linhas do tipo n.5 => P(X >= n+1) */
export function poissonOver(line: number, mu: number): number {
  return poissonSf(Math.floor(line), mu);
}
