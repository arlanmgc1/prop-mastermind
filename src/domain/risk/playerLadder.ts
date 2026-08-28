export interface PlayerLadderMarketRow {
  line: number;
  oddOver: number;
}

const decimal = (raw: string) => Number(raw.replace(",", "."));

export function parsePlayerLadderPaste(text: string): PlayerLadderMarketRow[] {
  const normalized = text.replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
  const rows: PlayerLadderMarketRow[] = [];
  const expression =
    /(?:mais\s+de|over)\s*([0-9]+(?:[.,][0-9]+)?)\s+([0-9]+(?:[.,][0-9]+)?)/giu;
  for (const match of normalized.matchAll(expression)) {
    const line = decimal(match[1] ?? "");
    const oddOver = decimal(match[2] ?? "");
    if (!Number.isFinite(line) || !Number.isFinite(oddOver) || oddOver <= 1) continue;
    rows.push({ line, oddOver });
  }
  const unique = new Map<number, PlayerLadderMarketRow>();
  rows.forEach((row) => unique.set(row.line, row));
  return [...unique.values()].sort((a, b) => a.line - b.line);
}

export interface LadderStakeInput {
  line: number;
  probability: number;
  odd: number;
}

export interface LadderStakeAllocation extends LadderStakeInput {
  rawUnits: number;
  units: number;
}

const P_RAMP = 0.9505;
const EDGE_KNEE = 0.06;
const RAMP_C = (1 / 3) / Math.pow(EDGE_KNEE, P_RAMP);

export function referenceStakeUnits(probability: number, odd: number): number {
  if (!(probability > 0 && probability < 1) || !(odd > 1)) return 0;
  const edge = odd * probability - 1;
  if (!(edge > 0)) return 0;
  const fullKelly = edge / (odd - 1);
  const fraction = Math.min(1 / 3, RAMP_C * Math.pow(edge, P_RAMP));
  return Math.max(0, fullKelly * fraction * 100);
}

const floorStep = (value: number, step: 0.25 | 0.5) =>
  Math.max(0, Math.floor((value + 1e-9) / step) * step);

export function allocateLadderStakes(
  inputs: LadderStakeInput[],
  step: 0.25 | 0.5,
  mainCap = 2,
  totalCap = 3.25,
): LadderStakeAllocation[] {
  if (inputs.length === 0) return [];
  const ordered = [...inputs].sort((a, b) => a.line - b.line);
  const raw = ordered.map((row) => ({
    ...row,
    rawUnits: referenceStakeUnits(row.probability, row.odd),
    units: 0,
  }));
  raw[0]!.units = floorStep(Math.min(mainCap, totalCap, raw[0]!.rawUnits), step);
  let remaining = Math.max(0, totalCap - raw[0]!.units);
  const targets: number[] = [];
  let previous = raw[0]!.units;
  for (let index = 1; index < raw.length; index++) {
    const target = Math.min(previous, raw[index]!.rawUnits);
    targets.push(target);
    previous = target;
  }
  const targetSum = targets.reduce((sum, value) => sum + value, 0);
  const scale = targetSum > remaining && targetSum > 0 ? remaining / targetSum : 1;
  for (let index = 1; index < raw.length; index++) {
    const maxByPrevious = raw[index - 1]!.units;
    const units = floorStep(
      Math.min(maxByPrevious, targets[index - 1]! * scale, remaining),
      step,
    );
    raw[index]!.units = units;
    remaining = Math.max(0, remaining - units);
  }
  return raw;
}

export function ladderLabel(line: number): string {
  return String(Math.floor(line) + 1) + "+";
}
