import { useRef, useState } from "react";
import { toast } from "sonner";
import { Panel, Chip, Field, Tag } from "./ui";
import { NumInput } from "./NumInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MARKET_LABELS, type LadderRow, type MarketType, type PlayerRole } from "@/domain/types";
import { parseSofascoreExport } from "@/services/sofascoreImportParser";
import { getOddsImageExtractor } from "@/services/oddsImageExtractor";
import { parseNumberOrNull } from "@/domain/validation/validators";
import { buildConsensus } from "@/domain/odds/consensus";
import type { CalcState, ReviewedOdd } from "./state";
import { emptyLadderRow } from "./state";
import { autoMinutes } from "./compute";
import {
  DEMO_COMPARISON_ODDS,
  DEMO_SOFASCORE_EXPORT,
  DEMO_TEAM_BASELINE_RATE90,
  DEMO_TEAM_LADDER,
} from "./demoData";
import { odd as fmtOdd, param, pct } from "@/lib/format";

type Patch = (p: Partial<CalcState>) => void;

const ROLES: PlayerRole[] = ["ST", "SA", "Ponta", "Meia", "Volante", "Lateral", "Zagueiro"];
const MARKETS = Object.keys(MARKET_LABELS) as MarketType[];

function LadderTable({
  rows,
  onChange,
  label,
  single,
}: {
  rows: LadderRow[];
  onChange: (rows: LadderRow[]) => void;
  label: string;
  single?: boolean;
}) {
  const [paste, setPaste] = useState("");
  const update = (id: string, patch: Partial<LadderRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const applyPaste = () => {
    const parsed: LadderRow[] = [];
    for (const line of paste.split(/\r?\n/)) {
      const cells = line
        .split(/[\t;,|]|\s{2,}/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 2) continue;
      const l = parseNumberOrNull(cells[0]);
      if (l == null) continue;
      parsed.push({
        id: crypto.randomUUID(),
        line: l,
        oddOver: parseNumberOrNull(cells[1]),
        oddUnder: parseNumberOrNull(cells[2] ?? null),
      });
    }
    if (parsed.length === 0) {
      toast.error("Nenhuma linha reconhecida. Use: linha, odd Over, odd Under.");
      return;
    }
    onChange([...rows, ...parsed]);
    setPaste("");
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Linha</th>
              <th className="px-2 py-1.5 text-left font-medium">Odd Over</th>
              <th className="px-2 py-1.5 text-left font-medium">Odd Under</th>
              <th className="px-2 py-1.5 text-right font-medium">Prob. Over s/ margem</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                  Sem linhas para {label.toLowerCase()}.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const q =
                r.oddOver != null && r.oddUnder != null
                  ? 1 / r.oddOver / (1 / r.oddOver + 1 / r.oddUnder)
                  : null;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-1.5 py-1">
                    <NumInput
                      value={r.line}
                      onChange={(v) => update(r.id, { line: v ?? r.line })}
                      ariaLabel="Linha"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <NumInput
                      value={r.oddOver}
                      onChange={(v) => update(r.id, { oddOver: v })}
                      ariaLabel="Odd Over"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <NumInput
                      value={r.oddUnder}
                      onChange={(v) => update(r.id, { oddUnder: v })}
                      ariaLabel="Odd Under"
                    />
                  </td>
                  <td className="num px-2 py-1 text-right text-muted-foreground">{pct(q)}</td>
                  <td className="px-1 py-1 text-right">
                    <button
                      type="button"
                      aria-label="Remover linha"
                      onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip
          onClick={() =>
            onChange([...rows, emptyLadderRow(rows.length ? rows[rows.length - 1]!.line + 1 : 0.5)])
          }
        >
          Adicionar linha
        </Chip>
        {!single && (
          <>
            <Chip onClick={() => onChange([...rows].sort((a, b) => a.line - b.line))}>Ordenar</Chip>
            <Chip
              onClick={() => {
                const seen = new Set<number>();
                onChange(rows.filter((r) => (seen.has(r.line) ? false : (seen.add(r.line), true))));
              }}
            >
              Remover duplicadas
            </Chip>
          </>
        )}
      </div>
      {!single && (
        <div className="flex gap-1.5">
          <Input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Colar tabela: 10,5  1,70  2,15"
            className="h-8 text-xs"
          />
          <Button size="sm" variant="secondary" onClick={applyPaste}>
            Colar tabela
          </Button>
        </div>
      )}
    </div>
  );
}

export function LeftColumn({
  state,
  patch,
  onCalculate,
  onClear,
  validation,
}: {
  state: CalcState;
  patch: Patch;
  onCalculate: () => void;
  onClear: () => void;
  validation: { severity: string; message: string }[];
}) {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isShots = state.market === "shots";
  const isSot = state.market === "shots_on_target";
  const singleLineMarket = !isShots && !isSot;

  const doImport = (raw: string) => {
    const parsed = parseSofascoreExport(raw);
    setImportErrors(parsed.errors);
    if (parsed.errors.length > 0) {
      setImportStatus(null);
      patch({ rawImport: raw, parsed: null });
      return;
    }
    const next: Partial<CalcState> = {
      rawImport: raw,
      parsed,
      playerName: parsed.playerName ?? state.playerName,
      team: parsed.team ?? state.team,
      competition: parsed.competitions[0] ?? state.competition,
    };
    patch(next);
    const auto = autoMinutes({ ...state, ...next } as CalcState);
    if (state.minutesMode === "auto") {
      patch({ expectedMinutes: auto.minutes, minutesLow: auto.low, minutesHigh: auto.high });
    }
    setImportStatus(
      `${parsed.playerName} · ${parsed.competitions.length} competição(ões) · ${parsed.performances.length} atuação(ões)`,
    );
    toast.success("Importação reconhecida.");
  };

  const addImages = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => /image\/(png|jpeg|webp)/.test(f.type));
    if (arr.length === 0) return;
    const loaded = await Promise.all(
      arr.map(
        (f) =>
          new Promise<{ id: string; name: string; dataUrl: string }>((res) => {
            const r = new FileReader();
            r.onload = () =>
              res({ id: crypto.randomUUID(), name: f.name, dataUrl: String(r.result) });
            r.readAsDataURL(f);
          }),
      ),
    );
    patch({ images: [...state.images, ...loaded], comparisonConfirmed: false });
  };

  const readOdds = async () => {
    setExtractError(null);
    if (state.images.length === 0) {
      setExtractError("Adicione ao menos um print.");
      return;
    }
    setReading(true);
    try {
      const extractor = getOddsImageExtractor();
      const out = await extractor.extract(state.images);
      const reviewed: ReviewedOdd[] = out.map((o) => ({
        ...o,
        id: crypto.randomUUID(),
        include: o.decimalOdd != null && o.decimalOdd > 1,
        isTargetOdd: false,
        market: o.market ?? state.market,
        line: o.line ?? state.playerLine ?? undefined,
        playerName: o.playerName ?? state.playerName,
        source: o.source ?? state.images.find((i) => i.id === o.sourceImageId)?.name,
      }));
      patch({ extracted: [...state.extracted, ...reviewed], comparisonConfirmed: false });
      toast.success("Odds reconhecidas no print.", {
        description: "Revise a linha e todas as casas antes de confirmar o comparativo.",
      });
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Falha na leitura.");
    } finally {
      setReading(false);
    }
  };

  const updateExtracted = (id: string, p: Partial<ReviewedOdd>) =>
    patch({
      extracted: state.extracted.map((o) => (o.id === id ? { ...o, ...p } : o)),
      comparisonConfirmed: false,
    });

  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const o of state.extracted) {
    const key = `${o.sourceImageId}|${o.market}|${o.line}|${o.decimalOdd}`;
    if (seen.has(key)) duplicates.add(o.id);
    seen.add(key);
  }

  const comparisonPreview = buildConsensus(
    state.extracted
      .filter((o) => o.include && o.decimalOdd != null &&
        (o.market == null || o.market === state.market) &&
        (o.line == null || (state.playerLine != null && Math.abs(o.line - state.playerLine) < 1e-9)))
      .map((o) => ({ id: o.id, source: o.source, decimalOdd: o.decimalOdd ?? null, isTargetOdd: o.isTargetOdd })),
    { excludeTargetOdd: true },
  );

  const loadDemo = () => {
    doImport(DEMO_SOFASCORE_EXPORT);
    patch({
      isDemo: true,
      market: "shots",
      playerLine: 1.5,
      offeredOdd: 1.85,
      teamLadder: DEMO_TEAM_LADDER.map((r) => ({ id: crypto.randomUUID(), ...r })),
      extraPlayerOdds: DEMO_COMPARISON_ODDS.map((o) => ({ id: crypto.randomUUID(), ...o })),
      dispersionK: 18,
      teamBaselineRate90: DEMO_TEAM_BASELINE_RATE90,
    });
  };

  return (
    <div className="space-y-3">
      {/* Card A */}
      <Panel title="Dados do Jogador" badge={<Tag tone="primary">{state.modelVersion}</Tag>}>
        <div className="panel-dashed space-y-2 p-3">
          <p className="text-xs font-medium text-primary">
            Dados por competição (SofaScore) — cole o export do coletor, a tabela ou o JSON
          </p>
          <Textarea
            value={state.rawImport}
            onChange={(e) => patch({ rawImport: e.target.value })}
            rows={6}
            placeholder="Cole aqui o export da extensão SofaScore (JSON, TSV ou texto)"
            className="num resize-y bg-background text-[11px]"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => doImport(state.rawImport)}>
              Importar jogador
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                toast.info(
                  "Importação em lote: disponível quando a extensão exportar múltiplos jogadores.",
                )
              }
            >
              Importar lote
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                patch({ rawImport: "", parsed: null });
                setImportStatus(null);
                setImportErrors([]);
              }}
            >
              Limpar
            </Button>
            <Button size="sm" variant="ghost" onClick={loadDemo}>
              Carregar demo
            </Button>
          </div>
          {importStatus ? <p className="text-xs text-success">{importStatus}</p> : null}
          {importErrors.map((e) => (
            <p key={e} className="text-xs text-destructive">
              {e}
            </p>
          ))}
          {state.parsed?.warnings.map((w) => (
            <p key={w} className="text-xs text-warning">
              {w}
            </p>
          ))}
          {state.isDemo ? <Tag tone="warning">Dados demonstrativos (fictícios)</Tag> : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Jogador">
            <Input
              value={state.playerName}
              onChange={(e) => patch({ playerName: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Time">
            <Input
              value={state.team}
              onChange={(e) => patch({ team: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Adversário">
            <Input
              value={state.opponent}
              onChange={(e) => patch({ opponent: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Competição">
            <Input
              value={state.competition}
              onChange={(e) => patch({ competition: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
        </div>

        <div className="mt-3 space-y-2">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Posição / função
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <Chip key={r} active={state.role === r} onClick={() => patch({ role: r })}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Titularidade esperada
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["titular", "reserva", "incerto"] as const).map((s) => (
                <Chip key={s} active={state.starter === s} onClick={() => patch({ starter: s })}>
                  {s[0]!.toUpperCase() + s.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Minutagem esperada
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip
                active={state.minutesMode === "auto"}
                onClick={() => {
                  const a = autoMinutes(state);
                  patch({
                    minutesMode: "auto",
                    expectedMinutes: a.minutes,
                    minutesLow: a.low,
                    minutesHigh: a.high,
                  });
                }}
              >
                Automática
              </Chip>
              <Chip
                active={state.minutesMode === "manual"}
                onClick={() => patch({ minutesMode: "manual" })}
              >
                Manual
              </Chip>
              <div className="w-20">
                <NumInput
                  value={state.expectedMinutes}
                  onChange={(v) => patch({ expectedMinutes: v, minutesMode: "manual" })}
                  ariaLabel="Minutos esperados"
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                intervalo {state.minutesLow ?? "—"}–{state.minutesHigh ?? "—"} min
              </span>
            </div>
          </div>
        </div>

        {state.parsed ? (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-secondary p-2 text-[11px]">
            <div>
              <p className="text-muted-foreground">Amostra</p>
              <p className="num">{state.parsed.performances.length} jogos</p>
            </div>
            <div>
              <p className="text-muted-foreground">Minutos</p>
              <p className="num">
                {state.parsed.performances.reduce((a, b) => a + (b.minutes ?? 0), 0)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Competições</p>
              <p className="num">{state.parsed.competitions.length}</p>
            </div>
          </div>
        ) : null}
      </Panel>

      {/* Card B */}
      <Panel title="Mercado do prop">
        <div className="flex flex-wrap gap-1.5">
          {MARKETS.map((m) => (
            <Chip
              key={m}
              active={state.market === m}
              onClick={() => patch({ market: m, comparisonConfirmed: false })}
            >
              {MARKET_LABELS[m]}
            </Chip>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Linha do jogador">
            <NumInput
              value={state.playerLine}
              onChange={(v) => patch({ playerLine: v })}
              placeholder="1,5"
            />
          </Field>
          <Field label="Odd Over disponível">
            <NumInput
              value={state.offeredOdd}
              onChange={(v) => patch({ offeredOdd: v })}
              placeholder="1,85"
            />
          </Field>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Regra de participação
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={state.participation === "substituto_conta"}
              onClick={() => patch({ participation: "substituto_conta" })}
            >
              Substituto conta
            </Chip>
            <Chip
              active={state.participation === "somente_titular"}
              onClick={() => patch({ participation: "somente_titular" })}
            >
              Somente titular
            </Chip>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {state.extraPlayerOdds.map((o) => (
            <div
              key={o.id}
              className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-1.5"
            >
              <Input
                value={o.source}
                placeholder="Fonte"
                onChange={(e) =>
                  patch({
                    extraPlayerOdds: state.extraPlayerOdds.map((x) =>
                      x.id === o.id ? { ...x, source: e.target.value } : x,
                    ),
                  })
                }
                className="h-8 text-xs"
              />
              <NumInput
                value={o.odd}
                onChange={(v) =>
                  patch({
                    extraPlayerOdds: state.extraPlayerOdds.map((x) =>
                      x.id === o.id ? { ...x, odd: v } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  patch({ extraPlayerOdds: state.extraPlayerOdds.filter((x) => x.id !== o.id) })
                }
                className="px-1 text-muted-foreground hover:text-destructive"
                aria-label="Remover odd"
              >
                ×
              </button>
            </div>
          ))}
          <Chip
            onClick={() =>
              patch({
                extraPlayerOdds: [
                  ...state.extraPlayerOdds,
                  { id: crypto.randomUUID(), source: "", odd: null },
                ],
              })
            }
          >
            Adicionar outra odd desta linha
          </Chip>
        </div>
      </Panel>

      {/* Card C */}
      <Panel title={`Mercado da equipe/jogo — ${MARKET_LABELS[state.market]}`}>
        <p className="mb-2 text-[11px] text-muted-foreground">
          {isShots
            ? "Escada completa de chutes do time (ex.: 8,5 a 20,5). Todas as linhas são usadas no ajuste."
            : isSot
              ? "Escada ou linha única de chutes no gol. Sem dados, use a distribuição de chutes e a taxa SOT/chute."
              : "Linha única do time, do adversário e do total do jogo. O total NÃO é dividido ao meio; serve como verificação de coerência."}
        </p>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium">Time do jogador</p>
            <LadderTable
              rows={state.teamLadder}
              onChange={(rows) => patch({ teamLadder: rows })}
              label="o time"
              single={singleLineMarket}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">Adversário (opcional)</p>
            <LadderTable
              rows={state.opponentLadder}
              onChange={(rows) => patch({ opponentLadder: rows })}
              label="o adversário"
              single={singleLineMarket}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">Total do jogo (opcional)</p>
            <LadderTable
              rows={state.gameLadder}
              onChange={(rows) => patch({ gameLadder: rows })}
              label="o total do jogo"
              single={singleLineMarket}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="Média histórica do time/90"
              hint="Obrigatória para o share automático. Não use a linha do jogo atual."
            >
              <NumInput
                value={state.teamBaselineRate90}
                onChange={(v) => patch({ teamBaselineRate90: v })}
              />
            </Field>
            <Field
              label="Dispersão k (opcional)"
              hint="Sem k, o cálculo cai para Poisson com aviso."
            >
              <NumInput value={state.dispersionK} onChange={(v) => patch({ dispersionK: v })} />
            </Field>
            <Field label="Distribuição">
              <div className="flex gap-1.5">
                <Chip
                  active={state.distribution === "negbin"}
                  onClick={() => patch({ distribution: "negbin" })}
                >
                  Bin. negativa
                </Chip>
                <Chip
                  active={state.distribution === "poisson"}
                  onClick={() => patch({ distribution: "poisson" })}
                >
                  Poisson
                </Chip>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Mult. confronto">
              <NumInput
                value={state.matchupMultiplier}
                onChange={(v) => patch({ matchupMultiplier: v })}
              />
            </Field>
            <Field label="Mult. função">
              <NumInput
                value={state.roleMultiplier}
                onChange={(v) => patch({ roleMultiplier: v })}
              />
            </Field>
            <Field label="Share manual" hint="Vazio = share por regra.">
              <NumInput
                value={state.playerShareOverride}
                onChange={(v) => patch({ playerShareOverride: v })}
              />
            </Field>
          </div>
        </div>
      </Panel>

      {/* Card D */}
      <Panel
        title="Comparativo de Odds do Jogador"
        dashed
        badge={<Tag tone="success">OCR local</Tag>}
      >
        <p className="mb-2 text-[11px] text-muted-foreground">
          Envie o recorte da primeira linha do jogador. O sistema lê a linha Over e todas as odds das casas exibidas no mesmo print.
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void addImages(e.dataTransfer.files);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) void addImages(files);
          }}
          tabIndex={0}
          className="rounded-xl border border-dashed border-primary/60 bg-background/40 p-4 text-center text-xs text-muted-foreground outline-none focus:border-primary"
        >
          Arraste prints aqui, cole da área de transferência (Ctrl+V) ou
          <button
            type="button"
            className="mx-1 text-primary underline"
            onClick={() => fileRef.current?.click()}
          >
            selecione arquivos
          </button>
          (PNG, JPG, WebP)
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => e.target.files && void addImages(e.target.files)}
          />
        </div>

        {state.images.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {state.images.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-16 w-24 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  aria-label="Remover print"
                  onClick={() =>
                    patch({
                      images: state.images.filter((i) => i.id !== img.id),
                      extracted: state.extracted.filter((o) => o.sourceImageId !== img.id),
                      comparisonConfirmed: false,
                    })
                  }
                  className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => void readOdds()} disabled={reading}>
            {reading ? "Lendo linha e odds…" : "Ler linha completa do print"}
          </Button>
          <Chip
            onClick={() =>
              patch({
                extracted: [
                  ...state.extracted,
                  {
                    id: crypto.randomUUID(),
                    side: "over",
                    confidence: 0,
                    sourceImageId: "manual",
                    include: true,
                    isTargetOdd: false,
                    market: state.market,
                    line: state.playerLine ?? undefined,
                    playerName: state.playerName,
                    source: "",
                  },
                ],
                comparisonConfirmed: false,
              })
            }
          >
            Adicionar linha manual
          </Chip>
        </div>
        {extractError ? <p className="mt-1 text-xs text-destructive">{extractError}</p> : null}

        {state.extracted.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium">Revisão das odds extraídas</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[42rem] text-xs">
                <thead className="bg-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Incluir</th>
                    <th className="px-2 py-1.5 text-left">Fonte/casa</th>
                    <th className="px-2 py-1.5 text-left">Jogador</th>
                    <th className="px-2 py-1.5 text-left">Mercado</th>
                    <th className="px-2 py-1.5 text-left">Linha</th>
                    <th className="px-2 py-1.5 text-left">Odd Over</th>
                    <th className="px-2 py-1.5">Alvo</th>
                    <th className="px-2 py-1.5 text-right">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {state.extracted.map((o) => {
                    const mismatch =
                      (o.market != null && o.market !== state.market) ||
                      (o.line != null &&
                        state.playerLine != null &&
                        Math.abs(o.line - state.playerLine) > 1e-9) ||
                      (o.playerName != null &&
                        state.playerName !== "" &&
                        o.playerName.trim() !== state.playerName.trim());
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={o.include}
                            onChange={(e) => updateExtracted(o.id, { include: e.target.checked })}
                            aria-label="Incluir odd"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={o.source ?? ""}
                            onChange={(e) => updateExtracted(o.id, { source: e.target.value })}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={o.playerName ?? ""}
                            onChange={(e) => updateExtracted(o.id, { playerName: e.target.value })}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <select
                            value={o.market ?? ""}
                            onChange={(e) =>
                              updateExtracted(o.id, { market: e.target.value as MarketType })
                            }
                            className="h-7 w-full rounded-md border border-input bg-secondary px-1 text-xs"
                          >
                            {MARKETS.map((m) => (
                              <option key={m} value={m}>
                                {MARKET_LABELS[m]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1 w-20">
                          <NumInput
                            value={o.line ?? null}
                            onChange={(v) => updateExtracted(o.id, { line: v ?? undefined })}
                          />
                        </td>
                        <td className="px-1 py-1 w-20">
                          <NumInput
                            value={o.decimalOdd ?? null}
                            onChange={(v) => updateExtracted(o.id, { decimalOdd: v ?? undefined })}
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={o.isTargetOdd}
                            onChange={(e) =>
                              updateExtracted(o.id, { isTargetOdd: e.target.checked })
                            }
                            aria-label="Marcar como odd-alvo"
                          />
                        </td>
                        <td className="num px-2 py-1 text-right text-muted-foreground">
                          {pct(o.confidence, 0)}
                          {mismatch ? <span className="ml-1 text-warning">⚠</span> : null}
                          {duplicates.has(o.id) ? (
                            <span className="ml-1 text-destructive">dup</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {comparisonPreview.count > 0 ? (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:grid-cols-3">
                <div><p className="text-[10px] text-muted-foreground">Casas válidas</p><p className="num text-base text-primary">{comparisonPreview.count}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Média das odds</p><p className="num text-base text-primary">{fmtOdd(comparisonPreview.mean)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Consenso probabilístico</p><p className="num text-base">{fmtOdd(comparisonPreview.consensusOdd)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Menor odd</p><p className="num text-sm">{fmtOdd(comparisonPreview.min)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Maior odd</p><p className="num text-sm">{fmtOdd(comparisonPreview.max)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Prob. média</p><p className="num text-sm">{pct(comparisonPreview.impliedMean)}</p></div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => patch({ comparisonConfirmed: true })}>
                Confirmar comparativo
              </Button>
              {state.comparisonConfirmed ? (
                <Tag tone="success">Comparativo confirmado</Tag>
              ) : (
                <Tag tone="warning">Não confirmado — não entra no cálculo</Tag>
              )}
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Consenso unilateral é <strong>consenso bruto</strong>: contém margem desconhecida e não
          está “sem margem”.
        </p>
      </Panel>

      {/* Card E */}
      <Panel title="Influência do comparativo">
        <div className="flex items-center justify-between text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-muted-foreground">Peso do comparativo</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              Peso provisório; deverá ser calibrado com histórico.
            </TooltipContent>
          </Tooltip>
          <span className="num text-primary">{pct(state.comparisonWeight, 1)}</span>
        </div>
        <Slider
          className="mt-2"
          value={[state.comparisonWeight * 100]}
          min={0}
          max={30}
          step={1}
          onValueChange={([v]) => patch({ comparisonWeight: (v ?? 0) / 100 })}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Aplicar desconto heurístico de margem unilateral
          </span>
          <Switch
            checked={state.useHeuristicDiscount}
            onCheckedChange={(v) => patch({ useHeuristicDiscount: v })}
          />
        </div>
        {state.useHeuristicDiscount ? (
          <div className="mt-2 space-y-1">
            <Field label="Desconto heurístico (%)">
              <NumInput
                value={state.heuristicDiscount * 100}
                onChange={(v) => patch({ heuristicDiscount: v == null ? 0 : v / 100 })}
              />
            </Field>
            <p className="text-[11px] text-warning">
              Hipótese não calibrada: o desconto assume margem unilateral de{" "}
              {param(state.heuristicDiscount * 100, 1)}%.
            </p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip onClick={() => patch({ comparisonWeight: 0 })}>Ver com peso 0% (auditoria)</Chip>
          <Chip onClick={() => patch({ comparisonWeight: 0.15 })}>Peso padrão 15%</Chip>
        </div>
      </Panel>

      {validation.length > 0 ? (
        <div className="card-surface space-y-1 p-3">
          {validation.map((v, i) => (
            <p
              key={i}
              className={
                v.severity === "erro"
                  ? "text-xs text-destructive"
                  : v.severity === "aviso"
                    ? "text-xs text-warning"
                    : "text-xs text-muted-foreground"
              }
            >
              {v.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 pb-4">
        <Button className="flex-1" onClick={onCalculate}>
          Calcular jogador
        </Button>
        <Button variant="secondary" onClick={onClear}>
          Limpar cálculo
        </Button>
      </div>

      <p className="pb-6 text-[11px] text-muted-foreground">
        Odd consenso atual das fontes manuais:{" "}
        <span className="num">
          {fmtOdd(
            state.extraPlayerOdds.filter((o) => o.odd != null).length
              ? 1 /
                  (state.extraPlayerOdds
                    .filter((o) => o.odd != null)
                    .reduce((a, b) => a + 1 / (b.odd as number), 0) /
                    state.extraPlayerOdds.filter((o) => o.odd != null).length)
              : null,
          )}
        </span>
      </p>
    </div>
  );
}
