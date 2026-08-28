export interface PlayerRateInput {
  /** Contagem total da estatística na amostra. null = indisponível. */
  totalCount: number | null;
  /** Minutos totais da amostra. null = indisponível. */
  totalMinutes: number | null;
  /** Contagem recente (janela curta). */
  recentCount?: number | null;
  recentMinutes?: number | null;
  /** Peso da janela recente (0..1). */
  recentWeight?: number;
  /** Média da liga/posição para shrinkage. null = sem prior. */
  priorRate90?: number | null;
  /** Força do prior em minutos equivalentes. */
  priorStrengthMinutes?: number;
}

export interface PlayerRateResult {
  rate90: number | null;
  recentRate90: number | null;
  weightedRate90: number | null;
  shrunkRate90: number | null;
}

/** rate90 = 90 * totalCount / totalMinutes. null nunca vira zero. */
export function rate90(count: number | null, minutes: number | null): number | null {
  if (count == null || minutes == null || !(minutes > 0)) return null;
  return (90 * count) / minutes;
}

export function computePlayerRate(input: PlayerRateInput): PlayerRateResult {
  const base = rate90(input.totalCount, input.totalMinutes);
  const recent = rate90(input.recentCount ?? null, input.recentMinutes ?? null);
  const w = input.recentWeight ?? 0.35;

  let weighted: number | null = base;
  if (base != null && recent != null) weighted = (1 - w) * base + w * recent;
  else if (base == null && recent != null) weighted = recent;

  let shrunk: number | null = weighted;
  if (weighted != null && input.priorRate90 != null && input.totalMinutes != null) {
    const m = input.priorStrengthMinutes ?? 450;
    const alpha = input.totalMinutes / (input.totalMinutes + m);
    shrunk = alpha * weighted + (1 - alpha) * input.priorRate90;
  }

  return {
    rate90: base,
    recentRate90: recent,
    weightedRate90: weighted,
    shrunkRate90: shrunk,
  };
}

export interface PlayerMeanInput {
  lambdaTeam: number | null;
  playerShare: number | null;
  expectedMinutes: number | null;
  /** Base de exposição da equipe (normalmente 90). */
  teamExposureBasis?: number;
  matchupMultiplier?: number | null;
  roleMultiplier?: number | null;
}

export interface PlayerMeanResult {
  muPlayer: number | null;
  missing: string[];
}

export interface ContextAdjustedMeanInput {
  playerRate90: number | null;
  expectedMinutes: number | null;
  lambdaTeam: number | null;
  teamBaselineRate90: number | null;
  teamContextWeight?: number;
  contextRatioFloor?: number;
  contextRatioCeiling?: number;
  matchupMultiplier?: number | null;
  roleMultiplier?: number | null;
}

export interface ContextAdjustedMeanResult extends PlayerMeanResult {
  directMu: number | null;
  teamContextRatio: number | null;
  teamContextMultiplier: number;
  teamContextWeight: number;
}

/** Ancora a projeção na taxa do jogador e limita o contexto do time. */
export function projectContextAdjustedMean(
  input: ContextAdjustedMeanInput,
): ContextAdjustedMeanResult {
  const missing: string[] = [];
  if (input.playerRate90 == null) missing.push("taxa do jogador por 90");
  if (input.expectedMinutes == null) missing.push("minutos esperados");
  const weight = Math.max(0, Math.min(1, input.teamContextWeight ?? 0.3));
  if (missing.length > 0)
    return {
      muPlayer: null,
      directMu: null,
      teamContextRatio: null,
      teamContextMultiplier: 1,
      teamContextWeight: weight,
      missing,
    };

  const directMu =
    (input.playerRate90 as number) *
    ((input.expectedMinutes as number) / 90) *
    (input.matchupMultiplier ?? 1) *
    (input.roleMultiplier ?? 1);
  const floor = input.contextRatioFloor ?? 0.9;
  const ceiling = input.contextRatioCeiling ?? 1.1;
  let ratio: number | null = null;
  let multiplier = 1;
  if (
    input.lambdaTeam != null &&
    input.teamBaselineRate90 != null &&
    input.teamBaselineRate90 > 0
  ) {
    ratio = input.lambdaTeam / input.teamBaselineRate90;
    const limitedRatio = Math.max(floor, Math.min(ceiling, ratio));
    multiplier = 1 + weight * (limitedRatio - 1);
  }
  return {
    muPlayer: directMu * multiplier,
    directMu,
    teamContextRatio: ratio,
    teamContextMultiplier: multiplier,
    teamContextWeight: weight,
    missing: [],
  };
}

/**
 * muPlayer = lambdaTeam * playerShare * (expectedMinutes / teamExposureBasis)
 *            * matchupMultiplier * roleMultiplier
 */
export function projectPlayerMean(input: PlayerMeanInput): PlayerMeanResult {
  const missing: string[] = [];
  if (input.lambdaTeam == null) missing.push("lambda_team");
  if (input.playerShare == null) missing.push("share do jogador");
  if (input.expectedMinutes == null) missing.push("minutos esperados");
  if (missing.length > 0) return { muPlayer: null, missing };

  const basis = input.teamExposureBasis ?? 90;
  if (!(basis > 0)) return { muPlayer: null, missing: ["base de exposição"] };

  const mu =
    (input.lambdaTeam as number) *
    (input.playerShare as number) *
    ((input.expectedMinutes as number) / basis) *
    (input.matchupMultiplier ?? 1) *
    (input.roleMultiplier ?? 1);

  return { muPlayer: mu, missing: [] };
}

/** Share transparente por regra: rate90 do jogador / lambda por 90 da equipe. */
export function shareFromRates(
  playerRate90: number | null,
  teamRate90: number | null,
): number | null {
  if (playerRate90 == null || teamRate90 == null || !(teamRate90 > 0)) return null;
  return playerRate90 / teamRate90;
}
