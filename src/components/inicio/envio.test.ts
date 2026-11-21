import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import type { Catalogo, Pais } from "@/domain/precios/tipos";
import { paisesConEnvio } from "./envio";

const catalogo = catalogoJson as unknown as Catalogo;

const pais = (codigo: string, cambios: Partial<Pais> = {}): Pais => ({
  codigo,
  activo: true,
  moneda: "EUR",
  envioIncluido: true,
  diasEntrega: { min: 5, max: 8 },
  ...cambios,
});

describe("paisesConEnvio", () => {
  it("nombra los países del catálogo en el idioma de la página", () => {
    expect(paisesConEnvio(catalogo, "es")).toBe("España");
    expect(paisesConEnvio(catalogo, "en")).toBe("Spain");
  });

  it("une varios países como una lista de ese idioma", () => {
    const paises = [pais("ES"), pais("PT")];
    expect(paisesConEnvio({ paises }, "es")).toBe("España y Portugal");
    expect(paisesConEnvio({ paises }, "en")).toBe("Spain and Portugal");
    expect(paisesConEnvio({ paises: [...paises, pais("FR")] }, "es")).toBe("España, Portugal y Francia");
  });

  it("deja fuera los países sin activar y los que cobran el envío", () => {
    const paises = [pais("ES"), pais("PT", { activo: false }), pais("FR", { envioIncluido: false })];
    expect(paisesConEnvio({ paises }, "es")).toBe("España");
  });

  it("sin ningún país con el envío incluido no hay nota", () => {
    expect(paisesConEnvio({ paises: [] }, "es")).toBeNull();
    expect(paisesConEnvio({ paises: [pais("ES", { envioIncluido: false })] }, "es")).toBeNull();
  });
});
