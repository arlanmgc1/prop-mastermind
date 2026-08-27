import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LeftColumn } from "@/features/props/LeftColumn";
import { RightColumn } from "@/features/props/RightColumn";
import { computeAll, type CalcResult } from "@/features/props/compute";
import {
  clearDraft,
  initialState,
  loadDraft,
  saveDraft,
  type CalcState,
} from "@/features/props/state";
import { validateBeforeCalc } from "@/domain/validation/validators";
import type { KellyDivisor } from "@/domain/risk/kelly";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calculadora de Props — precificação pré-jogo de jogadores" },
      {
        name: "description",
        content:
          "Precificação pré-jogo de props de futebol: remoção de margem, distribuições, escada de linhas, fair odds, EV e Kelly com auditoria completa.",
      },
      {
        property: "og:title",
        content: "Calculadora de Props — precificação pré-jogo de jogadores",
      },
      {
        property: "og:description",
        content:
          "Modelo puro, comparativo de odds e resultado combinado lado a lado, com escada de props, EV e Kelly auditáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [state, setState] = useState<CalcState>(() => initialState());
  const [result, setResult] = useState<CalcResult | null>(null);

  const patch = (p: Partial<CalcState>) => setState((s) => ({ ...s, ...p }));

  const validation = useMemo(
    () =>
      validateBeforeCalc({
        hasPlayer: state.playerName.trim() !== "",
        hasMarket: true,
        hasLine: state.playerLine != null,
        hasOfferedOdd: state.offeredOdd != null,
        hasTeamMarket: state.teamLadder.some((r) => r.oddOver != null && r.oddUnder != null),
        expectedMinutes: state.expectedMinutes,
        starter: state.starter,
      }),
    [state],
  );

  const calculate = () => {
    if (validation.some((v) => v.severity === "erro")) {
      toast.error("Corrija as pendências antes de calcular.");
      return;
    }
    const r = computeAll(state);
    setResult(r);
    if (!r.ok) toast.error("Cálculo incompleto — veja as mensagens de validação.");
  };

  const recalcIfNeeded = (next: CalcState) => {
    if (result) setResult(computeAll(next));
  };

  const exportJson = () => {
    const payload = {
      modelVersion: state.modelVersion,
      inputs: { ...state, images: state.images.map((i) => i.name) },
      result,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calculo-props-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              P
            </div>
            <h1 className="truncate text-sm font-semibold tracking-tight">Calculadora de Props</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setState(initialState());
                setResult(null);
                clearDraft();
              }}
            >
              Novo
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                toast[saveDraft(state) ? "success" : "error"](
                  saveDraft(state) ? "Rascunho salvo localmente." : "Não foi possível salvar.",
                )
              }
            >
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const d = loadDraft();
                if (d) {
                  setState(d);
                  toast.success("Rascunho carregado.");
                } else toast.error("Nenhum rascunho salvo.");
              }}
            >
              Carregar
            </Button>
            <Button size="sm" onClick={exportJson}>
              Exportar
            </Button>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-3 px-3 py-3 lg:h-[calc(100vh-3.25rem)] lg:grid-cols-[42fr_58fr] lg:overflow-hidden">
          <div className="min-w-0 lg:overflow-y-auto lg:pr-1">
            <LeftColumn
              state={state}
              patch={patch}
              onCalculate={calculate}
              onClear={() => setResult(null)}
              validation={validation}
            />
          </div>
          <div className="min-w-0 pb-20 lg:overflow-y-auto lg:pb-0 lg:pr-1">
            <RightColumn
              state={state}
              result={result}
              onKellyChange={(d: KellyDivisor) => {
                const next = { ...state, kellyDivisor: d };
                setState(next);
                recalcIfNeeded(next);
              }}
              onExport={exportJson}
            />
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-background/95 p-2 backdrop-blur lg:hidden">
          <Button className="flex-1" onClick={calculate}>
            Calcular
          </Button>
          <Button variant="secondary" onClick={() => setResult(null)}>
            Limpar
          </Button>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
