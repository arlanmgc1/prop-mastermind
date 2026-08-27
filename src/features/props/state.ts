import type {
  DistributionKind,
  ExtractedPlayerOdd,
  LadderRow,
  MarketType,
  ParticipationRule,
  PlayerRole,
  StarterStatus,
} from "@/domain/types";
import type { ParsedPlayerImport } from "@/services/sofascoreImportParser";
import type { KellyDivisor } from "@/domain/risk/kelly";

export interface ReviewedOdd extends ExtractedPlayerOdd {
  id: string;
  include: boolean;
  isTargetOdd: boolean;
}

export interface CalcState {
  modelVersion: string;
  rawImport: string;
  parsed: ParsedPlayerImport | null;
  playerName: string;
  team: string;
  opponent: string;
  competition: string;
  role: PlayerRole;
  starter: StarterStatus;
  minutesMode: "auto" | "manual";
  expectedMinutes: number | null;
  minutesLow: number | null;
  minutesHigh: number | null;

  market: MarketType;
  playerLine: number | null;
  offeredOdd: number | null;
  participation: ParticipationRule;
  extraPlayerOdds: { id: string; source: string; odd: number | null }[];

  teamLadder: LadderRow[];
  opponentLadder: LadderRow[];
  gameLadder: LadderRow[];
  dispersionK: number | null;
  /** Média histórica do time por 90 na estatística; denominador do share. */
  teamBaselineRate90: number | null;
  distribution: DistributionKind;

  matchupMultiplier: number | null;
  roleMultiplier: number | null;
  playerShareOverride: number | null;

  images: { id: string; name: string; dataUrl: string }[];
  extracted: ReviewedOdd[];
  comparisonConfirmed: boolean;

  comparisonWeight: number;
  useHeuristicDiscount: boolean;
  heuristicDiscount: number;

  kellyDivisor: KellyDivisor;
  isDemo: boolean;
}

export const MODEL_VERSION = "Modelo Props v0.1";

export const emptyLadderRow = (line: number): LadderRow => ({
  id: crypto.randomUUID(),
  line,
  oddOver: null,
  oddUnder: null,
});

export function initialState(): CalcState {
  return {
    modelVersion: MODEL_VERSION,
    rawImport: "",
    parsed: null,
    playerName: "",
    team: "",
    opponent: "",
    competition: "",
    role: "ST",
    starter: "titular",
    minutesMode: "auto",
    expectedMinutes: null,
    minutesLow: null,
    minutesHigh: null,

    market: "shots",
    playerLine: 1.5,
    offeredOdd: null,
    participation: "substituto_conta",
    extraPlayerOdds: [],

    teamLadder: [emptyLadderRow(10.5), emptyLadderRow(11.5), emptyLadderRow(12.5)],
    opponentLadder: [],
    gameLadder: [],
    dispersionK: null,
    teamBaselineRate90: null,
    distribution: "negbin",

    matchupMultiplier: 1,
    roleMultiplier: 1,
    playerShareOverride: null,

    images: [],
    extracted: [],
    comparisonConfirmed: false,

    comparisonWeight: 0.15,
    useHeuristicDiscount: false,
    heuristicDiscount: 0.04,

    kellyDivisor: 0,
    isDemo: false,
  };
}

const KEY = "calculadora-props:rascunho";

export function saveDraft(state: CalcState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(): CalcState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return { ...initialState(), ...(JSON.parse(raw) as CalcState) };
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
