import { describe, expect, it } from "vitest";
import { aIso } from "./fecha";
import { esFechaDeRelojPorDefecto, leerFechaMetadato, metadatosDesdeExifr, primeraFechaUtil, type MetadatosFecha } from "./exif";
import { DIAS_FECHA_RECIENTE, esFechaReciente, fechasCompatibles, proponerFecha, puedeSerReciente, type EntradaPropuesta, type ResultadoFecha } from "./proponer";

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

describe("proponerFecha: se rellena sola solo si es segura", () => {
  it("A) fecha original de una cámara: exif, confianza alta", () => {
    const r = proponer({ nombreArchivo: "DSC01234.JPG", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00", DateTimeDigitized: "2019:08:14 18:30:00" } });
    expect(r.automatica).toEqual({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta" });
    expect(r.sugerencias).toEqual([]);
    expect(r.escaneo).toBe(false);
  });

  it("A) una cámara con un programa de edición sigue siendo una cámara (Snapseed)", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { Make: "samsung", Model: "SM-G991B", Software: "Snapseed", DateTimeOriginal: "2021:05:01 12:00:00" } });
    expect(isoAuto(r)).toBe("2021-05-01");
  });

  it("A) el nombre más vago que coincide no impide la fecha completa de la cámara", () => {
    const r = proponer({ nombreArchivo: "verano 2019.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00" } });
    expect(isoAuto(r)).toBe("2019-08-14");
  });

  it.each([
    ["IMG_20190814_123045.jpg", "2019-08-14"],
    ["PXL_20190814_123045123.MP.jpg", "2019-08-14"],
    ["20190814_123045.jpg", "2019-08-14"],
    ["IMG20190814123045.jpg", "2019-08-14"],
    ["2019-08-14 12.30.45.jpg", "2019-08-14"],
  ])("B) nombre de la cámara del móvil sin fecha original: %s → nombre, media", (nombreArchivo, iso) => {
    const r = proponer({ nombreArchivo, exif: null, ultimaModificacion: hoy.getTime() });
    expect(r.automatica).toMatchObject({ fuente: "nombre", confianza: "media" });
    expect(isoAuto(r)).toBe(iso);
  });

  it("B) si la fecha original es la de un reloj sin configurar, vale el nombre de la cámara", () => {
    const r = proponer({ nombreArchivo: "IMG_20150814_120000.jpg", exif: { ...CANON, DateTimeOriginal: "2000:01:01 00:00:00" } });
    expect(isoAuto(r)).toBe("2015-08-14");
  });

  it.each([
    ["abuelos 1958.jpg", "1958"],
    ["2015-08 Menorca.jpg", "2015-08"],
    ["Boda 14-08-2019.jpg", "2019-08-14"],
    ["14 de agosto de 2019.jpg", "2019-08-14"],
    ["2019-08-14 playa.jpg", "2019-08-14"],
  ])("C) fecha escrita por una persona: %s → %s", (nombreArchivo, iso) => {
    const r = proponer({ nombreArchivo });
    expect(r.automatica).toMatchObject({ fuente: "nombre", confianza: "media" });
    expect(isoAuto(r)).toBe(iso);
  });

  it("C) «abuelos 1958» se rellena aunque la foto venga de un escáner", () => {
    const r = proponer({ nombreArchivo: "abuelos 1958.jpg", rutaArchivo: "Escaneos/abuelos 1958.jpg", exif: { ...EPSON, DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(isoAuto(r)).toBe("1958");
    expect(r.escaneo).toBe(true);
  });

  it("C) una foto antigua fotografiada con el móvil y con el año escrito en el nombre: vale el nombre", () => {
    const r = proponer({ nombreArchivo: "verano 2015.jpg", exif: { ...IPHONE, DateTimeOriginal: "2026:10:30 18:00:00" } });
    expect(isoAuto(r)).toBe("2015");
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

  it("un escáner que copia la fecha del escaneo en la original tampoco la sugiere", () => {
    const r = proponer({ nombreArchivo: "Scan_0002.jpg", exif: { ...EPSON, DateTimeOriginal: "2024:03:01 10:00:00", DateTimeDigitized: "2024:03:01 10:00:00" } });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
  });

  it("original de 1987 y digitalizada en 2026: sugiere 1987 (digitalizada después)", () => {
    const r = proponer({ nombreArchivo: "DSC00001.jpg", exif: { DateTimeOriginal: "1987:06:01 00:00:00", DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["1987-06-01 exif digitalizada-despues"]);
    expect(r.motivo).toBe("posible-escaneo");
    expect(r.escaneo).toBe(true);
  });

  it("sin fecha de digitalización, la de modificación sirve de referencia en un escaneo", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { ...EPSON, DateTimeOriginal: "1987:06:01 00:00:00", ModifyDate: "2026:10:31 09:00:00" } });
    expect(isoSugerencias(r)).toEqual(["1987-06-01 exif digitalizada-despues"]);
  });

  it("IPTC «19870000» en un escaneo: sugiere 1987 como fecha anotada", () => {
    const r = proponer({ nombreArchivo: "FastFoto_0001.jpg", exif: { Software: "FastFoto", IptcDateCreated: "19870000", IptcDigitalCreationDate: "20261030" } });
    expect(isoSugerencias(r)).toEqual(["1987 exif fecha-anotada"]);
    expect(r.motivo).toBe("posible-escaneo");
  });

  it("la fecha anotada igual a la del escaneo no se sugiere", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { ...EPSON, DateCreated: "2026-10-30", DateTimeDigitized: "2026:10:30 10:00:00" } });
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

  it("en un escaneo, el año del escaneo escrito en el nombre no se rellena ni se sugiere", () => {
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
    // Fuera de un escaneo, un año escrito se rellena aunque sea el de este año.
    expect(isoAuto(proponer({ nombreArchivo: "foto escaneada 2026.jpg" }))).toBe("2026");
  });

  it("en un escaneo, una fecha con forma de máquina en el nombre tampoco se rellena", () => {
    const r = proponer({ nombreArchivo: "Documento 20150612-1000.jpg", rutaArchivo: "Escaneos/Documento 20150612-1000.jpg" });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias).toEqual([]);
    // Fuera de un escaneo, sí.
    expect(isoAuto(proponer({ nombreArchivo: "Documento 20150612-1000.jpg" }))).toBe("2015-06-12");
  });

  it("en un escaneo, las fechas que escribe una persona y no pueden ser del escaneo se siguen rellenando", () => {
    const enEscaneos = (nombreArchivo: string) => proponer({ nombreArchivo, rutaArchivo: `Escaneos/${nombreArchivo}`, exif: { ...EPSON, DateTimeDigitized: "2026:10:30 10:00:00" } });
    expect(isoAuto(enEscaneos("abuelos 1958.jpg"))).toBe("1958");
    expect(isoAuto(enEscaneos("abuelos 2024.jpg"))).toBe("2024");
    expect(isoAuto(enEscaneos("Boda 14-08-2019.jpg"))).toBe("2019-08-14");
    expect(isoAuto(enEscaneos("2015-08 Menorca.jpg"))).toBe("2015-08");
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

describe("proponerFecha: fechas recientes", () => {
  it("el umbral es de un año, solo para fechas con día", () => {
    expect(DIAS_FECHA_RECIENTE).toBe(365);
    expect(esFechaReciente({ anio: 2025, mes: 11, dia: 5 }, hoy)).toBe(true);
    expect(esFechaReciente({ anio: 2025, mes: 11, dia: 4 }, hoy)).toBe(false);
    expect(esFechaReciente({ anio: 2026, mes: 10 }, hoy)).toBe(false);
    expect(esFechaReciente({ anio: 2026, mes: 10, dia: 1 }, hoy, 30)).toBe(false);
  });

  it("iPhone con fecha reciente: sugerencia, no se rellena", () => {
    const r = proponer({ nombreArchivo: "IMG_4521.HEIC", exif: { ...IPHONE, DateTimeOriginal: "2026:10:30 18:00:00", DateTimeDigitized: "2026:10:30 18:00:00" } });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2026-10-30 exif fecha-reciente"]);
    expect(r.motivo).toBe("fecha-reciente");
  });

  it("en un escaneo, puede ser reciente cualquier fecha cuyo periodo toque el último año", () => {
    expect(puedeSerReciente({ anio: 2026 }, hoy)).toBe(true);
    expect(puedeSerReciente({ anio: 2025 }, hoy)).toBe(true); // llega al 31-12-2025
    expect(puedeSerReciente({ anio: 2024 }, hoy)).toBe(false);
    expect(puedeSerReciente({ anio: 2025, mes: 11 }, hoy)).toBe(true);
    expect(puedeSerReciente({ anio: 2025, mes: 10 }, hoy)).toBe(false);
    // Con día, igual que esFechaReciente.
    expect(puedeSerReciente({ anio: 2025, mes: 11, dia: 5 }, hoy)).toBe(true);
    expect(puedeSerReciente({ anio: 2025, mes: 11, dia: 4 }, hoy)).toBe(false);
  });

  it("el umbral se puede ajustar", () => {
    const r = proponerFecha({ nombreArchivo: "IMG_4521.HEIC", exif: { ...IPHONE, DateTimeOriginal: "2026:08:01 18:00:00" }, hoy, diasReciente: 30 });
    expect(isoAuto(r)).toBe("2026-08-01");
  });

  it("nombre de cámara reciente: sugerencia", () => {
    const r = proponer({ nombreArchivo: "IMG_20261030_100000.jpg" });
    expect(isoSugerencias(r)).toEqual(["2026-10-30 nombre fecha-reciente"]);
  });

  it("una fecha reciente con día escrita en el nombre se sugiere, pero el mes o el año se rellenan", () => {
    expect(isoSugerencias(proponer({ nombreArchivo: "2026-10-30 abuelos.jpg" }))).toEqual(["2026-10-30 nombre fecha-reciente"]);
    expect(isoAuto(proponer({ nombreArchivo: "2026-10 Menorca.jpg" }))).toBe("2026-10");
  });

  it("si la original y el nombre coinciden y son recientes, sale una sola sugerencia", () => {
    const r = proponer({ nombreArchivo: "IMG_20261030_180000.jpg", exif: { ...IPHONE, DateTimeOriginal: "2026:10:30 18:00:00" } });
    expect(r.sugerencias).toHaveLength(1);
  });
});

describe("proponerFecha: mensajería y capturas, solo sugerencias", () => {
  it.each([
    ["IMG-20190814-WA0001.jpg", "2019-08-14", "fecha-de-envio"],
    ["IMG-20261102-WA0007.jpg", "2026-11-02", "fecha-de-envio"],
    ["WhatsApp Image 2019-08-14 at 12.30.45.jpeg", "2019-08-14", "fecha-de-envio"],
    ["Imagen de WhatsApp 2023-11-02 a las 19.25.31_2a0b0f4c.jpg", "2023-11-02", "fecha-de-envio"],
    ["Imatge de WhatsApp 2023-11-02 a les 19.25.31_2a0b0f4c.jpg", "2023-11-02", "fecha-de-envio"],
    ["Image WhatsApp 2023-11-02 à 19.25.31_2a0b0f4c.jpg", "2023-11-02", "fecha-de-envio"],
    // Reciente o no, sigue siendo la fecha de envío.
    ["Imagen de WhatsApp 2026-10-02 a las 19.25.31_2a0b0f4c.jpg", "2026-10-02", "fecha-de-envio"],
    ["photo_2019-08-14_12-30-45.jpg", "2019-08-14", "fecha-de-envio"],
    ["signal-2019-08-14-123045.jpg", "2019-08-14", "fecha-de-envio"],
    ["FB_IMG_1565786400000.jpg", "2019-08-14", "fecha-de-envio"],
    ["1565786400000.jpg", "2019-08-14", "fecha-de-envio"],
    ["Screenshot_2019-08-14-12-30-45.png", "2019-08-14", "captura-de-pantalla"],
    ["Captura de pantalla 2019-08-14 a las 12.30.45.png", "2019-08-14", "captura-de-pantalla"],
  ])("%s → sugerencia %s (%s)", (nombreArchivo, iso, motivo) => {
    const r = proponer({ nombreArchivo, ultimaModificacion: new Date("2020-01-01T10:00:00").getTime() });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual([`${iso} nombre ${motivo}`]);
    expect(r.motivo).toBe(motivo);
  });
});

describe("proponerFecha: fecha del archivo, último recurso", () => {
  it("antigua: sugerencia de confianza baja", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: new Date("2016-07-10T12:00:00").getTime() });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2016-07-10 archivo fecha-del-archivo"]);
  });

  it("reciente: ni se muestra", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: hoy.getTime() });
    expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo: undefined, escaneo: false });
    const haceMeses = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: new Date("2026-03-01T10:00:00").getTime() });
    expect(haceMeses.sugerencias).toEqual([]);
  });

  it("no se ofrece si hay pistas mejores", () => {
    const r = proponer({ nombreArchivo: "IMG-20190814-WA0001.jpg", ultimaModificacion: new Date("2020-01-01T10:00:00").getTime() });
    expect(r.sugerencias).toHaveLength(1);
  });

  it("ni la de un reloj a cero", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", ultimaModificacion: new Date("1980-01-01T12:00:00").getTime() });
    expect(r.sugerencias).toEqual([]);
  });

  it("sin nada, en blanco y sin motivo", () => {
    expect(proponer({ nombreArchivo: "foto.jpg" })).toEqual({ automatica: null, sugerencias: [], motivo: undefined, escaneo: false, senales: [] });
  });
});

describe("proponerFecha: dudas", () => {
  it("la original de cámara y el año escrito en el nombre no coinciden: sugiere los dos, primero el escrito", () => {
    const r = proponer({ nombreArchivo: "verano 2015.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00" } });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2015 nombre exif-y-nombre-no-coinciden", "2019-08-14 exif exif-y-nombre-no-coinciden"]);
  });

  // Decisión pendiente de Ricard: el encargo solo pedía bloquear con otro día; también se bloquea
  // con un año o un mes escritos que no coinciden, para no rellenar sola una fecha que la persona contradice.
  it("un mes escrito que no coincide con la cámara también la deja en blanco, primero el escrito", () => {
    const r = proponer({ nombreArchivo: "Menorca 2019-07.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 18:30:00" } });
    expect(r.automatica).toBeNull();
    expect(isoSugerencias(r)).toEqual(["2019-07 nombre exif-y-nombre-no-coinciden", "2019-08-14 exif exif-y-nombre-no-coinciden"]);
  });

  it.each<[string, MetadatosFecha]>([
    ["IMGP2015.JPG", { Make: "PENTAX", Model: "PENTAX K-5", tieneExposicion: true }],
    ["SDIM2001.JPG", { Make: "SIGMA", Model: "SIGMA dp2 Quattro", tieneExposicion: true }],
    ["100_1987.JPG", { Make: "EASTMAN KODAK COMPANY", Model: "KODAK EASYSHARE C513 DIGITAL CAMERA", tieneExposicion: true }],
  ])("%s: el contador de la cámara no choca con su fecha ni se toma por un año", (nombreArchivo, camara) => {
    const conCamara = proponer({ nombreArchivo, exif: { ...camara, DateTimeOriginal: "2019:08:14 18:30:00" } });
    expect(conCamara.automatica).toEqual({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta" });
    // Reexportada sin metadatos: ni el «año» del contador ni nada.
    const sinExif = proponer({ nombreArchivo });
    expect(sinExif.automatica).toBeNull();
    expect(sinExif.sugerencias).toEqual([]);
  });

  it("si el nombre de la cámara dice otro día, primero la original", () => {
    const r = proponer({ nombreArchivo: "IMG_20150101_120000.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 12:00:00" } });
    expect(isoSugerencias(r)).toEqual(["2019-08-14 exif exif-y-nombre-no-coinciden", "2015-01-01 nombre exif-y-nombre-no-coinciden"]);
  });

  it("un día de diferencia entre la original y el nombre se tolera (zonas horarias)", () => {
    const r = proponer({ nombreArchivo: "IMG_20190815_003000.jpg", exif: { ...CANON, DateTimeOriginal: "2019:08:14 23:30:00" } });
    expect(isoAuto(r)).toBe("2019-08-14");
  });

  it("original sin datos de cámara: sugerencia", () => {
    const r = proponer({ nombreArchivo: "foto.jpg", exif: { DateTimeOriginal: "2012:05:05 10:00:00" } });
    expect(isoSugerencias(r)).toEqual(["2012-05-05 exif sin-datos-de-camara"]);
  });

  it("si coincide con el nombre de la cámara, la original sin datos de cámara se rellena con el nombre", () => {
    const r = proponer({ nombreArchivo: "PXL_20120505_100000000.jpg", exif: { DateTimeOriginal: "2012:05:05 10:00:00" } });
    expect(isoAuto(r)).toBe("2012-05-05");
  });

  it("solo la fecha de digitalización de una cámara: sugerencia", () => {
    const r = proponer({ nombreArchivo: "DSC00001.jpg", exif: { ...CANON, DateTimeDigitized: "2012:05:05 10:00:00" } });
    expect(isoSugerencias(r)).toEqual(["2012-05-05 exif fecha-digitalizacion"]);
  });

  it("una fecha de reloj sin configurar no se sugiere y lo explica", () => {
    const r = proponer({ nombreArchivo: "DSC00001.jpg", exif: { ...CANON, DateTimeOriginal: "2001:01:01 00:00:00" } });
    expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo: "reloj-de-camara" });
  });

  it("como mucho dos sugerencias, sin repetir fechas", () => {
    const r = proponer({
      nombreArchivo: "IMG-20200101-WA0001.jpg",
      exif: { DateTimeOriginal: "2026:10:01 10:00:00", DateCreated: "1999" },
      ultimaModificacion: new Date("2018-01-01T10:00:00").getTime(),
    });
    expect(r.sugerencias).toHaveLength(2);
    expect(new Set(r.sugerencias.map((s) => aIso(s.fecha))).size).toBe(2);
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
