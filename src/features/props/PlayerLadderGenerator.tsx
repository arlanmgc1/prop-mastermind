import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel, Chip } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MARKET_LABELS } from "@/domain/types";
import {
  allocateLadderStakes,
  ladderLabel,
  parsePlayerLadderPaste,
  type PlayerLadderMarketRow,
} from "@/domain/risk/playerLadder";
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
  const [paste, setPaste] = useState("");
  const [markets, setMarkets] = useState<PlayerLadderMarketRow[]>([]);
  const [endLine, setEndLine] = useState<number | null>(null);
  const [step, setStep] = useState<0.25 | 0.5>(0.25);
  const [link, setLink] = useState("");

  const readLadder = () => {
    const parsed = parsePlayerLadderPaste(paste);
    if (parsed.length === 0) {
      toast.error("Nenhuma linha Over reconhecida na escada do jogador.");
      return;
    }
    if (
      state.playerLine == null ||
      Math.abs(parsed[0]!.line - state.playerLine) > 1e-9
    ) {
      toast.error("A primeira linha colada deve ser a linha principal do jogador.");
      return;
    }
    setMarkets(parsed);
    setEndLine(parsed[parsed.length - 1]!.line);
    toast.success(String(parsed.length) + " linhas da escada reconhecidas.");
  };

  const allocations = useMemo(() => {
    const selected = markets.filter((market) => endLine == null || market.line <= endLine);
    const inputs = selected.flatMap((market) => {
      const projection = result.ladder.find(
        (row) => Math.abs(row.line - market.line) < 1e-9,
      );
      return projection
        ? [{ line: market.line, odd: market.oddOver, probability: projection.pFinal }]
        : [];
    });
    return allocateLadderStakes(inputs, step, 2, 3.25);
  }, [endLine, markets, result.ladder, step]);

  const total = allocations.reduce((sum, row) => sum + row.units, 0);
  const generated = useMemo(() => {
    if (allocations.length === 0) return "";
    const lines = [
      (state.playerName || "Jogador") + " - Total de " + MARKET_LABELS[state.market],
      "",
    ];
    allocations
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
    if (link.trim()) {
      lines.push("", link.trim());
    }
    return lines.join("\n");
  }, [allocations, link, state.market, state.playerName]);

  return (
    <Panel title="Montar e distribuir escada do jogador">
      <p className="mb-2 text-[11px] text-muted-foreground">
        Cole a escada começando obrigatoriamente pela linha principal. Aceita várias ocorrências
        de “Mais de linha odd”.
      </p>
      <Textarea
        value={paste}
        onChange={(event) => setPaste(event.target.value)}
        placeholder={"Jovane Cabral Total de Chutes\nMais de 1.5 1.80\nMais de 2.5 2.70\nMais de 3.5 4.20"}
        className="min-h-24 text-xs"
      />
      <Button className="mt-2" size="sm" variant="secondary" onClick={readLadder}>
        Ler escada do jogador
      </Button>

      {markets.length > 0 ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Enviar até a linha</span>
              <select
                value={endLine ?? ""}
                onChange={(event) => setEndLine(Number(event.target.value))}
                className="h-8 w-full rounded-md border border-input bg-secondary px-2"
              >
                {markets.map((market) => (
                  <option key={market.line} value={market.line}>
                    Over {market.line.toFixed(1)} ({ladderLabel(market.line)})
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

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-[10px] uppercase text-muted-foreground">
                <tr><th className="p-2 text-left">Linha</th><th className="p-2 text-right">Odd</th><th className="p-2 text-right">Prob.</th><th className="p-2 text-right">Stake</th></tr>
              </thead>
              <tbody>
                {allocations.map((row) => (
                  <tr key={row.line} className="border-t border-border">
                    <td className="p-2">{ladderLabel(row.line)}</td>
                    <td className="num p-2 text-right">{fmtOdd(row.odd)}</td>
                    <td className="num p-2 text-right">{pct(row.probability)}</td>
                    <td className="num p-2 text-right text-primary">{row.units.toFixed(2)}u</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs">
            Exposição total: <strong className="num text-primary">{total.toFixed(2)}u</strong>
            <span className="text-muted-foreground"> / máximo 3,25u · principal máximo 2u</span>
          </p>
          <Textarea readOnly value={generated} className="min-h-32 text-xs" />
          <Button
            size="sm"
            onClick={() => {
              if (!generated) return;
              void navigator.clipboard.writeText(generated);
              toast.success("Escada copiada.");
            }}
          >
            Copiar escada pronta
          </Button>
          <p className="text-[11px] text-warning">
            Odds apenas Over não permitem remoção de margem; proportional margin exige Over e
            Under da mesma linha.
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
