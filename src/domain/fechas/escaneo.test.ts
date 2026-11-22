import { describe, expect, it } from "vitest";
import { esDispositivoEscaner, esNombreDeEscaneo, senalesDeEscaneo, sinDiacriticos } from "./escaneo";
import { proponerFecha, type ResultadoFecha } from "./proponer";
import { crearDetectorSesion, diaDeSesion, idsEnSesionGuardada, MINIMO_SESION_ESCANEO, propuestaDeSesion } from "./sesion";

describe("senalesDeEscaneo: metadatos", () => {
  it.each([
    [{ Make: "EPSON", Model: "Perfection V39" }, "dispositivo-escaner"],
    [{ Make: "SEIKO EPSON CORP.", Model: "FF-680W" }, "dispositivo-escaner"],
    [{ Make: "Canon", Model: "CanoScan LiDE 300" }, "dispositivo-escaner"],
    [{ Make: "Hewlett-Packard", Model: "HP Scanjet G4050" }, "dispositivo-escaner"],
    [{ Make: "FUJITSU", Model: "ScanSnap iX1600" }, "dispositivo-escaner"],
    [{ Make: "Brother", Model: "ADS-1700W" }, "dispositivo-escaner"],
    [{ Make: "Plustek", Model: "OpticFilm 8200i" }, "dispositivo-escaner"],
    [{ Software: "EPSON Scan 2" }, "software-escaneo"],
    [{ Software: "VueScan 9.8.10" }, "software-escaneo"],
    [{ CreatorTool: "SilverFast 9" }, "software-escaneo"],
    [{ OriginatingProgram: "Google PhotoScan" }, "software-escaneo"],
    [{ ProgramasHistorial: ["Photomyne"] }, "software-escaneo"],
    [{ Software: "Microsoft Lens" }, "software-escaneo"],
    [{ Software: "CamScanner" }, "software-escaneo"],
    [{ Software: "Fax y Escáner de Windows" }, "software-escaneo"],
    [{ FileSource: "Film Scanner" }, "fuente-escaner"],
    [{ FileSource: "Reflection Print Scanner" }, "fuente-escaner"],
    [{ SensingMethod: "Trilinear sensor" }, "sensor-lineal"],
    [{ SensingMethod: "Color sequential linear sensor" }, "sensor-lineal"],
  ])("%o → %s", (meta, senal) => {
    expect(senalesDeEscaneo(meta, "foto.jpg")).toContain(senal);
  });

  it.each([
    { Make: "Canon", Model: "Canon EOS 5D Mark IV", Software: "Firmware Version 1.0.2" },
    { Make: "samsung", Model: "SM-G991B", Software: "G991BXXU5CVF3" },
    { Make: "Apple", Model: "iPhone 13", Software: "17.1" },
    { Make: "Google", Model: "Pixel 8", Software: "HDR+ 1.0.540104767zd" },
    { Software: "Snapseed" },
    { Software: "Adobe Photoshop Lightroom Classic 13.0 (Windows)" },
    { Make: "SEIKO EPSON CORP.", Model: "R-D1" },
    { Make: "SEIKO EPSON CORP.", Model: "PhotoPC 3000Z" },
    { FileSource: "Digital Camera", SensingMethod: "One-chip color area sensor" },
  ])("%o no es un escaneo", (meta) => {
    expect(senalesDeEscaneo(meta, "IMG_1234.jpg")).toEqual([]);
  });

  it("Epson sin modelo de cámara es un escáner", () => {
    expect(esDispositivoEscaner("EPSON", undefined)).toBe(true);
    expect(esDispositivoEscaner("EPSON", "R-D1s")).toBe(false);
    expect(esDispositivoEscaner(undefined, undefined)).toBe(false);
  });
});

describe("senalesDeEscaneo: nombre y carpeta", () => {
  it.each(["Scan_0001.jpg", "scan0001.jpg", "Scan 2.jpeg", "Scan 2026-10-30 at 10.00.00.jpeg", "Scanned_20261030-1000.jpg", "scanned photo.jpg", "img20261030_10000012.jpg", "Escaneo_0003.jpg", "PhotoScan_20261030.jpg", "EPSON001.JPG"])(
    "%s es un nombre de escaneo",
    (nombre) => {
      expect(esNombreDeEscaneo(nombre)).toBe(true);
      expect(senalesDeEscaneo(null, nombre)).toEqual(["nombre-escaneo"]);
    },
  );

  it.each([
    "CamScanner 10-30-2026 10.10.jpg",
    "CamScanner 03-10-2025 10.10.jpg",
    "Adobe Scan Oct 30, 2026.jpg",
    "Adobe Scan 30 oct 2026.jpg",
    "Genius Scan 20261030.jpg",
    "Office Lens 20241030-101010.jpg",
    "Microsoft Lens 20241030.jpg",
    "ScanSnap_0001.jpg",
    "IMG_20241030_0001.jpg", // Canon IJ Scan Utility
    "IMG_20241030_0001 (1).jpg",
    "escaner_001 2026.jpg",
    "escáner 001 2026.jpg",
    "Escáneres 1.jpg",
    "Scans 2026.jpg",
    "Epson_0001.jpg",
  ])("%s es un nombre de aplicación o de utilidad de escaneo", (nombre) => {
    expect(esNombreDeEscaneo(nombre)).toBe(true);
    expect(esNombreDeEscaneo(nombre.normalize("NFD"))).toBe(true);
    expect(senalesDeEscaneo(null, nombre)).toEqual(["nombre-escaneo"]);
  });

  it.each([
    "IMG_20190814_123045.jpg",
    "IMG20190814123045.jpg",
    "IMG_20190814_1230451.jpg",
    "Scandinavia 2015.jpg",
    "verano 2015.jpg",
    "foto escaneada 1987.jpg",
    "foto escaneada 2026.jpg",
    "mi scan favorito 1990.jpg",
    "IMG-20190814-WA0001.jpg",
  ])("%s no es un nombre de escaneo", (nombre) => {
    expect(esNombreDeEscaneo(nombre)).toBe(false);
  });

  it.each(["Escaneos/abuelos.jpg", "Fotos escaneadas/1.jpg", "Scans/1.jpg", "familia/Digitalizadas/1.jpg", "Albums digitized/1.jpg", "Fotos digitalitzades/1.jpg"])("la carpeta de %s es de escaneos", (ruta) => {
    expect(senalesDeEscaneo(null, ruta)).toEqual(["carpeta-escaneo"]);
  });

  it.each([
    ["Escáner/abuela.jpg", "NFC"],
    ["Escáner/abuela.jpg", "NFD"],
    ["Fotos del escáner/abuela.jpg", "NFC"],
    ["Fotos del escáner/abuela.jpg", "NFD"],
    ["Escaner/abuela.jpg", "NFC"],
  ] as const)("la carpeta de %s (%s) es de escaneos, con tilde o sin ella", (ruta, forma) => {
    expect(senalesDeEscaneo(null, ruta.normalize(forma))).toEqual(["carpeta-escaneo"]);
  });

  it("sinDiacriticos quita tildes, diéresis y cedillas venga el texto en NFC o en NFD", () => {
    expect(sinDiacriticos("Fotos del escáner")).toBe("Fotos del escaner");
    expect(sinDiacriticos("Fotos del escáner".normalize("NFD"))).toBe("Fotos del escaner");
    expect(sinDiacriticos("Pingüino, Çaçador, año")).toBe("Pinguino, Cacador, ano");
  });

  it.each(["Scandinavia 2015/IMG_1.jpg", "Vacaciones/IMG_1.jpg", "IMG_1.jpg"])("la carpeta de %s no", (ruta) => {
    expect(senalesDeEscaneo(null, ruta)).toEqual([]);
  });
});

describe("sesiones de fotos de fotos en una subida", () => {
  const hoy = new Date(2026, 10, 20, 12);
  const camara = (iso: string, extra = ""): ResultadoFecha =>
    proponerFecha({ nombreArchivo: `IMG_${iso.replaceAll("-", "")}_1015${extra || "00"}.jpg`, exif: { Make: "Apple", Model: "iPhone 13", DateTimeOriginal: `${iso.replaceAll("-", ":")} 10:15:00` }, hoy });

  it("diaDeSesion: solo fechas de cámara con día de las últimas semanas", () => {
    expect(diaDeSesion(camara("2026-11-02"), hoy)).toBe("2026-11-02");
    expect(diaDeSesion(camara("2026-09-25"), hoy)).toBe("2026-09-25");
    expect(diaDeSesion(camara("2026-08-01"), hoy)).toBeNull();
    expect(diaDeSesion(proponerFecha({ nombreArchivo: "2026-11-02 cena.jpg", hoy }), hoy)).toBeNull(); // escrita por una persona
    expect(diaDeSesion(proponerFecha({ nombreArchivo: "IMG-20261002-WA0001.jpg", hoy }), hoy)).toBeNull(); // envío
  });

  it("al llegar al mínimo del mismo día, esa foto y las anteriores de ese día van en blanco", () => {
    expect(MINIMO_SESION_ESCANEO).toBe(5);
    const d = crearDetectorSesion(hoy);
    for (const id of ["a", "b", "c", "d"]) expect(d.registrar(id, camara("2026-11-02"))).toEqual({ enBlanco: false, anteriores: [] });
    expect(d.registrar("x", camara("2026-10-30"))).toEqual({ enBlanco: false, anteriores: [] });
    expect(d.registrar("e", camara("2026-11-02"))).toEqual({ enBlanco: true, anteriores: ["a", "b", "c", "d"] });
    expect(d.registrar("f", camara("2026-11-02"))).toEqual({ enBlanco: true, anteriores: [] });
    // Otro día no se contagia.
    expect(d.registrar("y", camara("2026-10-30"))).toEqual({ enBlanco: false, anteriores: [] });
  });

  it("idsEnSesionGuardada: en un mazo guardado, sugerencias recientes repetidas del mismo día", () => {
    const anadida = new Date(2026, 10, 18, 12).getTime();
    const carta = (id: string, dia: number, motivo: "fecha-reciente" | "fecha-de-envio" = "fecha-reciente") => ({
      id,
      fecha: null,
      anadidaEn: anadida,
      sugerencias: [{ fecha: { anio: 2026, mes: 10, dia }, motivo }],
    });
    const cartas = [...["a", "b", "c", "d", "e"].map((id) => carta(id, 25)), carta("f", 24), ...["g", "h", "i", "j", "k"].map((id) => carta(id, 20, "fecha-de-envio"))];
    expect([...idsEnSesionGuardada(cartas)].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(idsEnSesionGuardada(cartas.slice(1))).toEqual(new Set());
  });

  it("propuestaDeSesion: la fecha puesta sola pasa a sugerencia, como viaja por el enlace", () => {
    const r = propuestaDeSesion(camara("2026-11-02"));
    expect(r).toMatchObject({ automatica: null, motivo: "sesion-de-escaneo", sugerencias: [{ fecha: { anio: 2026, mes: 11, dia: 2 }, fuente: "exif", motivo: "sesion-de-escaneo" }] });
    // Y el detector del dueño ya no la cuenta: no hay nada que dejar en blanco.
    expect(diaDeSesion(r, hoy)).toBeNull();
    // Una propuesta ya en blanco no cambia.
    const enBlanco = proponerFecha({ nombreArchivo: "foto.jpg", hoy });
    expect(propuestaDeSesion(enBlanco)).toBe(enBlanco);
  });
});
