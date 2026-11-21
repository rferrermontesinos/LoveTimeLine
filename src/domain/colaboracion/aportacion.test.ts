import { describe, expect, it } from "vitest";
import { desempaquetar, empaquetar, ErrorAportacion, esJpeg, medidasJpeg, validarDatos, VERSION_APORTACION, type DatosAportacion } from "./aportacion";

/** Bytes que empiezan como un JPEG (no hace falta una imagen de verdad para el formato). */
const jpeg = (n: number, relleno = 0x11) => {
  const b = new Uint8Array(n).fill(relleno);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};

function datos(cambios: Partial<Record<keyof DatosAportacion, unknown>> = {}): DatosAportacion {
  return {
    v: VERSION_APORTACION,
    nombreArchivo: "IMG_20190814_123045.jpg",
    tipoArchivo: "image/jpeg",
    hash: "a".repeat(64),
    ancho: 3200,
    alto: 2400,
    anchoOriginal: 4032,
    altoOriginal: 3024,
    propuesta: {
      automatica: { fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta", pista: "camara" },
      sugerencias: [],
      escaneo: false,
      senales: [],
    },
    autor: "Tía Carmen",
    lote: "lote_de_prueba_1",
    enviadaEn: 1_795_000_000_000,
    ...cambios,
  } as DatosAportacion;
}

function error(f: () => unknown): string {
  try {
    f();
    return "sin error";
  } catch (e) {
    return e instanceof ErrorAportacion ? e.detalle : `otro error: ${String(e)}`;
  }
}

describe("datos de una aportación", () => {
  it("acepta unos datos correctos y los devuelve limpios", () => {
    const d = validarDatos(JSON.parse(JSON.stringify(datos({ tipoArchivo: "IMAGE/HEIC" }))));
    expect(d.tipoArchivo).toBe("image/heic");
    expect(d.propuesta.automatica?.fecha).toEqual({ anio: 2019, mes: 8, dia: 14 });
    expect(d.autor).toBe("Tía Carmen");
  });

  it("quita caracteres de control del nombre y del autor, y el autor puede faltar", () => {
    const d = validarDatos(datos({ nombreArchivo: "playa\u0000\u001b.jpg", autor: "  Leo\n " }));
    expect(d.nombreArchivo).toBe("playa.jpg");
    expect(d.autor).toBe("Leo");
    expect(validarDatos(datos({ autor: null })).autor).toBeNull();
  });

  it("no deja pasar nada raro de quien tiene el enlace", () => {
    expect(error(() => validarDatos(null))).toBe("versión");
    expect(error(() => validarDatos(datos({ v: 2 })))).toBe("versión");
    expect(error(() => validarDatos(datos({ nombreArchivo: "" })))).toBe("nombre");
    expect(error(() => validarDatos(datos({ nombreArchivo: "x".repeat(256) })))).toBe("nombre");
    expect(error(() => validarDatos(datos({ tipoArchivo: "text/html" })))).toBe("tipo");
    expect(error(() => validarDatos(datos({ hash: "A".repeat(64) })))).toBe("huella");
    expect(error(() => validarDatos(datos({ ancho: 0 })))).toBe("ancho");
    expect(error(() => validarDatos(datos({ alto: 1.5 })))).toBe("alto");
    expect(error(() => validarDatos(datos({ anchoOriginal: 20_001 })))).toBe("anchoOriginal");
    expect(error(() => validarDatos(datos({ autor: "x".repeat(41) })))).toBe("autor");
    expect(error(() => validarDatos(datos({ autor: 7 })))).toBe("autor");
    expect(error(() => validarDatos(datos({ lote: "corto" })))).toBe("lote");
    expect(error(() => validarDatos(datos({ lote: "con espacios y más" })))).toBe("lote");
    expect(error(() => validarDatos(datos({ enviadaEn: -1 })))).toBe("envío");
    expect(error(() => validarDatos(datos({ enviadaEn: "ayer" })))).toBe("envío");
  });

  it("valida la fecha propuesta, sus sugerencias y sus motivos", () => {
    const blanco = {
      automatica: null,
      sugerencias: [{ fecha: { anio: 2008, mes: 7 }, fuente: "archivo", motivo: "mes-de-envio" }],
      motivo: "mes-de-envio",
      escaneo: false,
      senales: [{ lo: "que sea" }],
    };
    const d = validarDatos(datos({ propuesta: blanco }));
    expect(d.propuesta).toEqual({ ...blanco, senales: [] });

    expect(error(() => validarDatos(datos({ propuesta: { ...blanco, escaneo: "no" } })))).toBe("propuesta");
    expect(error(() => validarDatos(datos({ propuesta: { ...blanco, motivo: "inventado" } })))).toBe("motivo");
    expect(error(() => validarDatos(datos({ propuesta: { ...blanco, sugerencias: [{ fecha: { anio: 2008, mes: 13 }, fuente: "archivo", motivo: "mes-de-envio" }] } })))).toBe("sugerencia");
    expect(error(() => validarDatos(datos({ propuesta: { ...blanco, sugerencias: [blanco.sugerencias[0], blanco.sugerencias[0], blanco.sugerencias[0]] } })))).toBe(
      "sugerencias",
    );
    const auto = datos().propuesta.automatica!;
    expect(error(() => validarDatos(datos({ propuesta: { ...blanco, automatica: { ...auto, pista: "adivinada" } } })))).toBe("fecha");
    expect(error(() => validarDatos(datos({ propuesta: { ...blanco, automatica: { ...auto, fecha: { anio: 2019, mes: 2, dia: 30 } } } })))).toBe("fecha");
  });
});

describe("empaquetar y desempaquetar", () => {
  it("datos, copia y miniatura van y vuelven tal cual, sin las señales de depuración", () => {
    const d = datos({ propuesta: { ...datos().propuesta, senales: [{ tipo: "algo" }] } });
    const copia = jpeg(5000, 0x22);
    const mini = jpeg(800, 0x33);
    const a = desempaquetar(empaquetar(d, copia, mini));
    expect(a.datos).toEqual({ ...d, propuesta: { ...d.propuesta, senales: [] } });
    expect(a.copia).toEqual(copia);
    expect(a.mini).toEqual(mini);
  });

  it("funciona sobre una vista de un buffer más grande (como sale de un descifrado)", () => {
    const bytes = empaquetar(datos(), jpeg(100), jpeg(50));
    const grande = new Uint8Array(bytes.length + 20);
    grande.set(bytes, 10);
    expect(desempaquetar(grande.subarray(10, 10 + bytes.length)).copia).toEqual(jpeg(100));
  });

  it("rechaza paquetes cortos, largos imposibles, datos que no son JSON y fotos que no son JPEG", () => {
    expect(error(() => desempaquetar(new Uint8Array(4)))).toBe("corta");
    const bien = empaquetar(datos(), jpeg(100), jpeg(50));

    const datosLargos = bien.slice();
    new DataView(datosLargos.buffer).setUint32(0, 0xffffff);
    expect(error(() => desempaquetar(datosLargos))).toBe("datos");

    const noJson = bien.slice();
    noJson[4] = 0x7b + 1;
    expect(error(() => desempaquetar(noJson))).toBe("datos");

    const largoDatos = new DataView(bien.buffer).getUint32(0);
    const copiaLarga = bien.slice();
    new DataView(copiaLarga.buffer).setUint32(4 + largoDatos, bien.length);
    expect(error(() => desempaquetar(copiaLarga))).toBe("copia");

    expect(error(() => desempaquetar(empaquetar(datos(), new Uint8Array(100), jpeg(50))))).toBe("imagen");
    expect(error(() => desempaquetar(empaquetar(datos(), jpeg(100), new Uint8Array(50))))).toBe("imagen");
    expect(error(() => desempaquetar(empaquetar(datos(), jpeg(100), new Uint8Array(0))))).toBe("imagen");
  });

  it("reconoce el principio de un JPEG", () => {
    expect(esJpeg(jpeg(10))).toBe(true);
    expect(esJpeg(Uint8Array.of(0xff, 0xd8))).toBe(false);
    expect(esJpeg(Uint8Array.of(0x89, 0x50, 0x4e, 0x47))).toBe(false);
  });
});

describe("medidas de un JPEG sin decodificarlo", () => {
  const SOI = [0xff, 0xd8];
  const APP0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = (marcador: number, ancho: number, alto: number) => [0xff, marcador, 0x00, 0x11, 0x08, alto >> 8, alto & 0xff, ancho >> 8, ancho & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  const DHT = [0xff, 0xc4, 0x00, 0x06, 0x00, 0x01, 0x02, 0x03];
  const SOS = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
  const bytes = (...partes: number[][]) => Uint8Array.from(partes.flat());

  it("lee el ancho y el alto del marcador SOF, también en un JPEG progresivo", () => {
    expect(medidasJpeg(bytes(SOI, APP0, sof(0xc0, 3200, 2400), SOS, [0xff, 0xd9]))).toEqual({ ancho: 3200, alto: 2400 });
    expect(medidasJpeg(bytes(SOI, APP0, DHT, sof(0xc2, 480, 640), SOS))).toEqual({ ancho: 480, alto: 640 });
  });

  it("salta los 0xFF de relleno y no confunde la tabla de Huffman (C4) con unas medidas", () => {
    expect(medidasJpeg(bytes(SOI, [0xff, 0xff], APP0, [0xff], DHT, sof(0xc1, 20, 10)))).toEqual({ ancho: 20, alto: 10 });
  });

  it("devuelve null si no es un JPEG o no dice sus medidas antes de los datos", () => {
    expect(medidasJpeg(bytes([0x89, 0x50, 0x4e, 0x47], APP0))).toBeNull();
    expect(medidasJpeg(bytes(SOI, APP0, SOS, sof(0xc0, 20, 10)))).toBeNull();
    expect(medidasJpeg(bytes(SOI, APP0))).toBeNull();
    expect(medidasJpeg(bytes(SOI, APP0, sof(0xc0, 20, 10).slice(0, 8)))).toBeNull();
    expect(medidasJpeg(bytes(SOI, APP0, sof(0xc0, 0, 10)))).toBeNull();
    expect(medidasJpeg(bytes(SOI, [0xff, 0xe1, 0x00, 0x01]))).toBeNull();
    expect(medidasJpeg(bytes(SOI, [0x00, 0xff, 0xc0]))).toBeNull();
  });
});
