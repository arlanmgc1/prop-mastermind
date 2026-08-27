import { describe, expect, it } from "vitest";
import { aggregate, parseSofascoreExport } from "../sofascoreImportParser";

const SAMPLE = `JOGADOR: Vinícius Júnior
SOFASCORE_ID: 868812
URL: https://www.sofascore.com/player/x/868812
COLETADO_EM: 2026-08-27T18:00:00Z
TIME: Real Madrid

GERAL

ÚLTIMAS 15 ATUAÇÕES
COMP\tADV\tC/F\tTIT\tMIN\tTOS\tSOT\txG
LaLiga\tGetafe\tC\tSim\t90\t4\t2\t0.41
LaLiga\tOsasuna\tF\tSim\t78\t3\t-\t0.22
UCL\tArsenal\tF\tNão\t23\t1\t0\t-
`;

describe("parser do export SofaScore", () => {
  const parsed = parseSofascoreExport(SAMPLE);

  it("lê o cabeçalho", () => {
    expect(parsed.playerName).toBe("Vinícius Júnior");
    expect(parsed.sofascoreId).toBe("868812");
    expect(parsed.team).toBe("Real Madrid");
    expect(parsed.collectedAt).toBe("2026-08-27T18:00:00Z");
    expect(parsed.errors).toEqual([]);
  });

  it("lê as atuações", () => {
    expect(parsed.performances.length).toBe(3);
    const p0 = parsed.performances[0];
    expect(p0.competition).toBe("LaLiga");
    expect(p0.opponent).toBe("Getafe");
    expect(p0.homeAway).toBe("casa");
    expect(p0.starter).toBe(true);
    expect(p0.minutes).toBe(90);
    expect(p0.shots).toBe(4);
    expect(p0.shotsOnTarget).toBe(2);
    expect(p0.xG).toBeCloseTo(0.41, 6);
  });

  it("hífen vira null e nunca zero", () => {
    expect(parsed.performances[1].shotsOnTarget).toBeNull();
    expect(parsed.performances[2].xG).toBeNull();
    expect(parsed.performances[2].shotsOnTarget).toBe(0);
  });

  it("campos futuros ficam null", () => {
    expect(parsed.performances[0].foulsCommitted).toBeNull();
    expect(parsed.performances[0].tackles).toBeNull();
  });

  it("competições reconhecidas", () => {
    expect(parsed.competitions.sort()).toEqual(["LaLiga", "UCL"]);
  });

  it("mantém rawImport separado", () => {
    expect(parsed.rawImport).toBe(SAMPLE);
  });

  it("entrada vazia gera erro e não calcula", () => {
    const e = parseSofascoreExport("");
    expect(e.errors.length).toBeGreaterThan(0);
    expect(e.performances).toEqual([]);
  });

  it("aceita JSON", () => {
    const j = parseSofascoreExport(
      JSON.stringify({
        playerName: "Teste",
        performances: [{ MIN: 90, TOS: 3, SOT: "-", competition: "Série A" }],
      }),
    );
    expect(j.playerName).toBe("Teste");
    expect(j.performances[0].shots).toBe(3);
    expect(j.performances[0].shotsOnTarget).toBeNull();
  });

  it("agregação ignora atuações sem dado", () => {
    const agg = aggregate(parsed.performances, "shotsOnTarget");
    expect(agg.count).toBe(2);
    expect(agg.minutes).toBe(113);
    expect(agg.coverage).toBeCloseTo(2 / 3, 6);
    const none = aggregate(parsed.performances, "tackles");
    expect(none.count).toBeNull();
    expect(none.minutes).toBeNull();
  });
});
