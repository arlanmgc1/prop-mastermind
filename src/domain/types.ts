export type MarketType =
  | "shots"
  | "shots_on_target"
  | "fouls_committed"
  | "fouls_suffered"
  | "tackles";

export const MARKET_LABELS: Record<MarketType, string> = {
  shots: "Chutes",
  shots_on_target: "Chutes no Gol",
  fouls_committed: "Faltas Cometidas",
  fouls_suffered: "Faltas Sofridas",
  tackles: "Desarmes",
};

export type PlayerRole =
  | "ST"
  | "SA"
  | "Ponta"
  | "Meia"
  | "Volante"
  | "Lateral"
  | "Zagueiro";

export type StarterStatus = "titular" | "reserva" | "incerto";

export type ParticipationRule = "substituto_conta" | "somente_titular";

export type DistributionKind = "poisson" | "negbin";

export interface LadderRow {
  id: string;
  line: number;
  oddOver: number | null;
  oddUnder: number | null;
}

export interface ExtractedPlayerOdd {
  source?: string | undefined;
  playerName?: string | undefined;
  market?: MarketType | undefined;
  line?: number | undefined;
  side: "over";
  decimalOdd?: number | undefined;
  confidence: number;
  sourceImageId: string;
}

export interface OddsImageExtractor {
  /** Nunca deve receber chaves de API no navegador. */
  extract(images: { id: string; name: string; dataUrl: string }[]): Promise<ExtractedPlayerOdd[]>;
  readonly kind: "mock" | "edge-function";
}
