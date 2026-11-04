import { describe, expect, it } from "vitest";
import { esDispositivoEscaner, esNombreDeEscaneo, senalesDeEscaneo, sinDiacriticos } from "./escaneo";
import { sesionDeEscaneo } from "./sesion";

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

describe("sesionDeEscaneo", () => {
  const reciente = (dia: number) => ({ fecha: null, sugerencias: [{ fecha: { anio: 2026, mes: 10, dia }, motivo: "fecha-reciente" as const }] });
  it("detecta muchas fotos sin fecha cuya pista es el mismo día reciente", () => {
    const cartas = [...Array.from({ length: 6 }, () => reciente(30)), reciente(29), { fecha: { anio: 2019 } }];
    expect(sesionDeEscaneo(cartas)).toEqual({ dia: { anio: 2026, mes: 10, dia: 30 }, fotos: 6 });
  });

  it("no avisa con pocas fotos, con otras pistas o con fechas ya puestas", () => {
    expect(sesionDeEscaneo(Array.from({ length: 4 }, () => reciente(30)))).toBeNull();
    const envio = { fecha: null, sugerencias: [{ fecha: { anio: 2026, mes: 10, dia: 30 }, motivo: "fecha-de-envio" as const }] };
    expect(sesionDeEscaneo(Array.from({ length: 8 }, () => envio))).toBeNull();
    expect(sesionDeEscaneo(Array.from({ length: 8 }, () => ({ ...reciente(30), fecha: { anio: 2026, mes: 10, dia: 30 } })))).toBeNull();
  });
});
