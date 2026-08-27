import type { ExtractedPlayerOdd, OddsImageExtractor } from "../domain/types";

export interface SourceImage { id: string; name: string; dataUrl: string }
export interface ParsedComparisonRow { playerName?: string; line?: number; odds: number[] }

const numberValue = (raw: string) => Number(raw.replace(",", "."));

/** Interpreta "Jogador Over 1.5 2.10 2.25 ..." e separa linha de odds. */
export function parseComparisonRow(text: string): ParsedComparisonRow {
  const clean = text.replace(/\s+/g, " ").trim();
  const over = /\bover\s*(\d+(?:[.,]\d+)?)/i.exec(clean);
  if (!over || over.index == null) return { odds: [] };
  const line = numberValue(over[1] ?? "");
  const playerName = clean.slice(0, over.index).replace(/[^\p{L}\p{M}'’.-]+/gu, " ").trim();
  const tail = clean.slice(over.index + over[0].length);
  const odds = [...tail.matchAll(/\b\d{1,3}[.,]\d{1,3}\b/g)]
    .map((match) => numberValue(match[0]))
    .filter((odd) => Number.isFinite(odd) && odd > 1.01 && odd < 100);
  return { playerName: playerName || undefined, line: Number.isFinite(line) ? line : undefined, odds };
}

type TesseractWorker = {
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  recognize(image: string): Promise<{ data: { text: string; confidence: number } }>;
  terminate(): Promise<unknown>;
};

async function createOcrWorker(): Promise<TesseractWorker> {
  const moduleUrl = "https://cdn.jsdelivr.net/npm/tesseract.js@6/+esm";
  const tesseract = (await import(/* @vite-ignore */ moduleUrl)) as {
    createWorker(language: string): Promise<TesseractWorker>;
  };
  const worker = await tesseract.createWorker("eng");
  await worker.setParameters({ tessedit_pageseg_mode: "7", preserve_interword_spaces: "1" });
  return worker;
}

export const browserOddsImageExtractor: OddsImageExtractor = {
  kind: "browser-ocr",
  async extract(images: SourceImage[]): Promise<ExtractedPlayerOdd[]> {
    const worker = await createOcrWorker();
    try {
      const extracted: ExtractedPlayerOdd[] = [];
      for (const image of images) {
        const result = await worker.recognize(image.dataUrl);
        const parsed = parseComparisonRow(result.data.text);
        const confidence = Math.max(0, Math.min(1, result.data.confidence / 100));
        if (parsed.odds.length === 0) {
          extracted.push({ side: "over", confidence, sourceImageId: image.id, playerName: parsed.playerName, line: parsed.line, source: image.name });
          continue;
        }
        parsed.odds.forEach((decimalOdd, index) => extracted.push({
          side: "over", decimalOdd, confidence, sourceImageId: image.id,
          playerName: parsed.playerName, line: parsed.line,
          source: `${image.name} · Casa ${index + 1}`,
        }));
      }
      return extracted;
    } finally { await worker.terminate(); }
  },
};

export const edgeFunctionOddsImageExtractor: OddsImageExtractor = {
  kind: "edge-function",
  async extract(): Promise<ExtractedPlayerOdd[]> {
    throw new Error("Extrator de visão/OCR ainda não conectado ao backend.");
  },
};

export function getOddsImageExtractor(): OddsImageExtractor { return browserOddsImageExtractor; }
