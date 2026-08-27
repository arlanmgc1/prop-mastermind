import { parseNumberOrNull } from "../domain/validation/validators";

export interface PlayerPerformance {
  competition: string | null;
  opponent: string | null;
  homeAway: "casa" | "fora" | null;
  starter: boolean | null;
  minutes: number | null;
  /** Total de chutes (TOS) */
  shots: number | null;
  /** Chutes no gol (SOT) */
  shotsOnTarget: number | null;
  xG: number | null;
  foulsCommitted: number | null;
  foulsSuffered: number | null;
  tackles: number | null;
  raw: string;
}

export interface ParsedPlayerImport {
  playerName: string | null;
  sofascoreId: string | null;
  url: string | null;
  collectedAt: string | null;
  team: string | null;
  competitions: string[];
  performances: PlayerPerformance[];
  errors: string[];
  warnings: string[];
  /** Texto original, mantido separado dos dados normalizados. */
  rawImport: string;
}

const EMPTY_TOKENS = new Set(["-", "—", "--", "", "n/a", "N/A"]);

function cleanCell(v: string): string | null {
  const t = v.trim();
  if (EMPTY_TOKENS.has(t) || EMPTY_TOKENS.has(t.toLowerCase())) return null;
  return t;
}

function num(v: string | undefined | null): number | null {
  if (v == null) return null;
  const c = cleanCell(v);
  if (c == null) return null;
  return parseNumberOrNull(c);
}

const HEADER_ALIASES: Record<string, keyof PlayerPerformance> = {
  MIN: "minutes",
  MINUTOS: "minutes",
  TOS: "shots",
  CHUTES: "shots",
  SOT: "shotsOnTarget",
  "CHUTES NO GOL": "shotsOnTarget",
  XG: "xG",
  COMP: "competition",
  COMPETICAO: "competition",
  "COMPETIÇÃO": "competition",
  ADV: "opponent",
  ADVERSARIO: "opponent",
  "ADVERSÁRIO": "opponent",
  FC: "foulsCommitted",
  "FALTAS COMETIDAS": "foulsCommitted",
  FS: "foulsSuffered",
  "FALTAS SOFRIDAS": "foulsSuffered",
  DES: "tackles",
  TKL: "tackles",
  DESARMES: "tackles",
};

function normHeader(h: string): keyof PlayerPerformance | "starter" | "homeAway" | null {
  const key = h.trim().toUpperCase().replace(/\./g, "");
  if (key === "TIT" || key === "TITULAR") return "starter";
  if (key === "C/F" || key === "CASA/FORA" || key === "LOCAL") return "homeAway";
  return HEADER_ALIASES[key] ?? null;
}

function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes("|")) return line.split("|").map((c) => c.trim()).filter((_, i, a) => !(i === 0 && a[0] === "") );
  return line.split(/\s{2,}/);
}

function parseJsonImport(text: string, raw: string): ParsedPlayerImport | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const d = data as Record<string, unknown>;
  const perfSrc = (d["performances"] ?? d["atuacoes"] ?? d["ÚLTIMAS 15 ATUAÇÕES"] ?? []) as unknown[];
  const performances: PlayerPerformance[] = (Array.isArray(perfSrc) ? perfSrc : []).map((p) => {
    const r = p as Record<string, unknown>;
    const get = (...keys: string[]) => {
      for (const k of keys) if (r[k] !== undefined) return r[k];
      return undefined;
    };
    const toNum = (v: unknown) =>
      v == null || v === "-" || v === "" ? null : typeof v === "number" ? v : parseNumberOrNull(String(v));
    return {
      competition: (get("competition", "competicao", "COMP") as string) ?? null,
      opponent: (get("opponent", "adversario", "ADV") as string) ?? null,
      homeAway: (get("homeAway", "local") as "casa" | "fora") ?? null,
      starter: (get("starter", "titular") as boolean) ?? null,
      minutes: toNum(get("minutes", "MIN", "min")),
      shots: toNum(get("shots", "TOS", "tos")),
      shotsOnTarget: toNum(get("shotsOnTarget", "SOT", "sot")),
      xG: toNum(get("xG", "xg", "XG")),
      foulsCommitted: toNum(get("foulsCommitted", "FC")),
      foulsSuffered: toNum(get("foulsSuffered", "FS")),
      tackles: toNum(get("tackles", "DES", "TKL")),
      raw: JSON.stringify(p),
    };
  });

  return {
    playerName: (d["playerName"] ?? d["JOGADOR"] ?? d["jogador"] ?? null) as string | null,
    sofascoreId: (d["sofascoreId"] ?? d["SOFASCORE_ID"] ?? null) as string | null,
    url: (d["url"] ?? d["URL"] ?? null) as string | null,
    collectedAt: (d["collectedAt"] ?? d["COLETADO_EM"] ?? null) as string | null,
    team: (d["team"] ?? d["TIME"] ?? null) as string | null,
    competitions: [...new Set(performances.map((p) => p.competition).filter(Boolean) as string[])],
    performances,
    errors: performances.length === 0 ? ["Nenhuma atuação encontrada no JSON."] : [],
    warnings: [],
    rawImport: raw,
  };
}

/**
 * Parser do export textual do coletor SofaScore.
 * Hífen significa ausente e nunca é convertido em zero.
 */
export function parseSofascoreExport(raw: string): ParsedPlayerImport {
  const text = (raw ?? "").trim();
  if (text === "") {
    return {
      playerName: null,
      sofascoreId: null,
      url: null,
      collectedAt: null,
      team: null,
      competitions: [],
      performances: [],
      errors: ["Conteúdo vazio: cole o export da extensão."],
      warnings: [],
      rawImport: raw ?? "",
    };
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    const json = parseJsonImport(text, raw);
    if (json) return json;
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);

  let playerName: string | null = null;
  let sofascoreId: string | null = null;
  let url: string | null = null;
  let collectedAt: string | null = null;
  let team: string | null = null;

  let inPerformances = false;
  let headers: (ReturnType<typeof normHeader>)[] = [];
  const performances: PlayerPerformance[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t === "") continue;

    const kv = t.match(/^([A-ZÇÃÁÉÍÓÚÂÊÔÕ_ ]{3,30})\s*[:=]\s*(.*)$/);
    if (kv && !inPerformances) {
      const key = (kv[1] ?? "").trim().toUpperCase();
      const value = cleanCell(kv[2] ?? "");
      if (key === "JOGADOR") playerName = value;
      else if (key === "SOFASCORE_ID") sofascoreId = value;
      else if (key === "URL") url = value;
      else if (key === "COLETADO_EM") collectedAt = value;
      else if (key === "TIME" || key === "EQUIPE") team = value;
      continue;
    }

    const upper = t.toUpperCase();
    if (/ÚLTIMAS\s+\d+\s+ATUA/.test(upper) || upper.startsWith("ULTIMAS")) {
      inPerformances = true;
      headers = [];
      continue;
    }
    if (upper === "GERAL" || upper.startsWith("FINALIZA") || upper === "ADICIONAL") {
      inPerformances = false;
      continue;
    }

    if (inPerformances) {
      const cells = splitCells(t);
      if (headers.length === 0) {
        const mapped = cells.map(normHeader);
        if (mapped.filter(Boolean).length >= 2) {
          headers = mapped;
          continue;
        }
        warnings.push(`Cabeçalho de atuações não reconhecido: "${t}"`);
        continue;
      }
      if (cells.length < 2) continue;
      const p: PlayerPerformance = {
        competition: null,
        opponent: null,
        homeAway: null,
        starter: null,
        minutes: null,
        shots: null,
        shotsOnTarget: null,
        xG: null,
        foulsCommitted: null,
        foulsSuffered: null,
        tackles: null,
        raw: t,
      };
      headers.forEach((h, i) => {
        if (!h) return;
        const cell = cells[i];
        if (cell === undefined) return;
        const c = cleanCell(cell);
        if (h === "starter") {
          p.starter = c == null ? null : /^(sim|s|titular|1|true)$/i.test(c);
        } else if (h === "homeAway") {
          p.homeAway = c == null ? null : /^(c|casa|h|home)$/i.test(c) ? "casa" : "fora";
        } else if (h === "competition" || h === "opponent") {
          p[h] = c;
        } else {
          (p[h] as number | null) = num(cell);
        }
      });
      performances.push(p);
    }
  }

  if (!playerName) errors.push("Bloco JOGADOR não encontrado.");
  if (performances.length === 0) errors.push("Nenhuma atuação reconhecida (bloco ÚLTIMAS N ATUAÇÕES).");

  const missingMinutes = performances.filter((p) => p.minutes == null).length;
  if (missingMinutes > 0) warnings.push(`${missingMinutes} atuação(ões) sem minutos — tratadas como indisponíveis.`);

  return {
    playerName,
    sofascoreId,
    url,
    collectedAt,
    team,
    competitions: [...new Set(performances.map((p) => p.competition).filter(Boolean) as string[])],
    performances,
    errors,
    warnings,
    rawImport: raw,
  };
}

export function aggregate(
  performances: PlayerPerformance[],
  field: "shots" | "shotsOnTarget" | "foulsCommitted" | "foulsSuffered" | "tackles",
): { count: number | null; minutes: number | null; coverage: number } {
  const valid = performances.filter((p) => p[field] != null && p.minutes != null);
  if (valid.length === 0) return { count: null, minutes: null, coverage: 0 };
  return {
    count: valid.reduce((a, b) => a + (b[field] as number), 0),
    minutes: valid.reduce((a, b) => a + (b.minutes as number), 0),
    coverage: valid.length / performances.length,
  };
}
