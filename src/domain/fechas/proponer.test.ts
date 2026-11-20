import { describe, expect, it } from "vitest";
import { aIso } from "./fecha";
import { esFechaDeRelojPorDefecto, leerFechaMetadato, metadatosDesdeExifr, primeraFechaUtil, type MetadatosFecha } from "./exif";
import { DIAS_PREPARACION, DIAS_PREPARACION_ENVIO, esFechaReciente, fechasCompatibles, proponerFecha, puedeSerReciente, type EntradaPropuesta, type ResultadoFecha } from "./proponer";

const hoy = new Date("2026-11-04T10:00:00");
const proponer = (e: Omit<EntradaPropuesta, "hoy">) => proponerFecha({ hoy, ...e });
const isoAuto = (r: ResultadoFecha) => (r.automatica ? aIso(r.automatica.fecha) : null);
const isoSugerencias = (r: ResultadoFecha) => r.sugerencias.map((s) => `${aIso(s.fecha)} ${s.fuente} ${s.motivo}`);

/** Cámara de verdad: marca, modelo y exposición. */
const CANON: MetadatosFecha = { Make: "Canon", Model: "Canon EOS 5D Mark IV", tieneExposicion: true };
const IPHONE: MetadatosFecha = { Make: "Apple", Model: "iPhone 13", Software: "17.1", tieneExposicion: true };
const EPSON: MetadatosFecha = { Make: "EPSON", Model: "Perfection V39", Software: "EPSON Scan" };

describe("leerFechaMetadato", () => {
  it("lee la fecha literal sin saltos de zona horaria", () => {
    expect(aIso(leerFechaMetadato("2019:12:31 23:59:59")!)).toBe("2019-12-31");
    expect(aIso(leerFechaMetadato("2019-12-31T23:59:59-08:00")!)).toBe("2019-12-31");
    expect(aIso(leerFechaMetadato("2019-08")!)).toBe("2019-08");
    expect(aIso(leerFechaMetadato("2019")!)).toBe("2019");
  });

  it("lee las fechas IPTC con «00» como mes o día desconocido", () => {
    expect(leerFechaMetadato("19870000")).toEqual({ anio: 1987 });
    expect(leerFechaMetadato("19870600")).toEqual({ anio: 1987, mes: 6 });
    expect(leerFechaMetadato("19870614")).toEqual({ anio: 1987, mes: 6, dia: 14 });
    expect(leerFechaMetadato("1987:06:00 00:00:00")).toEqual({ anio: 1987, mes: 6 });
  });

  it("descarta valores vacíos, imposibles o raros", () => {
    expect(leerFechaMetadato("0000:00:00 00:00:00")).toBeNull();
    expect(leerFechaMetadato("    :  :     :  :  ")).toBeNull();
    expect(leerFechaMetadato("1987:00:14")).toBeNull();
    expect(leerFechaMetadato("2019:02:30 10:00:00")).toBeNull();
    expect(leerFechaMetadato("ayer")).toBeNull();
    expect(leerFechaMetadato(undefined)).toBeNull();
  });
});

describe("primeraFechaUtil y reloj sin configurar", () => {
  it("salta fechas futuras, demasiado antiguas y de reloj sin configurar, y avisa de estas", () => {
    const r = primeraFechaUtil(["2030:01:01 00:00:00", "1800:01:01", "2000:01:01 00:00:00", "2015:07:01 10:00:00"], hoy);
    expect(r.fecha && aIso(r.fecha)).toBe("2015-07-01");
    expect(r.relojPorDefecto).toBe(true);
    expect(primeraFechaUtil([undefined, "1970:01:01 00:00:00"], hoy)).toEqual({ fecha: null, relojPorDefecto: true });
  });

  it("solo las fechas con día pueden ser de un reloj sin configurar", () => {
    expect(esFechaDeRelojPorDefecto({ anio: 2000, mes: 1, dia: 1 })).toBe(true);
    expect(esFechaDeRelojPorDefecto({ anio: 2000 })).toBe(false);
    expect(esFechaDeRelojPorDefecto({ anio: 2000, mes: 1 })).toBe(false);
    expect(primeraFechaUtil(["2000"], hoy).fecha).toEqual({ anio: 2000 });
  });
});

describe("metadatosDesdeExifr", () => {
  it("separa la fecha original, la de digitalización y la de modificación según el bloque", () => {
    const m = metadatosDesdeExifr({
      ifd0: { Make: "EPSON", Model: "Perfection V39", Software: "EPSON Scan", ModifyDate: "2026:10:31 09:00:00", SerialNumber: "X1" },
      exif: {
        CreateDate: "2026:10:30 10:00:00",
        DateTimeDigitized: "2026-10-30T10:00:00+01:00",
        DateTimeOriginal: "1987-06-01T00:00:00",
        FileSource: "Reflection Print Scanner",
        SensingMethod: "Trilinear sensor",
        ExifVersion: new Uint8Array([48, 50, 51, 48]),
      },
      xmp: { CreateDate: "2026-10-30T10:00:00+01:00", ModifyDate: "2026-10-31T09:00:00+01:00", CreatorTool: "EPSON Scan" },
      photoshop: { DateCreated: "1987-06-01" },
      iptc: { DateCreated: "19870000", DigitalCreationDate: "20261030", OriginatingProgram: "EPSON Scan", Byline: "Ana" },
      xmpMM: { History: [{ action: "created", softwareAgent: "VueScan 9.8" }, { action: "saved", softwareAgent: "Adobe Photoshop 25.0" }] },
    });
    expect(m).toEqual({
      DateTimeOriginal: "1987-06-01T00:00:00",
      DateTimeDigitized: "2026:10:30 10:00:00",
      XmpDateTimeDigitized: "2026-10-30T10:00:00+01:00",
      XmpCreateDate: "2026-10-30T10:00:00+01:00",
      XmpModifyDate: "2026-10-31T09:00:00+01:00",
      DateCreated: "1987-06-01",
      IptcDateCreated: "19870000",
      IptcDigitalCreationDate: "20261030",
      ModifyDate: "2026:10:31 09:00:00",
      Make: "EPSON",
      Model: "Perfection V39",
      Software: "EPSON Scan",
      CreatorTool: "EPSON Scan",
      OriginatingProgram: "EPSON Scan",
      ProgramasHistorial: ["VueScan 9.8", "Adobe Photoshop 25.0"],
      FileSource: "Reflection Print Scanner",
      SensingMethod: "Trilinear sensor",
    });
    // Nada de números de serie ni de autores.
    expect(JSON.stringify(m)).not.toMatch(/X1|Ana/);
  });

  it("acepta valores numéricos, en bytes, con idioma o en listas", () => {
    const m = metadatosDesdeExifr({
      ifd0: { Make: ["Canon"], Model: { value: "Canon EOS R6", lang: "x-default" } },
      exif: { DateTimeOriginal: "2019:08:14 18:30:00", FileSource: new Uint8Array([1]), SensingMethod: 7, ExposureTime: 0.008 },
      xmpMM: { History: { action: "created", softwareAgent: "SilverFast 9" } },
    });
    expect(m).toMatchObject({ Make: "Canon", Model: "Canon EOS R6", FileSource: "Film Scanner", SensingMethod: "Trilinear sensor", tieneExposicion: true, ProgramasHistorial: ["SilverFast 9"] });
  });

  it("sin nada útil devuelve null", () => {
    expect(metadatosDesdeExifr(undefined)).toBeNull();
    expect(metadatosDesdeExifr("texto")).toBeNull();
    expect(metadatosDesdeExifr({ ifd0: { Orientation: "Horizontal (normal)" }, exif: { ExifVersion: new Uint8Array([1]) } })).toBeNull();
  });
});

describe("proponerFecha: la fecha de la cámara se pone sola", () => {
  it("fecha original de una cámara: exif, confianza alta, pista cámara", () => {
    const r = proponer({ nombreArchivo: "DSC01234.JPG", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00", DateTimeDigitized: "2019:08:14 18:30:00" } });
    expect(r.automatica).toEqual({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta", pista: "camara" });
    expect(r.sugerencias).toEqual([]);
    expect(r.escaneo).toBe(false);
  });

  it("una cámara con un programa de edición sigue siendo una cámara (Snapseed)", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { Make: "samsung", Model: "SM-G991B", Software: "Snapseed", DateTimeOriginal: "2021:05:01 12:00:00" } });
    expect(isoAuto(r)).toBe("2021-05-01");
  });

  it("el nombre más vago que coincide no impide la fecha completa de la cámara", () => {
    const r = proponer({ nombreArchivo: "verano 2019.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00" } });
    expect(isoAuto(r)).toBe("2019-08-14");
  });

  it.each([
    ["IMG_20190814_123045.jpg", "2019-08-14"],
    ["PXL_20190814_123045123.MP.jpg", "2019-08-14"],
    ["20190814_123045.jpg", "2019-08-14"],
    ["IMG20190814123045.jpg", "2019-08-14"],
    ["2019-08-14 12.30.45.jpg", "2019-08-14"],
  ])("nombre de la cámara del móvil sin fecha original: %s → nombre, alta", (nombreArchivo, iso) => {
    const r = proponer({ nombreArchivo, exif: null, ultimaModificacion: hoy.getTime() });
    expect(r.automatica).toMatchObject({ fuente: "nombre", confianza: "alta", pista: "camara" });
    expect(isoAuto(r)).toBe(iso);
  });

  it("si la fecha original es la de un reloj sin configurar, vale el nombre de la cámara", () => {
    const r = proponer({ nombreArchivo: "IMG_20150814_120000.jpg", exif: { ...CANON, DateTimeOriginal: "2000:01:01 00:00:00" } });
    expect(isoAuto(r)).toBe("2015-08-14");
  });

  it("la original sin datos de cámara (copia, programa de fotos) también se pone sola, con confianza media", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { DateTimeOriginal: "2012:05:05 10:00:00" } });
    expect(r.automatica).toEqual({ fecha: { anio: 2012, mes: 5, dia: 5 }, fuente: "exif", confianza: "media", pista: "metadatos" });
  });

  it("sin original, la de creación de una cámara (Lightroom)", () => {
    const r = proponer({ nombreArchivo: "DSC00001.jpg", exif: { ...CANON, DateTimeDigitized: "2012:05:05 10:00:00" } });
    expect(r.automatica).toMatchObject({ fuente: "exif", confianza: "alta", pista: "camara" });
    expect(isoAuto(r)).toBe("2012-05-05");
  });

  it("si el nombre de la cámara dice otro día, vale la original", () => {
    const r = proponer({ nombreArchivo: "IMG_20150101_120000.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 12:00:00" } });
    expect(isoAuto(r)).toBe("2019-08-14");
  });

  it("un día de diferencia entre la original y el nombre se tolera (zonas horarias)", () => {
    const r = proponer({ nombreArchivo: "IMG_20190815_003000.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 23:30:00" } });
    expect(isoAuto(r)).toBe("2019-08-14");
  });

  it.each<[string, MetadatosFecha]>([
    ["IMGP2015.JPG", { Make: "PENTAX", Model: "PENTAX K-5", tieneExposicion: true }],
    ["SDIM2001.JPG", { Make: "SIGMA", Model: "SIGMA dp2 Quattro", tieneExposicion: true }],
    ["100_1987.JPG", { Make: "EASTMAN KODAK COMPANY", Model: "KODAK EASYSHARE C513 DIGITAL CAMERA", tieneExposicion: true }],
  ])("%s: el contador de la cámara no choca con su fecha ni se toma por un año", (nombreArchivo, camara) => {
    const conCamara = proponer({ nombreArchivo, exif: { ...camara, DateTimeOriginal: "2019:08:14 18:30:00" } });
    expect(conCamara.automatica).toMatchObject({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta" });
    // Reexportada sin metadatos: ni el «año» del contador ni nada.
    const sinExif = proponer({ nombreArchivo });
    expect(sinExif.automatica).toBeNull();
    expect(sinExif.sugerencias).toEqual([]);
  });

  it("una fecha de reloj sin configurar no se usa y lo explica", () => {
    const r = proponer({ nombreArchivo: "DSC00001.jpg", exif: { ...CANON, DateTimeOriginal: "2001:01:01 00:00:00" } });
    expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo: "reloj-de-camara" });
  });
});

describe("proponerFecha: fechas escritas por una persona", () => {
  it.each([
    ["abuelos 1958.jpg", "1958"],
    ["2015-08 Menorca.jpg", "2015-08"],
    ["Boda 14-08-2019.jpg", "2019-08-14"],
    ["14 de agosto de 2019.jpg", "2019-08-14"],
    ["2019-08-14 playa.jpg", "2019-08-14"],
  ])("en el nombre: %s → %s", (nombreArchivo, iso) => {
    const r = proponer({ nombreArchivo });
    expect(r.automatica).toMatchObject({ fuente: "nombre", confianza: "media", pista: "escrito" });
    expect(isoAuto(r)).toBe(iso);
  });

  it("anterior a la de la cámara, gana: es una foto de una foto antigua", () => {
    expect(isoAuto(proponer({ nombreArchivo: "verano 2015.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00" } }))).toBe("2015");
    expect(isoAuto(proponer({ nombreArchivo: "Menorca 2019-07.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00" } }))).toBe("2019-07");
    // Una foto antigua fotografiada con el móvil hace unos días, con el año en el nombre.
    expect(isoAuto(proponer({ nombreArchivo: "verano 2015.jpg", exif: { ...IPHONE, DateTimeOriginal: "2026:11:02 18:00:00" } }))).toBe("2015");
  });

  it("posterior a la de la cámara, no: la cámara no digitaliza el futuro", () => {
    const r = proponer({ nombreArchivo: "Navidad 2020.jpg", exif: { ...CANON, DateTimeOriginal: "2019:12:24 21:00:00" } });
    expect(isoAuto(r)).toBe("2019-12-24");
  });

  it("anotada en los metadatos (IPTC o photoshop:DateCreated), también", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { IptcDateCreated: "19870614" } });
    expect(r.automatica).toMatchObject({ fuente: "exif", confianza: "media", pista: "metadatos" });
    expect(isoAuto(r)).toBe("1987-06-14");
  });

  it("de estos días, con día, no: seguramente es la de preparar el mazo", () => {
    const r = proponer({ nombreArchivo: "2026-11-02 abuelos.jpg" });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2026-11-02 nombre fecha-reciente"]);
    expect(r.motivo).toBe("fecha-reciente");
    // Con solo el mes o el año, sí: lo escribió alguien que sabía cuándo fue.
    expect(isoAuto(proponer({ nombreArchivo: "2026-11 Menorca.jpg" }))).toBe("2026-11");
    expect(isoAuto(proponer({ nombreArchivo: "verano 2026.jpg" }))).toBe("2026");
    // Con día, de hace más de una semana, también.
    expect(isoAuto(proponer({ nombreArchivo: "2026-10-20 cena.jpg" }))).toBe("2026-10-20");
  });
});

describe("proponerFecha: la carpeta", () => {
  it.each([
    ["Menorca 2015/foto.jpg", "2015"],
    ["Fotos/2019/2019-08-14/foto.jpg", "2019-08-14"],
    ["Takeout/Google Fotos/Fotos de 2019/foto.jpg", "2019"],
    ["Menorca, 14 de agosto de 2019/foto.jpg", "2019-08-14"],
    ["Fotos 2019.08/foto.jpg", "2019-08"],
  ])("sin otra pista, vale la fecha de la carpeta: %s → %s", (rutaArchivo, iso) => {
    const r = proponer({ nombreArchivo: "foto.jpg", rutaArchivo });
    expect(r.automatica).toMatchObject({ fuente: "carpeta", confianza: "media", pista: "escrito" });
    expect(isoAuto(r)).toBe(iso);
  });

  it("el nombre del archivo va antes que la carpeta", () => {
    expect(isoAuto(proponer({ nombreArchivo: "abuelos 1958.jpg", rutaArchivo: "Fotos 1990/abuelos 1958.jpg" }))).toBe("1958");
  });

  it("no valen las carpetas de mensajería, capturas, la cámara o escaneos, ni las de estos días", () => {
    for (const rutaArchivo of [
      "WhatsApp Images 2019/foto.jpg",
      "Screenshots 2019/foto.jpg",
      "Capturas 2019/foto.jpg",
      "DCIM/100APPLE/foto.jpg",
      "Escaneos 2019/foto.jpg",
      "Para el mazo 2026/foto.jpg",
      "2026-11-03/foto.jpg",
    ]) {
      expect(proponer({ nombreArchivo: "foto.jpg", rutaArchivo }).automatica, rutaArchivo).toBeNull();
    }
  });

  it("con fecha de cámara, la carpeta solo gana si es de otra época (2 años o más antes)", () => {
    const camara = { ...CANON, DateTimeOriginal: "2016:01:02 10:00:00" };
    expect(isoAuto(proponer({ nombreArchivo: "IMG_0001.JPG", rutaArchivo: "Viaje 2015/IMG_0001.JPG", exif: camara }))).toBe("2016-01-02");
    expect(isoAuto(proponer({ nombreArchivo: "IMG_0001.JPG", rutaArchivo: "Abuelos 1960/IMG_0001.JPG", exif: camara }))).toBe("1960");
  });

  it("una foto de una foto de estos días, en una carpeta con su año: vale la carpeta", () => {
    const r = proponer({ nombreArchivo: "IMG_4521.HEIC", rutaArchivo: "Boda 2001/IMG_4521.HEIC", exif: { ...IPHONE, DateTimeOriginal: "2026:11:03 18:00:00" } });
    expect(isoAuto(r)).toBe("2001");
  });
});

describe("proponerFecha: días de preparar el mazo", () => {
  it("una semana: con día, de los últimos 7 días contando hoy", () => {
    expect(DIAS_PREPARACION).toBe(7);
    expect(esFechaReciente({ anio: 2026, mes: 11, dia: 4 }, hoy)).toBe(true);
    expect(esFechaReciente({ anio: 2026, mes: 10, dia: 29 }, hoy)).toBe(true);
    expect(esFechaReciente({ anio: 2026, mes: 10, dia: 28 }, hoy)).toBe(false);
    expect(esFechaReciente({ anio: 2026, mes: 11 }, hoy)).toBe(false);
  });

  it("puedeSerReciente mira el último día del periodo", () => {
    expect(puedeSerReciente({ anio: 2026 }, hoy)).toBe(true);
    expect(puedeSerReciente({ anio: 2026, mes: 11 }, hoy)).toBe(true);
    expect(puedeSerReciente({ anio: 2026, mes: 10 }, hoy)).toBe(true); // llega al 31-10
    expect(puedeSerReciente({ anio: 2026, mes: 9 }, hoy)).toBe(false);
    expect(puedeSerReciente({ anio: 2025 }, hoy, 365)).toBe(true); // llega al 31-12-2025
    expect(puedeSerReciente({ anio: 2024 }, hoy, 365)).toBe(false);
  });

  it("iPhone de estos días: en blanco, con su fecha como sugerencia", () => {
    const r = proponer({ nombreArchivo: "IMG_4521.HEIC", exif: { ...IPHONE, DateTimeOriginal: "2026:11:01 18:00:00", DateTimeDigitized: "2026:11:01 18:00:00" } });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2026-11-01 exif fecha-reciente"]);
    expect(r.motivo).toBe("fecha-reciente");
  });

  it("de hoy, también (Ricard: «si tienen fecha de hoy, seguramente se las ha pasado para el mazo»)", () => {
    const r = proponer({ nombreArchivo: "IMG_20261104_093000.jpg" });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2026-11-04 nombre fecha-reciente"]);
  });

  it("de hace más de una semana, ya se pone sola (las sesiones de fotos de fotos se miran aparte)", () => {
    expect(isoAuto(proponer({ nombreArchivo: "IMG_4521.HEIC", exif: { ...IPHONE, DateTimeOriginal: "2026:10:20 18:00:00" } }))).toBe("2026-10-20");
    expect(isoAuto(proponer({ nombreArchivo: "IMG_20260801_100000.jpg" }))).toBe("2026-08-01");
  });

  it("si la original y el nombre coinciden y son de estos días, sale una sola sugerencia", () => {
    const r = proponer({ nombreArchivo: "IMG_20261102_180000.jpg", exif: { ...IPHONE, DateTimeOriginal: "2026:11:02 18:00:00" } });
    expect(r.sugerencias).toHaveLength(1);
  });
});

describe("proponerFecha: escaneos", () => {
  it("EPSON con solo la fecha de digitalización: en blanco, sin sugerirla, motivo posible-escaneo", () => {
    for (const nombreArchivo of ["img20261030_10000012.jpg", "Scan_0001.jpg", "foto.jpg"]) {
      const r = proponer({ nombreArchivo, exif: { ...EPSON, DateTimeDigitized: "2026:10:30 10:00:00", ModifyDate: "2026:10:31 09:00:00" }, ultimaModificacion: new Date("2026-10-30T10:00:00").getTime() });
      expect(r.automatica).toBeNull();
      expect(r.sugerencias).toEqual([]);
      expect(r.motivo).toBe("posible-escaneo");
      expect(r.senales).toContain("dispositivo-escaner");
    }
  });

  it("un escáner que copia la fecha del escaneo en la original tampoco la usa", () => {
    const r = proponer({ nombreArchivo: "Scan_0002.jpg", exif: { ...EPSON, DateTimeOriginal: "2024:03:01 10:00:00", DateTimeDigitized: "2024:03:01 10:00:00" } });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
  });

  it("original de 1987 y digitalizada en 2026: vale 1987, la que apuntó quien la digitalizó", () => {
    const r = proponer({ nombreArchivo: "DSC00001.jpg", exif: { DateTimeOriginal: "1987:06:01 00:00:00", DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(r.automatica).toMatchObject({ fuente: "exif", confianza: "media", pista: "metadatos" });
    expect(isoAuto(r)).toBe("1987-06-01");
    expect(r.escaneo).toBe(true);
  });

  it("sin fecha de digitalización, la de modificación sirve de referencia en un escaneo", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { ...EPSON, DateTimeOriginal: "1987:06:01 00:00:00", ModifyDate: "2026:10:31 09:00:00" } });
    expect(isoAuto(r)).toBe("1987-06-01");
  });

  it("IPTC «19870000» en un escaneo: vale 1987, la fecha anotada", () => {
    const r = proponer({ nombreArchivo: "FastFoto_0001.jpg", exif: { Software: "FastFoto", IptcDateCreated: "19870000", IptcDigitalCreationDate: "20261030" } });
    expect(isoAuto(r)).toBe("1987");
    expect(r.escaneo).toBe(true);
  });

  it("la fecha anotada igual a la del escaneo no se usa", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { ...EPSON, DateCreated: "2026-10-30", DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
  });

  it("«Scanned_20261030-1000» (Google Drive): ni fecha ni sugerencia", () => {
    const r = proponer({ nombreArchivo: "Scanned_20261030-1000.jpg", ultimaModificacion: new Date("2026-10-30T10:00:00").getTime() });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
    expect(r.motivo).toBe("posible-escaneo");
  });

  it("un nombre de escaneo antiguo tampoco se usa: es la fecha del escaneo", () => {
    const r = proponer({ nombreArchivo: "Scanned_20150612-1000.jpg" });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
  });

  // Nombres que ponen las aplicaciones y utilidades de escaneo: su fecha es la del escaneo.
  // Se pasa una fecha de archivo antigua para comprobar que tampoco se sugiere.
  it.each<[string, MetadatosFecha | null]>([
    ["CamScanner 10-30-2026 10.10.jpg", { Software: "CamScanner" }],
    ["CamScanner 03-10-2025 10.10.jpg", null], // CamScanner pone mes-día-año: no es el 3 de octubre
    ["Adobe Scan Oct 30, 2026.jpg", null],
    ["Genius Scan 20261030.jpg", null],
    ["Office Lens 20241030-101010.jpg", { Software: "Microsoft Lens" }],
    ["IMG_20241030_0001.jpg", { Make: "Canon", Model: "CanoScan LiDE 300" }], // Canon IJ Scan Utility
    ["IMG_20241030_0001.jpg", null],
    ["escaner_001 2026.jpg", null],
    ["escáner 001 2026.jpg", null],
    ["escáner 001 2026.jpg".normalize("NFD"), null],
  ])("%s: nombre de una aplicación de escaneo, ni fecha ni sugerencia", (nombreArchivo, exif) => {
    const r = proponer({ nombreArchivo, exif, ultimaModificacion: new Date("2020-01-01T10:00:00").getTime() });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
    expect(r.motivo).toBe("posible-escaneo");
    expect(r.senales).toContain("nombre-escaneo");
  });

  it("en un escaneo, el año del escaneo escrito en el nombre no se usa", () => {
    for (const anio of [2026, 2025]) {
      const r = proponer({
        nombreArchivo: `foto escaneada ${anio}.jpg`,
        rutaArchivo: `Escaneos/foto escaneada ${anio}.jpg`,
        exif: { Make: "EPSON", Model: "Perfection V39" },
      });
      expect(r.automatica).toBeNull();
      expect(r.sugerencias).toEqual([]);
      expect(r.motivo).toBe("posible-escaneo");
    }
    // Fuera de un escaneo, un año escrito se pone aunque sea el de este año.
    expect(isoAuto(proponer({ nombreArchivo: "foto escaneada 2026.jpg" }))).toBe("2026");
  });

  it("en un escaneo, una fecha con forma de máquina en el nombre tampoco se usa", () => {
    const r = proponer({ nombreArchivo: "Documento 20150612-1000.jpg", rutaArchivo: "Escaneos/Documento 20150612-1000.jpg" });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
    // Fuera de un escaneo, sí.
    expect(isoAuto(proponer({ nombreArchivo: "Documento 20150612-1000.jpg" }))).toBe("2015-06-12");
  });

  it("en un escaneo, las fechas que escribe una persona y no pueden ser del escaneo se siguen usando", () => {
    const enEscaneos = (nombreArchivo: string) => proponer({ nombreArchivo, rutaArchivo: `Escaneos/${nombreArchivo}`, exif: { ...EPSON, DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(isoAuto(enEscaneos("abuelos 1958.jpg"))).toBe("1958");
    expect(isoAuto(enEscaneos("abuelos 2024.jpg"))).toBe("2024");
    expect(isoAuto(enEscaneos("Boda 14-08-2019.jpg"))).toBe("2019-08-14");
    expect(isoAuto(enEscaneos("2015-08 Menorca.jpg"))).toBe("2015-08");
  });

  it("«abuelos 1958» vale aunque la foto venga de un escáner", () => {
    const r = proponer({ nombreArchivo: "abuelos 1958.jpg", rutaArchivo: "Escaneos/abuelos 1958.jpg", exif: { ...EPSON, DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(isoAuto(r)).toBe("1958");
    expect(r.escaneo).toBe(true);
  });

  it("la carpeta de escaneos basta para no fiarse del nombre de la cámara ni de la fecha del archivo", () => {
    const r = proponer({
      nombreArchivo: "IMG_20240814_123045.jpg",
      rutaArchivo: "Fotos digitalizadas/IMG_20240814_123045.jpg",
      ultimaModificacion: new Date("2024-08-14T12:00:00").getTime(),
    });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
    expect(r.senales).toEqual(["carpeta-escaneo"]);
  });

  it("«Escáner/» y «Fotos del escáner/», con tilde y en NFC o NFD, son carpetas de escaneos: no se sugiere la fecha del archivo", () => {
    for (const ruta of ["Escáner/abuela.jpg", "Fotos del escáner/abuela.jpg"]) {
      for (const forma of ["NFC", "NFD"] as const) {
        const r = proponer({ nombreArchivo: "abuela.jpg", rutaArchivo: ruta.normalize(forma), ultimaModificacion: new Date("2020-01-01T10:00:00").getTime() });
        expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo: "posible-escaneo", senales: ["carpeta-escaneo"] });
      }
    }
  });
});

describe("proponerFecha: WhatsApp, mensajería y capturas", () => {
  // Ricard, 20-11-2026: «no elijas fechas si no las tienes claras». La foto pudo hacerse mucho
  // antes de enviarla o de capturarla: el mes queda como sugerencia de un toque, nunca puesto solo.
  it.each([
    ["IMG-20190814-WA0001.jpg", "2019-08", "mes-de-envio"],
    ["WhatsApp Image 2019-08-14 at 12.30.45.jpeg", "2019-08", "mes-de-envio"],
    ["Imagen de WhatsApp 2023-11-02 a las 19.25.31_2a0b0f4c.jpg", "2023-11", "mes-de-envio"],
    ["Imatge de WhatsApp 2023-11-02 a les 19.25.31_2a0b0f4c.jpg", "2023-11", "mes-de-envio"],
    ["Image WhatsApp 2023-11-02 à 19.25.31_2a0b0f4c.jpg", "2023-11", "mes-de-envio"],
    ["photo_2019-08-14_12-30-45.jpg", "2019-08", "mes-de-envio"],
    ["signal-2019-08-14-123045.jpg", "2019-08", "mes-de-envio"],
    ["FB_IMG_1565786400000.jpg", "2019-08", "mes-de-envio"],
    ["1565786400000.jpg", "2019-08", "mes-de-envio"],
    ["Screenshot_2019-08-14-12-30-45.png", "2019-08", "mes-de-captura"],
    ["Captura de pantalla 2019-08-14 a las 12.30.45.png", "2019-08", "mes-de-captura"],
  ])("de hace más de un mes: %s → en blanco, con %s como sugerencia (%s)", (nombreArchivo, iso, motivo) => {
    const r = proponer({ nombreArchivo, ultimaModificacion: new Date("2020-01-01T10:00:00").getTime() });
    expect(r).toMatchObject({ automatica: null, motivo });
    // Solo el mes, y sin la fecha del archivo, que no dice más que la del envío.
    expect(isoSugerencias(r)).toEqual([`${iso} nombre ${motivo}`]);
  });

  it.each([
    ["IMG-20261102-WA0007.jpg", "fecha-de-envio"],
    ["WhatsApp Image 2026-11-04 at 09.15.02.jpeg", "fecha-de-envio"],
    ["Imagen de WhatsApp 2026-10-10 a las 19.25.31_2a0b0f4c.jpg", "fecha-de-envio"],
    ["Screenshot_2026-11-01-12-30-45.png", "captura-de-pantalla"],
  ])("del último mes: %s → en blanco, sin sugerencia (la fecha real se perdió al reenviarla)", (nombreArchivo, motivo) => {
    const r = proponer({ nombreArchivo, ultimaModificacion: hoy.getTime() });
    expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo });
  });

  it("el último mes son DIAS_PREPARACION_ENVIO días", () => {
    expect(DIAS_PREPARACION_ENVIO).toBe(31);
    expect(proponer({ nombreArchivo: "IMG-20261005-WA0001.jpg" }).sugerencias).toEqual([]);
    const antes = proponer({ nombreArchivo: "IMG-20261003-WA0001.jpg" });
    expect(antes.automatica).toBeNull();
    expect(isoSugerencias(antes)).toEqual(["2026-10 nombre mes-de-envio"]);
  });

  it("enviada como documento conserva los datos de la cámara: vale la original", () => {
    const r = proponer({ nombreArchivo: "IMG-20261102-WA0007.jpg", exif: { ...IPHONE, DateTimeOriginal: "2018:07:21 20:00:00" } });
    expect(isoAuto(r)).toBe("2018-07-21");
  });

  it("guardada en una carpeta con su fecha: vale la carpeta", () => {
    const r = proponer({ nombreArchivo: "IMG-20261102-WA0007.jpg", rutaArchivo: "Boda Ana 2014/IMG-20261102-WA0007.jpg" });
    expect(isoAuto(r)).toBe("2014");
  });
});

describe("proponerFecha: la fecha del archivo solo se sugiere", () => {
  it("antigua: sugerencia, nunca se pone sola", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: new Date("2016-07-10T12:00:00").getTime() });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2016-07-10 archivo fecha-del-archivo"]);
  });

  it("del último mes: ni se muestra (es la de la copia)", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: hoy.getTime() });
    expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo: undefined, escaneo: false });
    const haceSemanas = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: new Date("2026-10-15T10:00:00").getTime() });
    expect(haceSemanas.sugerencias).toEqual([]);
  });

  it("no se ofrece si la foto ya tiene fecha", () => {
    const r = proponer({ nombreArchivo: "IMG_20190814_123045.jpg", ultimaModificacion: new Date("2020-01-01T10:00:00").getTime() });
    expect(isoAuto(r)).toBe("2019-08-14");
    expect(r.sugerencias).toEqual([]);
  });

  it("ni la de un reloj a cero", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: new Date("1980-01-01T12:00:00").getTime() });
    expect(r.sugerencias).toEqual([]);
  });

  it("sin nada, en blanco y sin motivo", () => {
    expect(proponer({ nombreArchivo: "foto.jpg" })).toEqual({ automatica: null, sugerencias: [], motivo: undefined, escaneo: false, senales: [] });
  });
});

describe("fechasCompatibles", () => {
  it("compara con un día de margen o por solape de rangos", () => {
    expect(fechasCompatibles({ anio: 2019, mes: 8, dia: 14 }, { anio: 2019, mes: 8, dia: 15 })).toBe(true);
    expect(fechasCompatibles({ anio: 2019, mes: 8, dia: 14 }, { anio: 2019, mes: 8, dia: 16 })).toBe(false);
    expect(fechasCompatibles({ anio: 2019, mes: 8 }, { anio: 2019, mes: 8, dia: 31 })).toBe(true);
    expect(fechasCompatibles({ anio: 2015 }, { anio: 2019, mes: 8, dia: 14 })).toBe(false);
  });
});
