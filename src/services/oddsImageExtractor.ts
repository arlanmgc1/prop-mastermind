import type { ExtractedPlayerOdd, OddsImageExtractor } from "../domain/types";

export interface SourceImage {
  id: string;
  name: string;
  dataUrl: string;
}

/**
 * Implementação mock: NÃO faz OCR. Devolve linhas vazias com confiança 0
 * para preenchimento manual na tela de revisão.
 * Nada aqui está conectado a nenhum serviço externo.
 */
export const mockOddsImageExtractor: OddsImageExtractor = {
  kind: "mock",
  async extract(images: SourceImage[]): Promise<ExtractedPlayerOdd[]> {
    await new Promise((r) => setTimeout(r, 350));
    return images.map((img) => ({
      side: "over" as const,
      confidence: 0,
      sourceImageId: img.id,
    }));
  },
};

/**
 * Placeholder para a futura Supabase Edge Function de visão/OCR.
 * Deliberadamente não implementado: nenhuma chave de API pode existir no navegador.
 */
export const edgeFunctionOddsImageExtractor: OddsImageExtractor = {
  kind: "edge-function",
  async extract(): Promise<ExtractedPlayerOdd[]> {
    throw new Error(
      "Extrator de visão/OCR ainda não conectado. Exige uma Edge Function no backend (Lovable Cloud).",
    );
  },
};

export function getOddsImageExtractor(): OddsImageExtractor {
  return mockOddsImageExtractor;
}
