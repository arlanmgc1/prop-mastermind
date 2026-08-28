import { describe, expect, it } from "vitest";
import { parseLadderPaste } from "../parseLadderPaste";

describe("colagem de mercado em linha única", () => {
  it("aceita quebras de linha e marcadores copiados", () => {
    const pasted =
      "AC Milan Total de Faltas\nMais de11.5**2.05**\nMenos de11.5**1.72**";
    expect(parseLadderPaste(pasted)).toEqual([
      { line: 11.5, oddOver: 2.05, oddUnder: 1.72 },
    ]);
  });
});
