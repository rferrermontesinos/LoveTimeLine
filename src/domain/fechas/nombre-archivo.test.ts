import { describe, expect, it } from "vitest";
import { aIso } from "./fecha";
import { fechaDesdeNombre, origenDeNombre } from "./nombre-archivo";

const hoy = new Date("2026-11-04T10:00:00Z");
const iso = (nombre: string) => {
  const r = fechaDesdeNombre(nombre, { hoy });
  return r ? aIso(r.fecha) : null;
};
const patron = (nombre: string) => fechaDesdeNombre(nombre, { hoy })?.patron ?? null;

describe("fechaDesdeNombre: fecha completa", () => {
  it.each([
    ["IMG_20190814_123045.jpg", "2019-08-14"],
    ["IMG_20190814_123045_HDR.jpg", "2019-08-14"],
    ["PXL_20190814_123045123.jpg", "2019-08-14"],
    ["PXL_20190814_123045123.MP.jpg", "2019-08-14"],
    ["MVIMG_20190814_123045.jpg", "2019-08-14"],
    ["VID_20190814_123045.mp4", "2019-08-14"],
    ["IMG-20190814-WA0001.jpg", "2019-08-14"],
    ["IMG-20190814-WA0001.jpeg", "2019-08-14"],
    ["20190814_123045.jpg", "2019-08-14"],
    ["20190814123045.jpg", "2019-08-14"],
    ["2019-08-14 playa.jpg", "2019-08-14"],
    ["2019-08-14_12-30-45.jpg", "2019-08-14"],
    ["2019_08_14 cumple.png", "2019-08-14"],
    ["2019.08.14.jpg", "2019-08-14"],
    ["Screenshot_2019-08-14-12-30-45.png", "2019-08-14"],
    ["Screenshot_20190814-123045.png", "2019-08-14"],
    ["Screenshot_20190814-123045_WhatsApp.jpg", "2019-08-14"],
    ["Captura de pantalla 2019-08-14 a las 12.30.45.png", "2019-08-14"],
    ["Screen Shot 2019-08-14 at 12.30.45.png", "2019-08-14"],
    ["Screenshot 2019-08-14 at 12.30.45.png", "2019-08-14"],
    ["photo_2019-08-14_12-30-45.jpg", "2019-08-14"],
    ["signal-2019-08-14-123045.jpg", "2019-08-14"],
    ["fotos/viajes/IMG_20190814_123045.HEIC", "2019-08-14"],
  ])("%s → %s", (nombre, esperado) => {
    expect(iso(nombre)).toBe(esperado);
  });

  it("reconoce el día primero, como se escribe en España", () => {
    expect(iso("Boda 14-08-2019.jpg")).toBe("2019-08-14");
    expect(iso("cena 3.5.2018.jpg")).toBe("2018-05-03");
    expect(patron("Boda 14-08-2019.jpg")).toBe("dia-mes-anio");
  });

  it("reconoce marcas de tiempo en milisegundos", () => {
    expect(iso("FB_IMG_1565786400000.jpg")).toBe("2019-08-14");
    expect(iso("1565786400000.jpg")).toBe("2019-08-14");
    expect(patron("FB_IMG_1565786400000.jpg")).toBe("marca-tiempo");
  });

  it("reconoce el mes escrito en español, inglés y catalán", () => {
    expect(iso("14 de agosto de 2019.jpg")).toBe("2019-08-14");
    expect(iso("agosto 2019 Menorca.jpg")).toBe("2019-08");
    expect(iso("Navidad diciembre de 2010.jpg")).toBe("2010-12");
    expect(iso("August 2015 trip.jpg")).toBe("2015-08");
    expect(iso("2015 agosto.jpg")).toBe("2015-08");
    expect(iso("juliol 2016 Cadaqués.jpg")).toBe("2016-07");
    expect(iso("març 2017.jpg")).toBe("2017-03");
  });
});

describe("fechaDesdeNombre: año y mes", () => {
  it.each([
    ["2015-08 Menorca.jpg", "2015-08"],
    ["2015_08_Menorca.jpg", "2015-08"],
    ["viaje 2015.08.jpg", "2015-08"],
  ])("%s → %s", (nombre, esperado) => {
    expect(iso(nombre)).toBe(esperado);
    expect(patron(nombre)).toBe("anio-mes");
  });
});

describe("fechaDesdeNombre: año suelto", () => {
  it.each([
    ["verano 2015.jpg", "2015"],
    ["Navidad_2008.jpeg", "2008"],
    ["abuelos 1958.jpg", "1958"],
    ["boda-1987-iglesia.jpg", "1987"],
  ])("%s → %s", (nombre, esperado) => {
    expect(iso(nombre)).toBe(esperado);
    expect(patron(nombre)).toBe("anio");
  });

  it("no confunde contadores de cámara con años", () => {
    expect(iso("IMG_2015.jpg")).toBeNull();
    expect(iso("DSC_2019.JPG")).toBeNull();
    expect(iso("DSC02015.jpg")).toBeNull();
    expect(iso("P1010045.JPG")).toBeNull();
    expect(iso("GOPR2016.JPG")).toBeNull();
  });

  it.each([
    "IMGP2015.JPG", // Pentax
    "_IGP2015.JPG", // Pentax en Adobe RGB
    "SDIM2001.JPG", // Sigma
    "SDIM2001.X3F.jpg",
    "SANY1999.JPG", // Sanyo
    "100_1987.JPG", // Kodak: carpeta 100, foto 1987
    "ABCD2015.JPG", // cualquier marca con nombres del estándar DCF
    "IMGP2015-Edit.jpg",
    "SDIM2001 (1).jpg",
  ])("%s es un contador de cámara, no un año", (nombre) => {
    expect(iso(nombre)).toBeNull();
  });

  it("a cambio, cuatro letras pegadas al año también se toman por un contador", () => {
    expect(iso("Roma2014.jpg")).toBeNull();
    // Con un espacio, un guion o más letras, es un año escrito por una persona.
    expect(iso("Roma 2014.jpg")).toBe("2014");
    expect(iso("Roma-2014.jpg")).toBe("2014");
    expect(iso("Navidad2014.jpg")).toBe("2014");
    expect(iso("1958.jpg")).toBe("1958");
  });

  it("no confunde medidas con años", () => {
    expect(iso("fondo 1920x1080.jpg")).toBeNull();
    expect(iso("banner 2048px.png")).toBeNull();
  });

  it("descarta nombres con dos años distintos", () => {
    expect(iso("recopilatorio 1998-2003.jpg")).toBeNull();
  });
});

describe("fechaDesdeNombre: descartes", () => {
  it.each([
    "IMG_1234.jpg",
    "foto.jpg",
    "WhatsApp Image.jpeg",
    "IMG_20191345_123045.jpg", // mes 13
    "IMG_20190230_123045.jpg", // 30 de febrero
    "2031-01-01 futuro.jpg", // futuro
    "1200-01-01.jpg", // demasiado antiguo
    "telefono 600123456.jpg",
  ])("%s → sin fecha", (nombre) => {
    expect(iso(nombre)).toBeNull();
  });

  it("no acepta la fecha de mañana", () => {
    expect(iso("IMG_20261105_100000.jpg")).toBeNull();
    expect(iso("IMG_20261104_100000.jpg")).toBe("2026-11-04");
  });
});

describe("fechaDesdeNombre: de dónde sale la fecha", () => {
  const origen = (nombre: string) => fechaDesdeNombre(nombre, { hoy })?.origen ?? null;

  it.each([
    ["IMG_20190814_123045.jpg", "camara"],
    ["IMG_20190814_123045_HDR.jpg", "camara"],
    ["PXL_20190814_123045123.MP.jpg", "camara"],
    ["MVIMG_20190814_123045.jpg", "camara"],
    ["IMG20190814123045.jpg", "camara"],
    ["20190814_123045.jpg", "camara"],
    ["20190814123045.jpg", "camara"],
    ["2019-08-14 12.30.45.jpg", "camara"],
    ["fotos/viajes/IMG_20190814_123045.HEIC", "camara"],
    ["IMG-20190814-WA0001.jpg", "mensajeria"],
    ["WhatsApp Image 2019-08-14 at 12.30.45.jpeg", "mensajeria"],
    // WhatsApp Web y de escritorio en otros idiomas
    ["Imagen de WhatsApp 2023-11-02 a las 19.25.31_2a0b0f4c.jpg", "mensajeria"],
    ["Imatge de WhatsApp 2023-11-02 a les 19.25.31_2a0b0f4c.jpg", "mensajeria"],
    ["Image WhatsApp 2023-11-02 à 19.25.31_2a0b0f4c.jpg", "mensajeria"],
    ["Imagem do WhatsApp de 2023-11-02 à(s) 19.25.31_2a0b0f4c.jpg", "mensajeria"],
    ["WhatsApp Bild 2023-11-02 um 19.25.31_2a0b0f4c.jpg", "mensajeria"],
    ["Vídeo de WhatsApp 2023-11-02 a las 19.25.31_2a0b0f4c.mp4", "mensajeria"],
    ["photo_2019-08-14_12-30-45.jpg", "mensajeria"],
    ["signal-2019-08-14-123045.jpg", "mensajeria"],
    ["FB_IMG_1565786400000.jpg", "mensajeria"],
    ["1565786400000.jpg", "mensajeria"],
    ["Screenshot_2019-08-14-12-30-45.png", "captura"],
    ["Screenshot_20190814-123045_WhatsApp.jpg", "captura"],
    ["Screen Shot 2019-08-14 at 12.30.45.png", "captura"],
    ["Captura de pantalla 2019-08-14 a las 12.30.45.png", "captura"],
    ["Scanned_20190814-1000.jpg", "escaneo"],
    ["img20190814_10000012.jpg", "escaneo"],
    ["Scan 2019-08-14 at 10.00.00.jpeg", "escaneo"],
    ["CamScanner 10-30-2024 10.10.jpg", "escaneo"],
    ["Adobe Scan Oct 30, 2024.jpg", "escaneo"],
    ["Office Lens 20241030-101010.jpg", "escaneo"],
    ["IMG_20241030_0001.jpg", "escaneo"],
    ["escáner_001 2024.jpg", "escaneo"],
    ["verano 2015.jpg", "escrito"],
    ["abuelos 1958.jpg", "escrito"],
    ["2015-08 Menorca.jpg", "escrito"],
    ["2019-08-14 playa.jpg", "escrito"],
    ["Boda 14-08-2019.jpg", "escrito"],
    ["14 de agosto de 2019.jpg", "escrito"],
    ["foto escaneada 1987.jpg", "escrito"],
  ])("%s → %s", (nombre, esperado) => {
    expect(origen(nombre)).toBe(esperado);
  });

  it("clasifica también nombres sin fecha", () => {
    expect(origenDeNombre("Scan_0001.jpg")).toBe("escaneo");
    expect(origenDeNombre("Screenshot.png")).toBe("captura");
    expect(origenDeNombre("IMG_1234.jpg")).toBe("escrito");
  });
});
