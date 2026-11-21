import { describe, expect, it } from "vitest";
import { descargaPdfActiva, indexacionPermitida } from "@config/prototipo";

describe("interruptor de la descarga del PDF", () => {
  it("activo durante el prototipo: sin variable o con cualquier otro valor", () => {
    expect(descargaPdfActiva(undefined)).toBe(true);
    expect(descargaPdfActiva("")).toBe(true);
    expect(descargaPdfActiva("1")).toBe(true);
  });

  it("apagado para la comercialización con 0 (o false)", () => {
    expect(descargaPdfActiva("0")).toBe(false);
    expect(descargaPdfActiva(" 0 ")).toBe(false);
    expect(descargaPdfActiva("false")).toBe(false);
    expect(descargaPdfActiva("FALSE")).toBe(false);
  });
});

describe("interruptor de la indexación en buscadores", () => {
  it("apagado durante el prototipo: sin variable o con cualquier otro valor", () => {
    expect(indexacionPermitida(undefined)).toBe(false);
    expect(indexacionPermitida("")).toBe(false);
    expect(indexacionPermitida("0")).toBe(false);
    expect(indexacionPermitida("si")).toBe(false);
  });

  it("encendido para la comercialización solo con 1 (o true)", () => {
    expect(indexacionPermitida("1")).toBe(true);
    expect(indexacionPermitida(" 1 ")).toBe(true);
    expect(indexacionPermitida("TRUE")).toBe(true);
  });
});
