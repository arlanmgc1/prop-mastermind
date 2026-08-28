export interface PlayerLadderMarketRow {
  line: number;
  oddOver: number;
}

const decimal = (raw: string) => Number(raw.replace(",", "."));

export function parsePlayerLadderPaste(text: string): PlayerLadderMarketRow[] {
  const normalized = text.replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
  const rows: PlayerLadderMarketRow[] = [];
  const expression = /(?:mais\s+de|over)\s*([0-9]+(?:[.,][0-9]+)?)\s+([0-9]+(?:[.,][0-9]+)?)/giu;
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
const RAMP_C = 1 / 3 / Math.pow(EDGE_KNEE, P_RAMP);

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
    const maxByPrevious = Math.max(0, raw[index - 1]!.units - step);
    const units = floorStep(Math.min(maxByPrevious, targets[index - 1]! * scale, remaining), step);
    raw[index]!.units = units;
    remaining = Math.max(0, remaining - units);
  }
  return raw;
}

export function ladderLabel(line: number): string {
  return String(Math.floor(line) + 1) + "+";
}
export interface DistributedEscadaRow {
  line: number;
  units: number;
}

/**
 * Distribui a stake já indicada para a principal. Degraus seguintes partem
 * de uma progressão 1/2, 1/4, 1/8 e são comprimidos por maior resto para
 * respeitar o teto total sem perder a ordem decrescente.
 */
export function distributeEscadaFromMain(
  lines: number[],
  mainUnits: number,
  step: 0.25 | 0.5,
  totalCap = 3.25,
): DistributedEscadaRow[] {
  if (lines.length === 0) return [];
  const ordered = [...new Set(lines)].sort((a, b) => a - b);
  const main = floorStep(Math.min(2, totalCap, Math.max(0, mainUnits)), step);
  const result = ordered.map((line) => ({ line, units: 0 }));
  result[0]!.units = main;
  if (ordered.length === 1 || main <= 0) return result;

  const remaining = Math.max(0, totalCap - main);
  const targets = ordered.slice(1).map((_, index) => main / Math.pow(2, index + 1));
  const sumTargets = targets.reduce((sum, value) => sum + value, 0);
  const scale = sumTargets > remaining && sumTargets > 0 ? remaining / sumTargets : 1;
  const ideals = targets.map((target) => target * scale);
  const allocated = ideals.map((ideal) => floorStep(ideal, step));
  let leftover = Math.max(0, remaining - allocated.reduce((sum, value) => sum + value, 0));

  const priority = ideals
    .map((ideal, index) => ({ index, remainder: ideal - allocated[index]! }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const candidate of priority) {
    if (leftover + 1e-9 < step) break;
    const previous = candidate.index === 0 ? main : allocated[candidate.index - 1]!;
    if (allocated[candidate.index]! + step <= previous - step + 1e-9) {
      allocated[candidate.index]! += step;
      leftover -= step;
    }
  }
  allocated.forEach((units, index) => {
    result[index + 1]!.units = units;
  });
  return result;
}
export interface ConservativeStakeInput {
  probability: number;
  odd: number;
  coverage: number;
  sampleGames: number;
  starter: "titular" | "reserva" | "incerto";
  minutesSpread: number | null;
  uncertaintyWidth: number | null;
  modelComparableGap: number | null;
}

export interface ConservativeStakeResult {
  units: number;
  rawUnits: number;
  edge: number;
  quality: number;
  factors: {
    coverage: number;
    sample: number;
    minutes: number;
    uncertainty: number;
    agreement: number;
  };
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * Gestão de 200u com 1/12 Kelly. Edge mínimo de 3%, redutores de qualidade,
 * floor de 0,25u e teto excepcional de 2u.
 */
export function conservativeStakeUnits(input: ConservativeStakeInput): ConservativeStakeResult {
  const edge = input.odd * input.probability - 1;
  const coverageFactor = clamp(input.coverage / 0.8, 0.35, 1);
  const sampleFactor = clamp(input.sampleGames / 15, 0.4, 1);
  const minutesFactor =
    input.starter === "incerto"
      ? 0.6
      : input.starter === "reserva"
        ? 0.8
        : input.minutesSpread == null
          ? 0.85
          : input.minutesSpread > 25
            ? 0.7
            : input.minutesSpread > 15
              ? 0.85
              : 1;
  const uncertaintyFactor =
    input.uncertaintyWidth == null
      ? 0.75
      : input.uncertaintyWidth > 0.2
        ? 0.6
        : input.uncertaintyWidth > 0.12
          ? 0.8
          : 1;
  const agreementFactor =
    input.modelComparableGap == null
      ? 1
      : input.modelComparableGap > 0.15
        ? 0.7
        : input.modelComparableGap > 0.08
          ? 0.85
          : 1;
  const factors = {
    coverage: coverageFactor,
    sample: sampleFactor,
    minutes: minutesFactor,
    uncertainty: uncertaintyFactor,
    agreement: agreementFactor,
  };
  const quality = Object.values(factors).reduce((product, value) => product * value, 1);
  if (!(edge >= 0.03) || !(input.odd > 1)) {
    return { units: 0, rawUnits: 0, edge, quality, factors };
  }
  const fullKelly = edge / (input.odd - 1);
  const rawUnits = Math.max(0, (fullKelly * 200 * quality) / 12);
  const units = Math.max(0.25, floorStep(Math.min(2, rawUnits), 0.25));
  return { units, rawUnits, edge, quality, factors };
}
