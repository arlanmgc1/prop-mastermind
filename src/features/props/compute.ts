import {
  fitTeamLadder,
  ladderFairPoints,
  solveMuFromSingleLine,
  type LadderFitResult,
} from "@/domain/distributions/fitTeamLadder";
import { distributionOver } from "@/domain/distributions/negativeBinomial";
import { buildConsensus, type ConsensusResult } from "@/domain/odds/consensus";
import { removeMargin } from "@/domain/odds/removeMargin";
import {
  blendProbabilities,
  comparableProbability,
  type BlendResult,
} from "@/domain/comparison/blendProbabilities";
import { buildPropLadder, type PropLadderRow } from "@/domain/player/buildPropLadder";
import {
  computePlayerRate,
  projectPlayerMean,
  rate90,
  shareFromRates,
} from "@/domain/player/projectPlayerMean";
import { decide, expectedValue, fairOdd } from "@/domain/risk/expectedValue";
import { fractionalKelly, fullKelly } from "@/domain/risk/kelly";
import { validateLadder, type ValidationMessage } from "@/domain/validation/validators";
import { aggregate } from "@/services/sofascoreImportParser";
import type { CalcState } from "./state";
import type { DistributionKind, MarketType } from "@/domain/types";

const FIELD_BY_MARKET: Record<
  MarketType,
  "shots" | "shotsOnTarget" | "foulsCommitted" | "foulsSuffered" | "tackles"
> = {
  shots: "shots",
  shots_on_target: "shotsOnTarget",
  fouls_committed: "foulsCommitted",
  fouls_suffered: "foulsSuffered",
  tackles: "tackles",
};

export interface CalcResult {
  ok: boolean;
  messages: ValidationMessage[];
  teamFit: LadderFitResult | null;
  lambdaTeam: number | null;
  playerRate90: number | null;
  recentRate90: number | null;
  shrunkRate90: number | null;
  playerShare: number | null;
  expectedMinutes: number | null;
  muPlayer: number | null;
  dispersionK: number | null;
  distribution: DistributionKind;
  pModel: number | null;
  consensus: ConsensusResult | null;
  pComparable: number | null;
  comparableMethod: BlendResult["method"];
  blend: BlendResult | null;
  pFinal: number | null;
  fair: number | null;
  ev: number | null;
  decision: ReturnType<typeof decide>;
  ladder: PropLadderRow[];
  uncertainty: [number, number] | null;
  coverage: number;
  sampleMinutes: number | null;
  sampleCount: number | null;
  kelly: { full: number | null; fraction: number | null };
  computedAt: string;
}

function teamLambda(state: CalcState): {
  fit: LadderFitResult | null;
  lambda: number | null;
  k: number | null;
  msgs: ValidationMessage[];
} {
  const msgs: ValidationMessage[] = [];
  const rows = state.teamLadder.filter((r) => r.oddOver != null && r.oddUnder != null);
  if (rows.length === 0) {
    msgs.push({ severity: "erro", message: "Mercado da equipe sem odds Over/Under completas." });
    return { fit: null, lambda: null, k: null, msgs };
  }
  if (rows.length >= 2) {
    const fit = fitTeamLadder(state.teamLadder, state.distribution);
    fit.warnings.forEach((w) => msgs.push({ severity: "aviso", message: w }));
    return { fit, lambda: fit.mu, k: fit.k, msgs };
  }
  // linha única (faltas/desarmes) — resolve mu numericamente
  const row = rows[0]!;
  const fair = removeMargin(row.oddOver, row.oddUnder);
  const k = state.dispersionK;
  const kind: DistributionKind =
    k != null && state.distribution === "negbin" ? "negbin" : "poisson";
  if (kind === "poisson") {
    msgs.push({
      severity: "aviso",
      message: "Estimativa provisória — dispersão não calibrada (fallback Poisson).",
    });
  }
  const mu = solveMuFromSingleLine(row.line, fair.pOver, k, kind);
  if (mu == null)
    msgs.push({
      severity: "erro",
      message: "Não foi possível resolver lambda_team para a linha informada.",
    });
  const { points } = ladderFairPoints(state.teamLadder);
  return {
    fit:
      mu == null
        ? null
        : {
            mu,
            k: kind === "negbin" ? k : null,
            kind,
            points,
            rmse: 0,
            monotonicityFixed: false,
            warnings: [],
          },
    lambda: mu,
    k: kind === "negbin" ? k : null,
    msgs,
  };
}

export function computeAll(state: CalcState): CalcResult {
  const messages: ValidationMessage[] = [];
  const field = FIELD_BY_MARKET[state.market];

  messages.push(...validateLadder(state.teamLadder, "Equipe"));
  if (state.opponentLadder.length)
    messages.push(...validateLadder(state.opponentLadder, "Adversário"));
  if (state.gameLadder.length) messages.push(...validateLadder(state.gameLadder, "Total do jogo"));

  const { fit, lambda: rawTeamLambda, k: kTeam, msgs } = teamLambda(state);
  messages.push(...msgs);
  let lambda = rawTeamLambda;

  // Quando os três mercados existem, reconcilia os times com o total do jogo.
  // Assim adversário e total deixam de ser campos apenas decorativos.
  const hasComplete = (rows: CalcState["teamLadder"]) =>
    rows.some((row) => row.oddOver != null && row.oddUnder != null);
  if (hasComplete(state.opponentLadder) && hasComplete(state.gameLadder)) {
    const opponent = teamLambda({ ...state, teamLadder: state.opponentLadder });
    const game = teamLambda({ ...state, teamLadder: state.gameLadder });
    opponent.msgs.forEach((message) =>
      messages.push({ ...message, message: `Adversário: ${message.message}` }),
    );
    game.msgs.forEach((message) =>
      messages.push({ ...message, message: `Total do jogo: ${message.message}` }),
    );
    if (
      lambda != null &&
      opponent.lambda != null &&
      game.lambda != null &&
      lambda + opponent.lambda > 0
    ) {
      const rawSum = lambda + opponent.lambda;
      const scale = game.lambda / rawSum;
      const discrepancy = Math.abs(rawSum - game.lambda) / game.lambda;
      lambda *= scale;
      messages.push({
        severity: discrepancy > 0.12 ? "aviso" : "info",
        message: `Reconciliação time+adversário com total do jogo aplicada (ajuste ${(scale * 100).toFixed(1)}%).`,
      });
    }
  }

  const perf = state.parsed?.performances ?? [];
  const agg = aggregate(perf, field);
  const recent = aggregate(perf.slice(0, 5), field);
  const rates = computePlayerRate({
    totalCount: agg.count,
    totalMinutes: agg.minutes,
    recentCount: recent.count,
    recentMinutes: recent.minutes,
    recentWeight: 0.35,
  });

  if (agg.count == null && state.playerShareOverride == null) {
    messages.push({
      severity: "erro",
      message: `Sem amostra disponível para ${field} — importe dados ou informe o share manualmente.`,
    });
  }
  if (agg.coverage > 0 && agg.coverage < 0.6) {
    messages.push({
      severity: "aviso",
      message: `Cobertura baixa da estatística (${(agg.coverage * 100).toFixed(1)}%).`,
    });
  }

  // O denominador deve ser a média HISTÓRICA do time. Usar o lambda atual
  // faria lambda * (playerRate/lambda) cancelar o efeito do mercado.
  const teamRate90 = state.teamBaselineRate90;
  const share =
    state.playerShareOverride != null
      ? state.playerShareOverride
      : shareFromRates(rates.shrunkRate90 ?? rates.rate90, teamRate90);

  if (state.playerShareOverride == null && teamRate90 == null) {
    messages.push({
      severity: "erro",
      message:
        "Informe a média histórica do time/90 ou um share manual; o lambda atual não pode ser usado como denominador.",
    });
  }

  const expectedMinutes = state.expectedMinutes;
  const proj = projectPlayerMean({
    lambdaTeam: lambda,
    playerShare: share,
    expectedMinutes,
    matchupMultiplier: state.matchupMultiplier,
    roleMultiplier: state.roleMultiplier,
  });
  proj.missing.forEach((m) =>
    messages.push({ severity: "erro", message: `Entrada indisponível: ${m}.` }),
  );

  const kPlayer = state.dispersionK ?? kTeam;
  const kind: DistributionKind =
    state.distribution === "negbin" && kPlayer != null ? "negbin" : "poisson";
  if (state.distribution === "negbin" && kPlayer == null) {
    messages.push({
      severity: "aviso",
      message: "Estimativa provisória — dispersão não calibrada (fallback Poisson).",
    });
  }

  const line = state.playerLine;
  const pModel =
    proj.muPlayer != null && line != null
      ? distributionOver(line, proj.muPlayer, kPlayer, kind)
      : null;

  // comparativo unilateral
  const confirmed = state.comparisonConfirmed
    ? state.extracted.filter(
        (o) =>
          o.include &&
          o.decimalOdd != null &&
          (o.market == null || o.market === state.market) &&
          (o.line == null || (line != null && Math.abs(o.line - line) < 1e-9)),
      )
    : [];
  const consensusInputs: {
    id: string;
    source?: string | undefined;
    decimalOdd: number | null;
    isTargetOdd?: boolean | undefined;
  }[] = [
    ...confirmed.map((o) => ({
      id: o.id,
      source: o.source,
      decimalOdd: o.decimalOdd ?? null,
      isTargetOdd: o.isTargetOdd,
    })),
    ...state.extraPlayerOdds.map((o) => ({ id: o.id, source: o.source, decimalOdd: o.odd })),
  ];
  const consensus = consensusInputs.length
    ? buildConsensus(consensusInputs, { excludeTargetOdd: true })
    : null;
  if (consensus && consensus.count === 1) {
    messages.push({ severity: "aviso", message: "Comparativo com uma única fonte válida." });
  }

  const cmp = comparableProbability(
    consensus?.impliedMean ?? null,
    state.useHeuristicDiscount ? state.heuristicDiscount : null,
  );
  const blend = blendProbabilities(
    pModel,
    cmp.p,
    state.comparisonWeight,
    cmp.method,
    state.useHeuristicDiscount ? state.heuristicDiscount : null,
  );
  const pFinal = blend.pFinal;

  const ev = expectedValue(pFinal, state.offeredOdd);
  const ladder = buildPropLadder({
    mu: proj.muPlayer,
    k: kPlayer,
    kind,
    marketOdds:
      line != null && state.offeredOdd != null ? { [String(line)]: state.offeredOdd } : {},
    pComparable: cmp.p,
    comparisonWeight: state.comparisonWeight,
    comparisonLine: line,
  });

  let uncertainty: [number, number] | null = null;
  if (proj.muPlayer != null && line != null) {
    const lo = distributionOver(line, proj.muPlayer * 0.85, kPlayer, kind);
    const hi = distributionOver(line, proj.muPlayer * 1.15, kPlayer, kind);
    uncertainty = [Math.min(lo, hi), Math.max(lo, hi)];
  }

  if (state.starter === "incerto") {
    messages.push({
      severity: "aviso",
      message: "Titularidade incerta — minutos esperados pouco confiáveis.",
    });
  }

  return {
    ok: pFinal != null && !messages.some((message) => message.severity === "erro"),
    messages,
    teamFit: fit,
    lambdaTeam: lambda,
    playerRate90: rates.rate90,
    recentRate90: rates.recentRate90,
    shrunkRate90: rates.shrunkRate90,
    playerShare: share,
    expectedMinutes,
    muPlayer: proj.muPlayer,
    dispersionK: kPlayer,
    distribution: kind,
    pModel,
    consensus,
    pComparable: cmp.p,
    comparableMethod: cmp.method,
    blend,
    pFinal,
    fair: fairOdd(pFinal),
    ev,
    decision: decide(ev),
    ladder,
    uncertainty,
    coverage: agg.coverage,
    sampleMinutes: agg.minutes,
    sampleCount: agg.count,
    kelly: {
      full: fullKelly(pFinal, state.offeredOdd),
      fraction: fractionalKelly(pFinal, state.offeredOdd, state.kellyDivisor),
    },
    computedAt: new Date().toISOString(),
  };
}

/** Estimativa automática de minutos, transparente e simples. */
export function autoMinutes(state: CalcState): {
  minutes: number | null;
  low: number | null;
  high: number | null;
} {
  const perf = state.parsed?.performances ?? [];
  const withMin = perf.filter((p) => p.minutes != null).slice(0, 5);
  if (withMin.length === 0) return { minutes: null, low: null, high: null };
  const avg = withMin.reduce((a, b) => a + (b.minutes as number), 0) / withMin.length;
  const adj =
    state.starter === "titular"
      ? Math.max(avg, 70)
      : state.starter === "reserva"
        ? Math.min(avg, 30)
        : avg;
  return {
    minutes: Number(adj.toFixed(0)),
    low: Number(Math.max(0, adj - 12).toFixed(0)),
    high: Number(Math.min(96, adj + 8).toFixed(0)),
  };
}
