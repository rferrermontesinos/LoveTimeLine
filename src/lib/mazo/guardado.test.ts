import { describe, expect, it } from "vitest";
import {
  conVistaDeEstaPestana,
  debePedirPersistencia,
  decidirSincronizacion,
  guardarSinEsperar,
  haceCuanto,
  haceCuantoTexto,
  mismaVersion,
  sinNadaQuePerder,
  versionDe,
  type VersionMazo,
} from "./guardado";
import { fotosSueltas, nuevaCartaTexto } from "./derivados";
import type { Carta, CartaFoto, Mazo, Pedido } from "./tipos";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

const v = (id: string, actualizadoEn: number): VersionMazo => ({ id, actualizadoEn });

const foto = { id: "f1", tipo: "foto" } as unknown as CartaFoto;
const texto: Carta = nuevaCartaTexto("t1", "Nuestra boda", { anio: 2015 }, 0);
const pedido = { id: "p1", estado: "pendiente" } as Pedido;

describe("versión del mazo guardado", () => {
  it("sale del id y de cuándo cambió", () => {
    expect(versionDe({ id: "m1", actualizadoEn: 5, cartas: [] })).toEqual(v("m1", 5));
  });

  it("no la hay si no hay mazo o no se reconoce", () => {
    expect(versionDe(undefined)).toBeNull();
    expect(versionDe(null)).toBeNull();
    expect(versionDe("mazo")).toBeNull();
    expect(versionDe({ id: "m1" })).toBeNull();
    expect(versionDe({ id: 3, actualizadoEn: 5 })).toBeNull();
  });

  it("dos versiones son la misma con el mismo id y la misma hora; dos «sin mazo», también", () => {
    expect(mismaVersion(v("m1", 5), v("m1", 5))).toBe(true);
    expect(mismaVersion(v("m1", 5), v("m1", 6))).toBe(false);
    expect(mismaVersion(v("m1", 5), v("m2", 5))).toBe(false);
    expect(mismaVersion(null, null)).toBe(true);
    expect(mismaVersion(v("m1", 5), null)).toBe(false);
    expect(mismaVersion(null, v("m1", 5))).toBe(false);
  });
});

describe("mazo sin nada que perder", () => {
  it("recién empezado: sin cartas, sin permiso de fotos y sin pedido", () => {
    expect(sinNadaQuePerder({ cartas: [], consentimientoFotos: null, pedido: null })).toBe(true);
  });

  it("con cartas, con el permiso dado o con pedido ya hay algo", () => {
    expect(sinNadaQuePerder({ cartas: [texto], consentimientoFotos: null, pedido: null })).toBe(false);
    expect(sinNadaQuePerder({ cartas: [], consentimientoFotos: 1, pedido: null })).toBe(false);
    expect(sinNadaQuePerder({ cartas: [], consentimientoFotos: null, pedido })).toBe(false);
  });
});

describe("sincronizar con otra pestaña", () => {
  const base = v("m1", 100);

  it("si lo guardado es lo que esta pestaña tiene, no hay nada que hacer", () => {
    expect(decidirSincronizacion({ guardado: v("m1", 100), base, cambiosSinGuardar: true })).toBe("nada");
    expect(decidirSincronizacion({ guardado: null, base: null, cambiosSinGuardar: false })).toBe("nada");
  });

  it("si otra pestaña guardó algo más nuevo y aquí no hay cambios, se trae", () => {
    expect(decidirSincronizacion({ guardado: v("m1", 200), base, cambiosSinGuardar: false })).toBe("recargar");
    // También si allí se empezó otro mazo.
    expect(decidirSincronizacion({ guardado: v("m2", 50), base, cambiosSinGuardar: false })).toBe("recargar");
    // O si esta pestaña aún no había guardado nada.
    expect(decidirSincronizacion({ guardado: v("m1", 200), base: null, cambiosSinGuardar: false })).toBe("recargar");
  });

  it("si las dos han cambiado el mazo, esta no pisa la otra: conflicto", () => {
    expect(decidirSincronizacion({ guardado: v("m1", 200), base, cambiosSinGuardar: true })).toBe("conflicto");
    expect(decidirSincronizacion({ guardado: v("m2", 50), base, cambiosSinGuardar: true })).toBe("conflicto");
  });

  it("si en la otra se borró (y aún no hay mazo nuevo), solo hay conflicto con cambios propios", () => {
    expect(decidirSincronizacion({ guardado: null, base, cambiosSinGuardar: false })).toBe("nada");
    expect(decidirSincronizacion({ guardado: null, base, cambiosSinGuardar: true })).toBe("conflicto");
  });
});

describe("almacén persistente", () => {
  it("se pide tras el permiso de las fotos o con la primera foto", () => {
    expect(debePedirPersistencia({ consentimientoFotos: null, cartas: [] })).toBe(false);
    expect(debePedirPersistencia({ consentimientoFotos: null, cartas: [texto] })).toBe(false);
    expect(debePedirPersistencia({ consentimientoFotos: 1, cartas: [] })).toBe(true);
    expect(debePedirPersistencia({ consentimientoFotos: null, cartas: [texto, foto] })).toBe(true);
  });
});

describe("cuánto hace que se guardó", () => {
  const ahora = Date.UTC(2026, 10, 4, 12, 0, 0);

  it("menos de un minuto (o el reloj por detrás): «ahora mismo»", () => {
    expect(haceCuanto(ahora - 59_999, ahora)).toBeNull();
    expect(haceCuanto(ahora, ahora)).toBeNull();
    expect(haceCuanto(ahora + 5 * MIN, ahora)).toBeNull();
    expect(haceCuanto(Number.NaN, ahora)).toBeNull();
  });

  it("la unidad mayor que cabe entera, redondeando hacia abajo", () => {
    expect(haceCuanto(ahora - MIN, ahora)).toEqual({ valor: -1, unidad: "minute" });
    expect(haceCuanto(ahora - 59 * MIN - 59_000, ahora)).toEqual({ valor: -59, unidad: "minute" });
    expect(haceCuanto(ahora - 3 * HORA - 10 * MIN, ahora)).toEqual({ valor: -3, unidad: "hour" });
    expect(haceCuanto(ahora - 26 * HORA, ahora)).toEqual({ valor: -1, unidad: "day" });
    expect(haceCuanto(ahora - 13 * DIA, ahora)).toEqual({ valor: -1, unidad: "week" });
    expect(haceCuanto(ahora - 45 * DIA, ahora)).toEqual({ valor: -1, unidad: "month" });
    expect(haceCuanto(ahora - 800 * DIA, ahora)).toEqual({ valor: -2, unidad: "year" });
  });

  it("en el idioma de la página, en corto para la línea de estado y en largo para una frase", () => {
    expect(haceCuantoTexto(ahora - 30_000, ahora, "es", "ahora mismo")).toBe("ahora mismo");
    expect(haceCuantoTexto(ahora - MIN, ahora, "es", "ahora mismo")).toBe(new Intl.RelativeTimeFormat("es", { numeric: "auto", style: "short" }).format(-1, "minute"));
    expect(haceCuantoTexto(ahora - 26 * HORA, ahora, "es", "ahora mismo", "long")).toBe("ayer");
    expect(haceCuantoTexto(ahora - 2 * DIA, ahora, "es", "ahora mismo", "long")).toBe("anteayer");
    expect(haceCuantoTexto(ahora - 3 * DIA, ahora, "es", "ahora mismo", "long")).toBe("hace 3 días");
    expect(haceCuantoTexto(ahora - 2 * DIA, ahora, "en", "just now", "long")).toBe("2 days ago");
    expect(haceCuantoTexto(ahora - 10, ahora, "en", "just now", "long")).toBe("just now");
  });
});

describe("traer lo que guardó otra pestaña", () => {
  const guardado = { id: "m1", actualizadoEn: 9, paso: 3, cartaAbierta: "x", titulo: "Ana y Leo" } as unknown as Mazo;

  it("del mismo mazo, esta pestaña sigue en su paso y su carta", () => {
    const m = conVistaDeEstaPestana(guardado, { id: "m1", paso: 2, cartaAbierta: "y" });
    expect(m).toEqual({ ...guardado, paso: 2, cartaAbierta: "y" });
    expect(m.actualizadoEn).toBe(9);
  });

  it("si ya coinciden, o es otro mazo, o no había nada, se usa tal cual", () => {
    expect(conVistaDeEstaPestana(guardado, { id: "m1", paso: 3, cartaAbierta: "x" })).toBe(guardado);
    expect(conVistaDeEstaPestana(guardado, { id: "m2", paso: 1, cartaAbierta: null })).toBe(guardado);
    expect(conVistaDeEstaPestana(guardado, null)).toBe(guardado);
  });
});

describe("importación cortada", () => {
  it("las cartas de fotos ya guardadas y la foto propia de la caja se guardan sin esperar", () => {
    expect(guardarSinEsperar({ tipo: "anadirCartas", cartas: [foto] })).toBe(true);
    expect(guardarSinEsperar({ tipo: "ponerCaja", caja: { origen: "propia", id: "c1" } as Mazo["caja"] })).toBe(true);
    // Lo demás espera al guardado automático, que agrupa los cambios seguidos.
    expect(guardarSinEsperar({ tipo: "anadirCartas", cartas: [texto], deshacible: true })).toBe(false);
    expect(guardarSinEsperar({ tipo: "ponerCaja", caja: { origen: "carta", cartaId: "f1" } })).toBe(false);
    expect(guardarSinEsperar({ tipo: "ponerCaja", caja: null })).toBe(false);
    expect(guardarSinEsperar({ tipo: "cambiar", campo: "titulo", valor: "Ana y Leo" })).toBe(false);
  });

  it("sueltas son las fotos de antes de abrir que no usa ningún mazo; sin mazo, todas", () => {
    const mazo = { cartas: [foto, texto], caja: { origen: "propia", id: "caja" } } as unknown as Mazo;
    expect(fotosSueltas(["f1", "caja", "cortada"], mazo)).toEqual(["cortada"]);
    // Sin mazo guardado (cortada antes del primer guardado): todas, aunque ya haya un mazo nuevo vacío.
    expect(fotosSueltas(["a", "b"], null, { cartas: [], caja: null })).toEqual(["a", "b"]);
    // Una que el mazo de ahora ya usa (o el guardado al abrir, por si se deshace) se queda.
    expect(fotosSueltas(["f1", "b"], null, mazo)).toEqual(["b"]);
    expect(fotosSueltas(["f1"], mazo, { cartas: [], caja: null })).toEqual([]);
    // Las que no estaban al abrir (recién importadas, aún sin carta) nunca se miran.
    expect(fotosSueltas([], null)).toEqual([]);
  });
});
