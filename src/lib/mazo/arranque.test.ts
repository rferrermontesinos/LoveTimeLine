import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import type { Catalogo } from "@/domain/precios/tipos";
import { accionCrearMazo, accionNormalizar, decidirArranque, packDeLaUrl, urlSinPack, urlSinParametros } from "./arranque";
import { ESTADO_INICIAL, reductor } from "./reductor";
import type { Pedido } from "./tipos";

const catalogo = catalogoJson as unknown as Catalogo;

const pedido = (estado: Pedido["estado"]): Pedido => ({
  id: "p1",
  modo: "simulado",
  estado,
  totalCents: 4900,
  moneda: "EUR",
  cartasFisicas: 47,
  fecha: 0,
});

describe("packDeLaUrl", () => {
  it("solo vale un pack activo del catálogo", () => {
    expect(packDeLaUrl("mediano", catalogo)).toBe("mediano");
    expect(packDeLaUrl("grande", catalogo)).toBe("grande");
    // «pareja» y «familia» siguen en el catálogo, pero retirados.
    expect(packDeLaUrl("pareja", catalogo)).toBeNull();
    expect(packDeLaUrl("no-existe", catalogo)).toBeNull();
    expect(packDeLaUrl("", catalogo)).toBeNull();
    expect(packDeLaUrl(null, catalogo)).toBeNull();
    expect(packDeLaUrl(undefined, catalogo)).toBeNull();
  });
});

describe("decidirArranque", () => {
  it("sin mazo, crea uno con el pack de la URL o, si no vale, con el de por defecto", () => {
    expect(decidirArranque(null, "grande", catalogo)).toEqual({ tipo: "crear", packId: "grande" });
    expect(decidirArranque(null, null, catalogo)).toEqual({ tipo: "crear", packId: "pequeno" });
    expect(decidirArranque(null, "familia", catalogo)).toEqual({ tipo: "crear", packId: "pequeno" });
  });

  it("con mazo y otro pack en la URL, lo cambia y recuerda el de antes para deshacer", () => {
    expect(decidirArranque({ packId: "pequeno", pedido: null }, "mediano", catalogo)).toEqual({ tipo: "cambiarPack", de: "pequeno", a: "mediano" });
    // Un pedido a medio pagar (se volvió de Stripe sin pagar) no impide cambiarlo.
    expect(decidirArranque({ packId: "pequeno", pedido: pedido("pendiente") }, "grande", catalogo)).toEqual({ tipo: "cambiarPack", de: "pequeno", a: "grande" });
  });

  it("no hace nada sin pack en la URL, con el mismo pack o con uno que no vale", () => {
    const mazo = { packId: "mediano", pedido: null };
    expect(decidirArranque(mazo, null, catalogo)).toEqual({ tipo: "nada" });
    expect(decidirArranque(mazo, "mediano", catalogo)).toEqual({ tipo: "nada" });
    expect(decidirArranque(mazo, "pareja", catalogo)).toEqual({ tipo: "nada" });
  });

  it("un mazo ya pagado conserva su pack", () => {
    expect(decidirArranque({ packId: "pequeno", pedido: pedido("pagado") }, "grande", catalogo)).toEqual({ tipo: "mantenerPack", pedido: "grande" });
  });

  it("compara con el pack vigente del mazo: un borrador con un pack retirado cuenta con el de por defecto", () => {
    expect(decidirArranque({ packId: "pareja", pedido: null }, "pequeno", catalogo)).toEqual({ tipo: "nada" });
    expect(decidirArranque({ packId: "pareja", pedido: null }, "grande", catalogo)).toEqual({ tipo: "cambiarPack", de: "pequeno", a: "grande" });
  });
});

describe("accionNormalizar", () => {
  it("no hay nada que hacer con una selección vigente", () => {
    expect(accionNormalizar({ packId: "mediano", extras: ["envoltorio-regalo"], mecanicas: ["estrella"] }, catalogo)).toBeNull();
  });

  it("quita extras y mecánicas retirados y apunta la selección de la que parte", () => {
    const a = accionNormalizar({ packId: "pareja", extras: ["pack-retos", "envoltorio-regalo"], mecanicas: ["cuentalo", "estrella"] }, catalogo);
    expect(a).toMatchObject({ packId: "pequeno", extras: ["envoltorio-regalo"], mecanicas: ["estrella"], desde: { packId: "pareja" } });
  });

  it("el ?pack= del arranque no se pierde con un extra retirado en el mazo guardado", () => {
    // Mazo guardado con el pack pequeño y un extra que ya no se vende; se abre con ?pack=mediano.
    let e = reductor(ESTADO_INICIAL, accionCrearMazo({ id: "m1", ahora: 0, packId: "pequeno", idiomaMazo: "es", titulo: "T", catalogo }));
    e = reductor(e, { tipo: "cambiar", campo: "extras", valor: ["pack-retos"] });
    const decision = decidirArranque(e.mazo, "mediano", catalogo);
    expect(decision).toEqual({ tipo: "cambiarPack", de: "pequeno", a: "mediano" });
    // En el mismo instante: el configurador calcula el ajuste con el mazo de antes del cambio…
    const tarde = accionNormalizar(e.mazo!, catalogo)!;
    // …el arranque (componente hijo) cambia el pack primero y el ajuste llega después.
    e = reductor(e, { tipo: "cambiar", campo: "packId", valor: "mediano" });
    e = reductor(e, tarde);
    expect(e.mazo?.packId).toBe("mediano");
    // En el render siguiente se recalcula con el mazo nuevo y limpia el extra sin tocar el pack.
    const ahora = accionNormalizar(e.mazo!, catalogo)!;
    e = reductor(e, ahora);
    expect(e.mazo?.packId).toBe("mediano");
    expect(e.mazo?.extras).toEqual([]);
    expect(accionNormalizar(e.mazo!, catalogo)).toBeNull();
    // Y el cambio de pack se sigue pudiendo deshacer desde el aviso.
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.packId).toBe("pequeno");
  });
});

describe("accionCrearMazo", () => {
  it("lleva las mecánicas activas marcadas por defecto, en su orden, y crea el mazo en Fotos", () => {
    const accion = accionCrearMazo({ id: "m1", ahora: 1000, packId: "mediano", idiomaMazo: "en", titulo: "Our memories", catalogo });
    expect(accion.mecanicas).toEqual(["estrella", "comodin", "en-blanco"]);
    const e = reductor(ESTADO_INICIAL, accion);
    expect(e.mazo).toMatchObject({ id: "m1", packId: "mediano", idiomaMazo: "en", titulo: "Our memories", paso: 1, paletaId: "rosa", cartas: [], caja: null, extras: [] });
    expect(e.pasado).toEqual([]);
  });

  it("una mecánica retirada no entra aunque esté marcada por defecto", () => {
    const sinComodin: Pick<Catalogo, "mecanicas"> = { mecanicas: catalogo.mecanicas.map((m) => (m.id === "comodin" ? { ...m, activo: false } : m)) };
    expect(accionCrearMazo({ id: "m", ahora: 0, packId: "pequeno", idiomaMazo: "es", titulo: "t", catalogo: sinComodin }).mecanicas).toEqual(["estrella", "en-blanco"]);
  });
});

describe("urlSinPack", () => {
  it("quita ?pack= y conserva el resto de la consulta y el ancla", () => {
    expect(urlSinPack("http://localhost:3000/es/crear?pack=mediano")).toBe("/es/crear");
    expect(urlSinPack("https://ejemplo.test/es/crear?pago=cancelado&pack=grande#fotos")).toBe("/es/crear?pago=cancelado#fotos");
  });

  it("sin ?pack= no hay nada que cambiar", () => {
    expect(urlSinPack("https://ejemplo.test/es/crear?pago=cancelado")).toBeNull();
    expect(urlSinPack("https://ejemplo.test/en/crear")).toBeNull();
  });
});

describe("urlSinParametros", () => {
  it("quita los indicados (la vuelta de Stripe, ?pago=cancelado) y deja el resto", () => {
    expect(urlSinParametros("https://ejemplo.test/es/crear?pago=cancelado", ["pago"])).toBe("/es/crear");
    expect(urlSinParametros("https://ejemplo.test/es/crear?pago=cancelado&pack=grande#fotos", ["pago"])).toBe("/es/crear?pack=grande#fotos");
    expect(urlSinParametros("https://ejemplo.test/es/crear?pago=cancelado&pack=grande", ["pago", "pack"])).toBe("/es/crear");
  });

  it("sin ninguno de ellos no hay nada que cambiar", () => {
    expect(urlSinParametros("https://ejemplo.test/es/crear?pack=grande", ["pago"])).toBeNull();
    expect(urlSinParametros("https://ejemplo.test/es/crear", ["pago", "pack"])).toBeNull();
  });
});
