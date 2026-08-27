import type { LadderRow } from "../types";
import { removeMargin } from "../odds/removeMargin";

export type Severity = "erro" | "aviso" | "info";

export interface ValidationMessage {
  severity: Severity;
  message: string;
  field?: string;
}

export function isMissing(v: unknown): boolean {
  return v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

/** Converte texto para número ou null. Hífen/vazio = null, nunca zero. */
export function parseNumberOrNull(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(",", ".");
  if (t === "" || t === "-" || t === "—" || t.toLowerCase() === "n/a") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function validateLadder(rows: LadderRow[], label: string): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  const seen = new Set<number>();
  const fair: { line: number; p: number }[] = [];

  for (const r of rows) {
    if (seen.has(r.line)) msgs.push({ severity: "aviso", message: `${label}: linha ${r.line} duplicada.` });
    seen.add(r.line);
    if (r.oddOver == null || r.oddUnder == null) {
      msgs.push({ severity: "aviso", message: `${label}: linha ${r.line} com odds faltantes.` });
      continue;
    }
    const f = removeMargin(r.oddOver, r.oddUnder);
    if (f.overround != null && f.overround > 0.15) {
      msgs.push({
        severity: "aviso",
        message: `${label}: overround extremo na linha ${r.line} (${(f.overround * 100).toFixed(1)}%).`,
      });
    }
    if (f.pOver != null) fair.push({ line: r.line, p: f.pOver });
  }

  fair.sort((a, b) => a.line - b.line);
  for (let i = 1; i < fair.length; i++) {
    if (fair[i].p > fair[i - 1].p) {
      msgs.push({
        severity: "aviso",
        message: `${label}: curva não monotônica entre ${fair[i - 1].line} e ${fair[i].line}.`,
      });
    }
  }
  return msgs;
}

export interface PreCalcInput {
  hasPlayer: boolean;
  hasMarket: boolean;
  hasLine: boolean;
  hasOfferedOdd: boolean;
  hasTeamMarket: boolean;
  expectedMinutes: number | null;
  starter: string;
}

export function validateBeforeCalc(i: PreCalcInput): ValidationMessage[] {
  const m: ValidationMessage[] = [];
  if (!i.hasPlayer) m.push({ severity: "erro", message: "Informe o jogador." });
  if (!i.hasMarket) m.push({ severity: "erro", message: "Selecione o tipo de prop." });
  if (!i.hasLine) m.push({ severity: "erro", message: "Informe a linha do jogador." });
  if (!i.hasTeamMarket)
    m.push({ severity: "erro", message: "Informe ao menos uma linha de mercado da equipe." });
  if (!i.hasOfferedOdd)
    m.push({ severity: "aviso", message: "Sem odd Over oferecida não há EV nem Kelly." });
  if (i.expectedMinutes == null)
    m.push({ severity: "erro", message: "Minutos esperados indisponíveis." });
  if (i.starter === "incerto")
    m.push({ severity: "aviso", message: "Titularidade incerta — minutos pouco confiáveis." });
  return m;
}
