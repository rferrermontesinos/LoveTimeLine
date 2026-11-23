import { describe, expect, it } from "vitest";
import { aIso } from "@/domain/fechas/fecha";
import { mejorarFechasGuardadas, migrarMazo } from "./migrar";
import { POLITICA_FECHAS, type Carta, type CartaFoto, type SugerenciaFecha } from "./tipos";

/** Un borrador tal y como lo guardaba la primera versión del portal (sin fotos reales). */
const v1 = () => ({
  version: 1,
  id: "m1",
  creadoEn: 1,
  actualizadoEn: 2,
  packId: "familia",
  estiloId: "familia",
  tintaId: "cobalto",
  titulo: "Ana y Leo",
  dedicatoria: "",
  portadaId: "a",
  tono: "original",
  idiomaMazo: "es",
  mecanicas: ["estrella", "cuentalo"],
  extras: ["pack-retos"],
  consentimientoFotos: 1,
  paso: 3,
  cartas: [
    {
      id: "a",
      nombreArchivo: "a.jpg",
      tipoArchivo: "image/jpeg",
      hash: "h",
      ancho: 10,
      alto: 10,
      anchoOriginal: 10,
      altoOriginal: 10,
      fecha: { anio: 2019 },
      fuente: "exif",
      confianza: "alta",
      revisar: false,
      descripcion: "",
      descripcionEnAnverso: false,
      recorteAnverso: { x: 0, y: 0, ancho: 10, alto: 10 },
      recorteReverso: { x: 0, y: 0, ancho: 10, alto: 8 },
      reversoPersonalizado: false,
      destacada: false,
      adornos: [],
      pppConfirmado: false,
      anadidaEn: 0,
    },
  ],
  pedido: null,
});

describe("migrar un mazo guardado", () => {
  it("pasa un borrador de la primera versión a la actual sin perder el trabajo", () => {
    const m = migrarMazo(v1());
    expect(m).not.toBeNull();
    expect(m?.version).toBe(2);
    expect(m?.packId).toBe("mediano");
    expect(m?.estiloId).toBe("naipe");
    expect(m?.paletaId).toBe("cobalto");
    expect(m?.caja).toBeNull();
    expect(m?.paso).toBe(3);
    expect(m?.titulo).toBe("Ana y Leo");
    expect(m?.portadaId).toBe("a");
    expect(m?.cartas).toHaveLength(1);
    expect(m?.cartas[0]?.tipo).toBe("foto");
    expect(m?.cartas[0]?.fecha).toEqual({ anio: 2019 });
    expect(m && "tintaId" in m).toBe(false);
    // Los extras y mecánicas retirados se limpian al abrir el configurador, con el catálogo.
    expect(m?.extras).toEqual(["pack-retos"]);
  });

  it("el pack pequeño de la primera versión era «pareja»", () => {
    expect(migrarMazo({ ...v1(), packId: "pareja" })?.packId).toBe("pequeno");
    expect(migrarMazo({ ...v1(), packId: "otro" })?.packId).toBe("otro");
  });

  it("deja igual un mazo que ya está en la versión actual", () => {
    const actual = migrarMazo(v1())!;
    expect(migrarMazo(actual)).toEqual(actual);
  });

  it("recuerda la carta abierta del paso 2, si la hay", () => {
    const actual = migrarMazo(v1())!;
    expect(actual.cartaAbierta).toBeUndefined();
    expect(migrarMazo({ ...actual, cartaAbierta: "a" })?.cartaAbierta).toBe("a");
    expect(migrarMazo({ ...actual, cartaAbierta: null })?.cartaAbierta).toBeNull();
    // La confirmación de la foto de la caja, solo si es una clave.
    expect(migrarMazo({ ...actual, cajaBajaConfirmada: "f1|0|0|600|400" })?.cajaBajaConfirmada).toBe("f1|0|0|600|400");
    expect(migrarMazo({ ...actual, cajaBajaConfirmada: 7 })?.cajaBajaConfirmada).toBeUndefined();
    expect(migrarMazo({ ...actual, cartaAbierta: 7 })?.cartaAbierta).toBeUndefined();
  });

  it("descarta lo que no se puede leer y arregla lo que se puede", () => {
    expect(migrarMazo(null)).toBeNull();
    expect(migrarMazo("mazo")).toBeNull();
    expect(migrarMazo({ ...v1(), version: 99 })).toBeNull();
    expect(migrarMazo({ ...v1(), id: 3 })).toBeNull();
    const raro = migrarMazo({
      ...migrarMazo(v1())!,
      estiloId: "inexistente",
      paletaId: "inexistente",
      paso: 9,
      mecanicas: ["estrella", 4],
      cartas: [{ id: "x", tipo: "video" }, { id: "t", tipo: "texto", descripcion: "Nuestra boda", fecha: null }, "basura"],
    });
    expect(raro?.estiloId).toBe("naipe");
    expect(raro?.paletaId).toBe("rosa");
    expect(raro?.paso).toBe(1);
    expect(raro?.mecanicas).toEqual(["estrella"]);
    expect(raro?.cartas.map((c) => c.id)).toEqual(["t"]);
  });
});

describe("mazo guardado con el mes de un envío puesto solo (reglas 2, 20-11-2026 por la mañana)", () => {
  const anadida = new Date(2026, 10, 20, 10).getTime();
  const base = v1().cartas[0]!;
  const conFecha = (id: string, nombreArchivo: string, extra: Partial<CartaFoto>): CartaFoto =>
    ({ ...base, tipo: "foto", id, nombreArchivo, motivo: undefined, sugerencias: [], anadidaEn: anadida, ...extra }) as CartaFoto;
  const marzo = { anio: 2024, mes: 3 };

  it("el mes puesto solo vuelve a quedar en blanco, como sugerencia de un toque", () => {
    const [w, c] = mejorarFechasGuardadas([
      conFecha("w", "IMG-20240314-WA0003.jpg", { fecha: marzo, fuente: "nombre", confianza: "baja" }),
      conFecha("c", "Screenshot_2024-03-02-10-00-00.png", { fecha: marzo, fuente: "nombre", confianza: "baja" }),
    ]);
    expect(w).toMatchObject({ fecha: null, fuente: null, confianza: null, revisar: false, motivo: "mes-de-envio", sugerencias: [{ fecha: marzo, fuente: "nombre", motivo: "mes-de-envio" }] });
    expect(c).toMatchObject({ fecha: null, motivo: "mes-de-captura", sugerencias: [{ fecha: marzo, fuente: "nombre", motivo: "mes-de-captura" }] });
  });

  it("no toca la fecha puesta a mano, la sugerencia aceptada ni las fechas claras", () => {
    const cartas = [
      conFecha("mano", "IMG-20240314-WA0003.jpg", { fecha: { anio: 2019, mes: 5 }, fuente: "manual", confianza: "alta" }),
      conFecha("aceptada", "IMG-20240314-WA0004.jpg", { fecha: marzo, fuente: "nombre", confianza: "alta" }),
      conFecha("camara", "IMG_20190814_123045.jpg", { fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "nombre", confianza: "alta" }),
      conFecha("escrita", "verano 2015.jpg", { fecha: { anio: 2015 }, fuente: "nombre", confianza: "media" }),
    ];
    const mejoradas = mejorarFechasGuardadas(cartas);
    mejoradas.forEach((c, i) => expect(c).toBe(cartas[i]));
  });

  it("al abrir el mazo se revisa una vez y después ya no cambia", () => {
    const guardado = {
      ...migrarMazo(v1())!,
      politicaFechas: 2,
      cartas: [conFecha("w", "IMG-20240314-WA0003.jpg", { fecha: marzo, fuente: "nombre", confianza: "baja", descripcion: "Comida en casa" })],
    };
    const m = migrarMazo(guardado)!;
    expect(m.politicaFechas).toBe(POLITICA_FECHAS);
    expect(m.cartas[0]).toMatchObject({ fecha: null, descripcion: "Comida en casa", sugerencias: [{ fecha: marzo }] });
    expect(migrarMazo(m)).toEqual(m);
  });
});

describe("mazo guardado con las reglas de fechas anteriores (20-11-2026)", () => {
  /** Añadida el 18 de noviembre de 2026: las ventanas de preparación se cuentan desde ahí. */
  const anadida = new Date(2026, 10, 18, 12).getTime();
  const base = v1().cartas[0]!;
  const foto = (id: string, sugerencias: SugerenciaFecha[], extra: Partial<CartaFoto> = {}): Carta =>
    ({ ...base, tipo: "foto", id, fecha: null, fuente: null, confianza: null, motivo: sugerencias[0]?.motivo, sugerencias, anadidaEn: anadida, ...extra }) as CartaFoto;
  const s = (iso: string, fuente: SugerenciaFecha["fuente"], motivo: SugerenciaFecha["motivo"]): SugerenciaFecha => {
    const [anio, mes, dia] = iso.split("-").map(Number);
    return { fecha: { anio: anio!, ...(mes ? { mes } : {}), ...(dia ? { dia } : {}) }, fuente, motivo };
  };
  const fechas = (cartas: Carta[]) => Object.fromEntries(cartas.map((c) => [c.id, c.fecha ? aIso(c.fecha) : null]));

  it("pone las fechas sugeridas que ahora se pondrían solas y deja en blanco las de preparar el mazo", () => {
    const cartas = mejorarFechasGuardadas([
      foto("camara-de-meses", [s("2026-06-10", "exif", "fecha-reciente")]),
      foto("camara-de-ayer", [s("2026-11-17", "exif", "fecha-reciente")]),
      foto("sin-datos-camara", [s("2012-05-05", "exif", "sin-datos-de-camara")]),
      foto("escaneada-1987", [s("1987-06-01", "exif", "digitalizada-despues")]),
      foto("anotada", [s("1987", "exif", "fecha-anotada")]),
      foto("whatsapp-antiguo", [s("2019-08-14", "nombre", "fecha-de-envio")]),
      foto("whatsapp-de-hoy", [s("2026-11-18", "nombre", "fecha-de-envio")]),
      foto("captura-antigua", [s("2020-03-02", "nombre", "captura-de-pantalla")]),
      foto("archivo", [s("2016-07-10", "archivo", "fecha-del-archivo")]),
      // Primero el nombre escrito, después la cámara: el nombre gana si es anterior.
      foto("nombre-anterior", [s("2015", "nombre", "exif-y-nombre-no-coinciden"), s("2019-08-14", "exif", "exif-y-nombre-no-coinciden")]),
      foto("nombre-posterior", [s("2020", "nombre", "exif-y-nombre-no-coinciden"), s("2019-12-24", "exif", "exif-y-nombre-no-coinciden")]),
    ]);
    expect(fechas(cartas)).toEqual({
      "camara-de-meses": "2026-06-10",
      "camara-de-ayer": null,
      "sin-datos-camara": "2012-05-05",
      "escaneada-1987": "1987-06-01",
      anotada: "1987",
      "whatsapp-antiguo": null,
      "whatsapp-de-hoy": null,
      "captura-antigua": null,
      archivo: null,
      "nombre-anterior": "2015",
      "nombre-posterior": "2019-12-24",
    });
    const porId = new Map(cartas.map((c) => [c.id, c]));
    // El mes de un envío o de una captura antiguos no se pone solo: queda como sugerencia de un toque.
    expect(porId.get("whatsapp-antiguo")).toMatchObject({ motivo: "mes-de-envio", sugerencias: [{ fecha: { anio: 2019, mes: 8 }, fuente: "nombre", motivo: "mes-de-envio" }] });
    expect(porId.get("captura-antigua")).toMatchObject({ motivo: "mes-de-captura", sugerencias: [{ fecha: { anio: 2020, mes: 3 }, motivo: "mes-de-captura" }] });
    expect(porId.get("camara-de-meses")).toMatchObject({ fuente: "exif", motivo: undefined, sugerencias: [] });
    // El reenvío de hoy perdió la fecha: queda en blanco, sin la del envío como pista.
    expect(porId.get("whatsapp-de-hoy")).toMatchObject({ motivo: "fecha-de-envio", sugerencias: [] });
    // La de estos días y la del archivo siguen como estaban.
    expect(porId.get("camara-de-ayer")?.sugerencias).toHaveLength(1);
    expect(porId.get("archivo")?.sugerencias).toHaveLength(1);
  });

  it("una sesión de fotos de fotos (5 o más del mismo día reciente) sigue en blanco", () => {
    const sesion = ["a", "b", "c", "d", "e"].map((id) => foto(id, [s("2026-10-25", "exif", "fecha-reciente")]));
    const cartas = mejorarFechasGuardadas([...sesion, foto("sola", [s("2026-10-24", "exif", "fecha-reciente")])]);
    expect(fechas(cartas)).toEqual({ a: null, b: null, c: null, d: null, e: null, sola: "2026-10-24" });
    expect(cartas[0]).toMatchObject({ motivo: "sesion-de-escaneo" });
  });

  it("no toca fechas puestas, cartas de texto ni nada más del mazo", () => {
    const puesta = foto("puesta", [s("2019-08-14", "nombre", "fecha-de-envio")], { fecha: { anio: 2001 }, fuente: "manual", confianza: "alta" });
    const texto: Carta = { tipo: "texto", id: "t", fecha: null, fuente: null, confianza: null, revisar: false, descripcion: "Nos conocimos", destacada: true, anadidaEn: anadida };
    const [p, t] = mejorarFechasGuardadas([puesta, texto]);
    expect(p).toBe(puesta);
    expect(t).toBe(texto);
  });

  it("al abrir un mazo guardado: lo mejora una sola vez, sin perder cartas, fotos ni elecciones", () => {
    const guardado = {
      ...migrarMazo(v1())!,
      politicaFechas: undefined,
      tono: "bn",
      portadaId: "w",
      caja: { origen: "carta", cartaId: "w" },
      cartas: [
        foto("w", [s("2019-08-14", "nombre", "fecha-de-envio")], { destacada: true, descripcion: "Menorca", adornos: [{ id: "e", emoji: "❤️", x: 0.5, y: 0.5, tamano: 0.2, giro: 0 }] }),
        foto("hoy", [s("2026-11-18", "exif", "fecha-reciente")]),
      ],
    };
    const m = migrarMazo(guardado)!;
    expect(m.politicaFechas).toBe(POLITICA_FECHAS);
    expect(m.cartas.map((c) => c.id)).toEqual(["w", "hoy"]);
    expect(fechas(m.cartas)).toEqual({ w: null, hoy: null });
    expect(m.cartas[0]?.sugerencias).toEqual([{ fecha: { anio: 2019, mes: 8 }, fuente: "nombre", motivo: "mes-de-envio" }]);
    expect(m.cartas[0]).toMatchObject({ destacada: true, descripcion: "Menorca", adornos: [{ emoji: "❤️" }] });
    expect(m.portadaId).toBe("w");
    expect(m.caja).toEqual({ origen: "carta", cartaId: "w" });
    // El tono ya no se elige: todas las fotos salen con su color.
    expect(m.tono).toBe("original");
    // Ya revisado: al volver a abrirlo no cambia nada.
    expect(migrarMazo(m)).toEqual(m);
  });

  it("un mazo ya revisado no se vuelve a tocar, aunque tenga sugerencias", () => {
    const m = { ...migrarMazo(v1())!, cartas: [foto("w", [s("2019-08-14", "nombre", "fecha-de-envio")])] };
    expect(migrarMazo(m)?.cartas[0]?.fecha).toBeNull();
  });

  it("si una carta guardada es rara, el mazo se abre igual", () => {
    const rara = { ...foto("r", [s("2019-08-14", "nombre", "fecha-de-envio")]), sugerencias: [{ fecha: null, fuente: "nombre", motivo: "fecha-de-envio" }] };
    const m = migrarMazo({ ...migrarMazo(v1())!, politicaFechas: undefined, cartas: [rara] });
    expect(m?.cartas.map((c) => c.id)).toEqual(["r"]);
  });
});
