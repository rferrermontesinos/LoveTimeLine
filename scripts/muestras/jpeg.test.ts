import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { APP_PERMITIDOS, leerJpeg, marcadoresDeMetadatos, nombreMarcador, problemasJpeg } from "./jpeg";

/** Un segmento con su marcador y su contenido (la longitud se calcula). */
const segmento = (marcador: number, contenido: number[] = [0, 0]) => [0xff, marcador, (contenido.length + 2) >> 8, (contenido.length + 2) & 0xff, ...contenido];

/** JPEG mínimo de 20 × 10: SOI, los segmentos dados, SOF (progresivo o no), SOS, un byte de datos y EOI. */
function jpeg(segmentos: number[][], { progresivo = true, cola = [] as number[] } = {}): Uint8Array {
  const sof = segmento(progresivo ? 0xc2 : 0xc0, [8, 0, 10, 0, 20, 1, 1, 0x11, 0]);
  const sos = segmento(0xda, [1, 1, 0, 0, 63, 0]);
  return new Uint8Array([0xff, 0xd8, ...segmentos.flat(), ...segmento(0xdb, new Array(65).fill(1)), ...sof, ...sos, 0x00, 0xff, 0xd9, ...cola]);
}

describe("leerJpeg", () => {
  it("lee medidas, si es progresivo y los segmentos de la cabecera", () => {
    const info = leerJpeg(jpeg([segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0])]));
    expect(info).toEqual({ ancho: 20, alto: 10, progresivo: true, marcadores: [0xe0, 0xdb, 0xc2, 0xda], terminaBien: true });
    expect(leerJpeg(jpeg([], { progresivo: false })).progresivo).toBe(false);
  });

  it("detecta lo que va pegado detrás del final", () => {
    expect(leerJpeg(jpeg([], { cola: [0x45, 0x78, 0x69, 0x66] })).terminaBien).toBe(false);
  });

  it("no acepta lo que no es un JPEG ni un segmento con una longitud imposible", () => {
    expect(() => leerJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow("No es un JPEG");
    expect(() => leerJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00, 1, 2]))).toThrow("longitud imposible");
  });
});

describe("metadatos: lista blanca", () => {
  it("solo quedan permitidos APP0 (JFIF) y APP14 (Adobe)", () => {
    expect([...APP_PERMITIDOS].map(nombreMarcador).sort()).toEqual(["APP0", "APP14"]);
    expect(marcadoresDeMetadatos([0xe0, 0xee, 0xdb, 0xc4, 0xc2, 0xdd, 0xda])).toEqual([]);
  });

  it("cualquier otro APPn y los comentarios cuentan como metadatos, también los que no tienen nombre conocido", () => {
    const todos = Array.from({ length: 16 }, (_, n) => 0xe0 + n);
    expect(marcadoresDeMetadatos(todos).map(nombreMarcador)).toEqual(["APP1", "APP2", "APP3", "APP4", "APP5", "APP6", "APP7", "APP8", "APP9", "APP10", "APP11", "APP12", "APP13", "APP15"]);
    expect(marcadoresDeMetadatos([0xfe]).map(nombreMarcador)).toEqual(["COM"]);
  });

  it("un manifiesto C2PA (APP11, JUMBF) no pasa", () => {
    const jumbf = [0x4a, 0x50, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0x10, 0x6a, 0x75, 0x6d, 0x62];
    expect(problemasJpeg(jpeg([segmento(0xe0), segmento(0xeb, jumbf)]))).toEqual(["lleva metadatos: APP11"]);
  });

  it("problemasJpeg resume todo lo que falla y nada si está bien", () => {
    expect(problemasJpeg(jpeg([segmento(0xe0), segmento(0xee)]))).toEqual([]);
    expect(problemasJpeg(jpeg([segmento(0xfe, [0x68, 0x6f, 0x6c, 0x61])], { progresivo: false, cola: [0] }))).toEqual([
      "lleva metadatos: COM",
      "no es progresivo",
      "no acaba en el marcador de fin de imagen",
    ]);
  });

  it("con sharp: lo que hace preparar.ts sale limpio, y si se pidiera conservar EXIF o ICC se vería", async () => {
    const lienzo = () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#c84" } });
    const limpia = await lienzo().jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
    expect(problemasJpeg(limpia)).toEqual([]);
    const conExif = await lienzo().withExif({ IFD0: { Artist: "Alguien", Copyright: "Alguien" } }).jpeg({ progressive: true }).toBuffer();
    expect(problemasJpeg(conExif)).toEqual(["lleva metadatos: APP1"]);
    const conIcc = await lienzo().withIccProfile("srgb").jpeg({ progressive: true }).toBuffer();
    expect(problemasJpeg(conIcc).join()).toContain("APP2");
  });
});
