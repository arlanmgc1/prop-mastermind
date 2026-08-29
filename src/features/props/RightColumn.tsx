import { useState } from "react";
import { Panel, Stat, Tag, Chip } from "./ui";
import { Button } from "@/components/ui/button";
import { MARKET_LABELS } from "@/domain/types";
import { odd as fmtOdd, param, pct, signed } from "@/lib/format";
import type { CalcResult } from "./compute";
import type { CalcState } from "./state";
import type { KellyDivisor } from "@/domain/risk/kelly";
import { PlayerLadderGenerator } from "./PlayerLadderGenerator";

const DECISION_TONE = {
  valor: "success",
  neutro: "muted",
  sem_valor: "danger",
} as const;

const DECISION_LABEL = { valor: "Valor", neutro: "Neutro", sem_valor: "Sem valor" } as const;

function EmptyState({ state }: { state: CalcState }) {
  const items = [
    ["Jogador identificado", state.playerName !== ""],
    ["Tipo de prop e linha", state.playerLine != null],
    ["Odd Over oferecida", state.offeredOdd != null],
    [
      "Mercado da equipe com Over e Under",
      state.teamLadder.some((r) => r.oddOver != null && r.oddUnder != null),
    ],
    ["Minutos esperados", state.expectedMinutes != null],
    ["Amostra importada", (state.parsed?.performances.length ?? 0) > 0],
  ] as const;
  return (
    <Panel title="Aguardando cálculo">
      <p className="mb-2 text-xs text-muted-foreground">Entradas necessárias:</p>
      <ul className="space-y-1">
        {items.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-2 text-xs">
            <span className={ok ? "text-success" : "text-muted-foreground"}>{ok ? "●" : "○"}</span>
            <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function RightColumn({
  state,
  result,
  onKellyChange,
  onExport,
}: {
  state: CalcState;
  result: CalcResult | null;
  onKellyChange: (d: KellyDivisor) => void;
  onExport: () => void;
}) {
  const [auditOpen, setAuditOpen] = useState(false);

  if (!result) return <EmptyState state={state} />;

  const c = result.consensus;

  return (
    <div className="space-y-3 pb-8">
      <Panel
        title={
          <span className="flex items-center gap-2">
            {state.playerName || "Jogador"}
            <Tag tone="primary">{MARKET_LABELS[state.market]}</Tag>
          </span>
        }
        badge={<Tag tone={DECISION_TONE[result.decision]}>{DECISION_LABEL[result.decision]}</Tag>}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Fair principal
            </p>
            <p className="num text-5xl font-bold leading-none text-primary">
              {fmtOdd(result.fair)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Over {param(state.playerLine, 1)} ·{" "}
              {state.participation === "substituto_conta" ? "Substituto conta" : "Somente titular"}{" "}
              · {param(result.expectedMinutes, 0)} min
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[11px] text-muted-foreground">Probabilidade final</p>
            <p className="num text-xl">{pct(result.pFinal)}</p>
            <p className="text-[11px] text-muted-foreground">Odd oferecida</p>
            <p className="num text-sm">{fmtOdd(state.offeredOdd)}</p>
            <p className="text-[11px] text-muted-foreground">EV por unidade</p>
            <p
              className={`num text-sm ${(result.ev ?? 0) > 0 ? "text-success" : "text-muted-foreground"}`}
            >
              {pct(result.ev, 1)}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Comparação tripla">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              t: "Modelo puro",
              p: result.pModel,
              o: result.pModel ? 1 / result.pModel : null,
              sub: "Fair",
            },
            {
              t: "Comparativo bruto",
              p: result.pComparable,
              o: c?.consensusOdd ?? null,
              sub: "Consenso",
            },
            { t: "Resultado combinado", p: result.pFinal, o: result.fair, sub: "Fair" },
          ].map((b) => (
            <div key={b.t} className="rounded-lg border border-border bg-secondary p-2.5">
              <p className="text-[11px] text-muted-foreground">{b.t}</p>
              <p className="num text-lg">{pct(b.p)}</p>
              <p className="num text-xs text-muted-foreground">
                {b.sub} {fmtOdd(b.o)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-warning">
          O comparativo é unilateral (apenas Over) e contém margem desconhecida — rotulado como
          consenso bruto
          {result.comparableMethod === "desconto_heuristico"
            ? " com desconto heurístico (hipótese)"
            : " sem desconto"}
          .
        </p>
        {c ? (
          <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            <Stat label="Fontes válidas" value={c.count} />
            <Stat label="Menor odd" value={fmtOdd(c.min)} />
            <Stat label="Maior odd" value={fmtOdd(c.max)} />
            <Stat label="Média (informativa)" value={fmtOdd(c.mean)} />
            <Stat label="Mediana" value={fmtOdd(c.median)} />
            <Stat label="Prob. implícita média" value={pct(c.impliedMean)} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Sem comparativo confirmado — resultado igual ao modelo puro.
          </p>
        )}
        {c && c.removed.length > 0 ? (
          <div className="mt-2 space-y-0.5">
            {c.removed.map((r) => (
              <p key={r.id} className="text-[11px] text-muted-foreground">
                Removida {fmtOdd(r.decimalOdd)} ({r.source || "sem fonte"}): {r.reason}
              </p>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel title="Escada de props">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-xs">
            <thead className="bg-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Linha</th>
                <th className="px-2 py-1.5 text-right">Probabilidade</th>
                <th className="px-2 py-1.5 text-right">Fair</th>
                <th className="px-2 py-1.5 text-right">Odd mercado</th>
                <th className="px-2 py-1.5 text-right">EV</th>
                <th className="px-2 py-1.5 text-left">Decisão</th>
              </tr>
            </thead>
            <tbody>
              {result.ladder.map((r) => {
                const selected =
                  state.playerLine != null && Math.abs(r.line - state.playerLine) < 1e-9;
                return (
                  <tr
                    key={r.line}
                    className={`border-t border-border ${selected ? "bg-primary/10" : ""}`}
                  >
                    <td className="num px-2 py-1.5">
                      Over {param(r.line, 1)}{" "}
                      <span className="text-muted-foreground">({r.label})</span>
                    </td>
                    <td className="num px-2 py-1.5 text-right">{pct(r.pFinal, 3)}</td>
                    <td className={`num px-2 py-1.5 text-right ${selected ? "text-primary" : ""}`}>
                      {fmtOdd(r.fair)}
                    </td>
                    <td className="num px-2 py-1.5 text-right">{fmtOdd(r.marketOdd)}</td>
                    <td className="num px-2 py-1.5 text-right">{pct(r.ev, 1)}</td>
                    <td className="px-2 py-1.5">
                      <Tag tone={DECISION_TONE[r.decision]}>{DECISION_LABEL[r.decision]}</Tag>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <PlayerLadderGenerator state={state} result={result} />

      <Panel title="Detalhes do Cálculo">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Stat
            label="lambda_team"
            value={param(result.lambdaTeam)}
            tip="Média esperada da estatística para a equipe na partida, ajustada às linhas de mercado."
          />
          <Stat
            label="Taxa do jogador por 90"
            value={param(result.playerRate90)}
            tip="90 × contagem total ÷ minutos totais da amostra."
          />
          <Stat
            label="Taxa recente ponderada"
            value={param(result.recentRate90)}
            tip="Taxa por 90 dos jogos recentes, com peso de 35%."
          />
          <Stat
            label="Taxa com shrinkage"
            value={param(result.shrunkRate90)}
            tip="Taxa puxada para o prior quando a amostra é pequena. Sem prior informado, é igual à ponderada."
          />
          <Stat
            label="Share do jogador"
            value={pct(result.playerShare)}
            tip="Indicador histórico para auditoria. Não é mais o multiplicador principal da projeção."
          />
          <Stat
            label="Minutos esperados"
            value={param(result.expectedMinutes, 0)}
            tip="Minutos previstos em campo nesta partida."
          />
          <Stat
            label="μ direto do jogador"
            value={param(result.directMu)}
            tip="Taxa própria do jogador × minutos esperados × ajustes de confronto e função."
          />
          <Stat
            label="Índice de contexto do time"
            value={result.teamContextRatio == null ? "—" : `${param(result.teamContextRatio, 3)}×`}
            tip="lambda do mercado ÷ média histórica. Limitado entre 0,90 e 1,10 antes da ponderação."
          />
          <Stat
            label="Ajuste efetivo do time"
            value={`${signed(result.teamContextMultiplier - 1)} (${pct(result.teamContextWeight)} de peso)`}
            tip="Impacto sobre μ limitado a aproximadamente ±3%."
          />
          <Stat
            label="μ final do jogador"
            value={param(result.muPlayer)}
            accent
            tip="Média direta após o pequeno ajuste de contexto do time."
          />
          <Stat
            label="Dispersão k"
            value={param(result.dispersionK)}
            tip="Var(X) = mu + mu²/k. Sem k, usa-se Poisson."
          />
          <Stat
            label="Distribuição"
            value={result.distribution === "negbin" ? "Binomial negativa" : "Poisson"}
            tip="Distribuição usada para converter mu em probabilidades."
          />
          <Stat
            label="Prob. modelo puro"
            value={pct(result.pModel)}
            tip="Probabilidade do Over pela distribuição, sem comparativo."
          />
          <Stat
            label="Prob. comparativo"
            value={pct(result.pComparable)}
            tip="Consenso bruto das odds de outras fontes — contém margem."
          />
          <Stat
            label="Peso aplicado"
            value={pct(result.blend?.weight ?? 0)}
            tip="Peso do comparativo no blend logit, limitado a 30%."
          />
          <Stat
            label="Probabilidade final"
            value={pct(result.pFinal)}
            accent
            tip="Blend no espaço logit entre modelo e comparativo."
          />
          <Stat
            label="Faixa de incerteza"
            value={
              result.uncertainty
                ? `${pct(result.uncertainty[0])} – ${pct(result.uncertainty[1])}`
                : "—"
            }
            tip="Sensibilidade da probabilidade a uma variação de ±15% em mu_player."
          />
          <Stat
            label="Cobertura dos dados"
            value={pct(result.coverage)}
            tip="Proporção das atuações com a estatística disponível."
          />
          <Stat
            label="Amostra (contagem/minutos)"
            value={`${result.sampleCount ?? "—"} / ${result.sampleMinutes ?? "—"}`}
            tip="Base usada para a taxa por 90."
          />
        </div>
      </Panel>

      <Panel title="Risco">
        <div className="flex flex-wrap items-center gap-1.5">
          {([12, 10, 8, 4] as KellyDivisor[]).map((d) => (
            <Chip key={d} active={state.kellyDivisor === d} onClick={() => onKellyChange(d)}>
              {`1/${d}`}
            </Chip>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          <Stat
            label="Kelly completo"
            value={result.kelly.full == null ? "—" : pct(result.kelly.full)}
          />
          <Stat
            label="Stake sugerida conservadora"
            value={
              result.kelly.suggestedUnits == null
                ? "—"
                : result.kelly.suggestedUnits.toFixed(2) + "u"
            }
            tip="Gestão de 200u: Kelly fracionado selecionado, edge mínimo de 3%, confiança ponderada, piso de 0,25u e teto excepcional de 2u."
          />
          <Stat
            label="Qualidade aplicada"
            value={result.kelly.stakeQuality == null ? "—" : pct(result.kelly.stakeQuality)}
            tip="Média geométrica ponderada de cobertura, amostra, minutos, incerteza e concordância; evita penalização duplicada de fatores correlacionados."
          />
          <Stat
            label="Edge usado na stake"
            value={result.kelly.stakeEdge == null ? "—" : pct(result.kelly.stakeEdge)}
            tip="Abaixo de 3% a stake é zero."
          />
          <Stat
            label="Stake antes do floor/teto"
            value={
              result.kelly.rawSuggestedUnits == null
                ? "—"
                : result.kelly.rawSuggestedUnits.toFixed(2) + "u"
            }
          />
        </div>
        <div className="mt-2 space-y-1">
          {result.coverage < 0.6 ? (
            <p className="text-[11px] text-warning">Cobertura de dados baixa.</p>
          ) : null}
          {state.starter === "incerto" ? (
            <p className="text-[11px] text-warning">Minutos incertos.</p>
          ) : null}
          {c && c.count === 1 ? (
            <p className="text-[11px] text-warning">Comparativo com uma única fonte.</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Gerador de múltiplas não faz parte desta versão.
          </p>
        </div>
      </Panel>

      <Panel
        title={
          <button
            type="button"
            onClick={() => setAuditOpen((v) => !v)}
            className="text-sm font-semibold"
          >
            {auditOpen ? "▾" : "▸"} Auditoria
          </button>
        }
        badge={<Tag tone="muted">{state.modelVersion}</Tag>}
      >
        {auditOpen ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium">
                Proportional margin — probabilidades sem margem da equipe
              </p>
              <div className="space-y-0.5">
                {(result.teamFit?.points ?? []).map((p) => (
                  <div
                    key={p.line}
                    className="num flex justify-between text-[11px] text-muted-foreground"
                  >
                    <span>Over {param(p.line, 1)}</span>
                    <span>
                      {pct(p.pOver)} · overround {pct(p.overround)}
                    </span>
                  </div>
                ))}
                {(result.teamFit?.points.length ?? 0) === 0 ? (
                  <p className="text-[11px] text-muted-foreground">—</p>
                ) : null}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">Mensagens de validação</p>
              {result.messages.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nenhuma.</p>
              ) : (
                result.messages.map((m, i) => (
                  <p
                    key={i}
                    className={`text-[11px] ${m.severity === "erro" ? "text-destructive" : m.severity === "aviso" ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {m.message}
                  </p>
                ))
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">Inputs normalizados</p>
              <pre className="num max-h-56 overflow-auto rounded-lg border border-border bg-background p-2 text-[10px] text-muted-foreground">
                {JSON.stringify(
                  {
                    ...state,
                    parsed: state.parsed?.performances ?? null,
                    images: state.images.length,
                    rawImport: undefined,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
            <Button size="sm" variant="secondary" onClick={onExport}>
              Exportar cálculo JSON
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Inputs normalizados, probabilidades justas, parâmetros e validações.
          </p>
        )}
      </Panel>
    </div>
  );
}
