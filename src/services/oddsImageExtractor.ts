import type { ExtractedPlayerOdd, OddsImageExtractor } from "../domain/types";

export interface SourceImage { id: string; name: string; dataUrl: string }
export interface ParsedComparisonRow { playerName?: string; line?: number; odds: number[] }

const numberValue = (raw: string) => Number(raw.replace(",", "."));

export function extractDecimalOdds(text: string, line?: number): number[] {
  const candidates = [...text.matchAll(/\b\d{1,2}(?:[.,]\d{1,3})?\b/g)]
    .map((match) => numberValue(match[0]))
    .filter((value) => Number.isFinite(value) && value > 1.01 && value < 100);
  if (line == null) return candidates;
  const lineIndex = candidates.findIndex((value) => Math.abs(value - line) < 1e-9);
  return candidates.filter((_, index) => index !== lineIndex);
}

export function parseComparisonRow(text: string): ParsedComparisonRow {
  const clean = text.replace(/\s+/g, " ").trim();
  const over = /\bover\s*(\d+(?:[.,]\d+)?)/i.exec(clean);
  if (!over || over.index == null) return { odds: [] };
  const line = numberValue(over[1] ?? "");
  const playerName = clean.slice(0, over.index).replace(/[^\p{L}\p{M}'’.-]+/gu, " ").trim();
  return { playerName: playerName || undefined, line: Number.isFinite(line) ? line : undefined, odds: extractDecimalOdds(clean, line) };
}

type TesseractWorker = {
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  recognize(image: string): Promise<{ data: { text: string; confidence: number } }>;
  terminate(): Promise<unknown>;
};

async function createOcrWorker(): Promise<TesseractWorker> {
  const moduleUrl = "https://cdn.jsdelivr.net/npm/tesseract.js@6/+esm";
  const tesseract = (await import(/* @vite-ignore */ moduleUrl)) as { createWorker(language: string): Promise<TesseractWorker> };
  const worker = await tesseract.createWorker("eng");
  await worker.setParameters({ tessedit_pageseg_mode: "7", preserve_interword_spaces: "1", user_defined_dpi: "300" });
  return worker;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível preparar o print para OCR."));
    image.src = dataUrl;
  });
}

async function prepareImageVariants(dataUrl: string): Promise<[string, string]> {
  const image = await loadImage(dataUrl);
  const scale = Math.max(3, Math.min(5, Math.ceil(320 / Math.max(1, image.naturalHeight))));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("O navegador não conseguiu preparar o print.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const natural = canvas.toDataURL("image/png");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = 0.299 * pixels.data[index]! + 0.587 * pixels.data[index + 1]! + 0.114 * pixels.data[index + 2]!;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 2.1 + 128));
    pixels.data[index] = contrasted;
    pixels.data[index + 1] = contrasted;
    pixels.data[index + 2] = contrasted;
  }
  context.putImageData(pixels, 0, 0);
  return [natural, canvas.toDataURL("image/png")];
}

export const browserOddsImageExtractor: OddsImageExtractor = {
  kind: "browser-ocr",
  async extract(images: SourceImage[]): Promise<ExtractedPlayerOdd[]> {
    const worker = await createOcrWorker();
    try {
      const extracted: ExtractedPlayerOdd[] = [];
      for (const image of images) {
        const [natural, enhanced] = await prepareImageVariants(image.dataUrl);
        const naturalResult = await worker.recognize(natural);
        const primary = parseComparisonRow(naturalResult.data.text);
        await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "0123456789., ", preserve_interword_spaces: "1" });
        const numericResult = await worker.recognize(enhanced);
        await worker.setParameters({ tessedit_pageseg_mode: "7", tessedit_char_whitelist: "", preserve_interword_spaces: "1" });
        const numericOdds = extractDecimalOdds(numericResult.data.text, primary.line);
        const odds = numericOdds.length > primary.odds.length ? numericOdds : primary.odds;
        const confidence = Math.max(0, Math.min(1, Math.max(naturalResult.data.confidence, numericResult.data.confidence) / 100));
        if (odds.length === 0) {
          extracted.push({ side: "over", confidence, sourceImageId: image.id, playerName: primary.playerName, line: primary.line, source: image.name });
          continue;
        }
        odds.forEach((decimalOdd, index) => extracted.push({
          side: "over", decimalOdd, confidence, sourceImageId: image.id,
          playerName: primary.playerName, line: primary.line,
          source: image.name + " · Casa " + (index + 1),
        }));
      }
      return extracted;
    } finally { await worker.terminate(); }
  },
};

export const edgeFunctionOddsImageExtractor: OddsImageExtractor = {
  kind: "edge-function",
  async extract(): Promise<ExtractedPlayerOdd[]> { throw new Error("Extrator de visão/OCR ainda não conectado ao backend."); },
};

export function getOddsImageExtractor(): OddsImageExtractor { return browserOddsImageExtractor; }
