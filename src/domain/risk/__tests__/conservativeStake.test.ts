import { describe, expect, it } from "vitest";
import { conservativeStakeUnits } from "../playerLadder";

const strong = {
  coverage: 1,
  sampleGames: 15,
  starter: "titular" as const,
  minutesSpread: 10,
  uncertaintyWidth: 0.08,
  modelComparableGap: 0.03,
};

describe("stake conservadora", () => {
  it("não aposta com edge abaixo de 3%", () => {
    expect(conservativeStakeUnits({ ...strong, probability: 0.51, odd: 2 }).units).toBe(0);
  });

  it("não transforma automaticamente edge moderado em 2u", () => {
    const result = conservativeStakeUnits({ ...strong, probability: 0.55, odd: 2 });
    expect(result.units).toBe(1.5);
    expect(result.units).toBeLessThan(2);
  });

  it("reserva 2u para edge forte com dados bons", () => {
    expect(conservativeStakeUnits({ ...strong, probability: 0.65, odd: 2 }).units).toBe(2);
  });

  it("reduz a stake quando a qualidade dos dados cai", () => {
    const good = conservativeStakeUnits({ ...strong, probability: 0.58, odd: 2 });
    const weak = conservativeStakeUnits({
      probability: 0.58,
      odd: 2,
      coverage: 0.5,
      sampleGames: 5,
      starter: "incerto",
      minutesSpread: 30,
      uncertaintyWidth: 0.22,
      modelComparableGap: 0.18,
    });
    expect(weak.units).toBeLessThan(good.units);
  });
  it("concede piso de 0,25u quando o edge mínimo foi aprovado", () => {
    const result = conservativeStakeUnits({
      probability: 1 / 1.73,
      odd: 1.9,
      coverage: 0.1,
      sampleGames: 1,
      starter: "incerto",
      minutesSpread: 40,
      uncertaintyWidth: 0.3,
      modelComparableGap: 0.2,
    });
    expect(result.edge).toBeGreaterThan(0.03);
    expect(result.units).toBe(0.25);
  });
});
