import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel, Chip } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MARKET_LABELS } from "@/domain/types";
import { distributeEscadaFromMain, ladderLabel } from "@/domain/risk/playerLadder";
import { fairOdd } from "@/domain/risk/expectedValue";
import { odd as fmtOdd, pct } from "@/lib/format";
import type { CalcResult } from "./compute";
import type { CalcState } from "./state";

export function PlayerLadderGenerator({
  state,
  result,
}: {
  state: CalcState;
  result: CalcResult;
}) {
  const available = result.ladder.filter(
    (row) => state.playerLine != null && row.line >= state.playerLine,
  );
  const defaultEnd = available[Math.min(2, Math.max(0, available.length - 1))]?.line ?? null;
  const [endLine, setEndLine] = useState<number | null>(defaultEnd);
  const [step, setStep] = useState<0.25 | 0.5>(0.25);
  const [link, setLink] = useState("");

  const selected = available.filter((row) => endLine == null || row.line <= endLine);
  const distributed = useMemo(
    () =>
      distributeEscadaFromMain(
        selected.map((row) => row.line),
        result.kelly.suggestedUnits ?? 0,
        step,
        3.25,
      ),
    [result.kelly.suggestedUnits, selected.map((row) => row.line).join("|"), step],
  );
  const total = distributed.reduce((sum, row) => sum + row.units, 0);

  const generated = useMemo(() => {
    if (distributed.length === 0) return "";
    const lines = [
      (state.playerName || "Jogador") + " - Total de " + MARKET_LABELS[state.market],
      "",
    ];
    distributed
      .filter((row) => row.units > 0)
      .forEach((row) => {
        lines.push(
          row.units.toFixed(2) +
            "u - " +
            ladderLabel(row.line) +
            " " +
            MARKET_LABELS[state.market],
        );
      });
    if (link.trim()) lines.push("", link.trim());
    return lines.join("\n");
  }, [distributed, link, state.market, state.playerName]);

  if (available.length === 0) return null;

  return (
    <Panel title="Escada pronta para copiar">
      <p className="mb-3 text-[11px] text-muted-foreground">
        Gerada automaticamente a partir da linha principal e das probabilidades do modelo. O
        comparativo influencia somente a primeira linha.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Enviar até a linha</span>
          <select
            value={endLine ?? ""}
            onChange={(event) => setEndLine(Number(event.target.value))}
            className="h-8 w-full rounded-md border border-input bg-secondary px-2"
          >
            {available.map((row) => (
              <option key={row.line} value={row.line}>
                Over {row.line.toFixed(1)} ({ladderLabel(row.line)})
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs">
          <span className="mb-1 block text-muted-foreground">Passo da stake</span>
          <div className="flex gap-1">
            <Chip active={step === 0.25} onClick={() => setStep(0.25)}>0,25u</Chip>
            <Chip active={step === 0.5} onClick={() => setStep(0.5)}>0,50u</Chip>
          </div>
        </div>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Link da escada</span>
          <Input value={link} onChange={(event) => setLink(event.target.value)} className="h-8" />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-secondary text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Linha</th>
              <th className="p-2 text-right">Probabilidade</th>
              <th className="p-2 text-right">Fair</th>
              <th className="p-2 text-right">Stake distribuída</th>
            </tr>
          </thead>
          <tbody>
            {distributed.map((stake) => {
              const row = selected.find((item) => Math.abs(item.line - stake.line) < 1e-9);
              return (
                <tr key={stake.line} className="border-t border-border">
                  <td className="p-2">{ladderLabel(stake.line)}</td>
                  <td className="num p-2 text-right">{pct(row?.pFinal ?? null)}</td>
                  <td className="num p-2 text-right">{fmtOdd(fairOdd(row?.pFinal ?? null))}</td>
                  <td className="num p-2 text-right text-primary">{stake.units.toFixed(2)}u</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs">
        Exposição total: <strong className="num text-primary">{total.toFixed(2)}u</strong>
        <span className="text-muted-foreground"> / máximo 3,25u · principal máximo 2u</span>
      </p>
      <Textarea readOnly value={generated} className="mt-2 min-h-32 text-xs" />
      <Button
        className="mt-2"
        size="sm"
        disabled={!generated || total <= 0}
        onClick={() => {
          void navigator.clipboard.writeText(generated);
          toast.success("Escada copiada.");
        }}
      >
        Copiar escada pronta
      </Button>
      {total <= 0 ? (
        <p className="mt-2 text-[11px] text-warning">
          A linha principal não recebeu stake positiva; a escada não deve ser enviada.
        </p>
      ) : null}
    </Panel>
  );
}
