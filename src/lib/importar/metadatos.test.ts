/**
 * Prueba de integración: fotos sintéticas (un cuadrado de color, sin personas) con metadatos
 * de cámara, de escáner, XMP e IPTC escritos con sharp, leídas con las opciones reales de exifr.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { aIso } from "@/domain/fechas/fecha";
import { proponerFecha } from "@/domain/fechas/proponer";
import { leerMetadatos } from "./metadatos";

const hoy = new Date("2026-11-04T10:00:00");

type Exif = Parameters<ReturnType<typeof sharp>["withExif"]>[0];

async function jpeg({ exif, xmp, iptc }: { exif?: Exif; xmp?: string; iptc?: [number, string][] } = {}): Promise<Uint8Array> {
  let img = sharp({ create: { width: 16, height: 16, channels: 3, background: "#f7739e" } });
  if (exif) img = img.withExif(exif);
  if (xmp) img = img.withXmp(xmp);
  const buffer = await img.jpeg().toBuffer();
  return new Uint8Array(iptc ? conIptc(buffer, iptc) : buffer);
}

/** Añade un segmento APP13 (Photoshop 3.0, recurso 0x0404) con registros IPTC 2:xx. */
function conIptc(jpg: Buffer, campos: [number, string][]): Buffer {
  const registros = Buffer.concat(
    campos.flatMap(([dataset, valor]) => {
      const datos = Buffer.from(valor, "utf8");
      return [Buffer.from([0x1c, 2, dataset, datos.length >> 8, datos.length & 0xff]), datos];
    }),
  );
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(registros.length);
  const recurso = Buffer.concat([Buffer.from("8BIM"), Buffer.from([0x04, 0x04, 0, 0]), tam, registros, Buffer.alloc(registros.length % 2)]);
  const cuerpo = Buffer.concat([Buffer.from("Photoshop 3.0\0", "latin1"), recurso]);
  const largo = Buffer.alloc(2);
  largo.writeUInt16BE(cuerpo.length + 2);
  return Buffer.concat([jpg.subarray(0, 2), Buffer.from([0xff, 0xed]), largo, cuerpo, jpg.subarray(2)]);
}

function xmp(atributos: string, cuerpo = ""): string {
  return (
    `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/" ` +
    `xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/" xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#" ${atributos}>${cuerpo}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
  );
}

describe("leerMetadatos con exifr (integración)", () => {
  it("escáner EPSON con solo la fecha de digitalización: en blanco y sin sugerirla", async () => {
    const datos = await jpeg({
      exif: {
        IFD0: { Make: "EPSON", Model: "Perfection V39", Software: "EPSON Scan", DateTime: "2026:10:31 09:00:00" },
        IFD2: { DateTimeDigitized: "2026:10:30 10:00:00", SensingMethod: "7" },
      },
    });
    const meta = await leerMetadatos(datos);
    expect(meta).toMatchObject({ Make: "EPSON", Model: "Perfection V39", Software: "EPSON Scan", DateTimeDigitized: "2026:10:30 10:00:00", ModifyDate: "2026:10:31 09:00:00", SensingMethod: "Trilinear sensor" });
    expect(meta?.DateTimeOriginal).toBeUndefined();
    const r = proponerFecha({ nombreArchivo: "img20261030_10000012.jpg", exif: meta, hoy });
    expect(r).toMatchObject({ automatica: null, sugerencias: [], motivo: "posible-escaneo" });
    expect(r.senales).toEqual(expect.arrayContaining(["dispositivo-escaner", "software-escaneo", "sensor-lineal", "nombre-escaneo"]));
  });

  it("cámara con fecha original y exposición: se rellena sola", async () => {
    const datos = await jpeg({
      exif: {
        IFD0: { Make: "Canon", Model: "Canon EOS 5D", Software: "Snapseed" },
        IFD2: { DateTimeOriginal: "2019:08:14 18:30:00", DateTimeDigitized: "2019:08:14 18:30:00", ExposureTime: "1/125", FNumber: "28/10", FocalLength: "50/1" },
      },
    });
    const meta = await leerMetadatos(datos);
    expect(meta).toMatchObject({ DateTimeOriginal: "2019:08:14 18:30:00", DateTimeDigitized: "2019:08:14 18:30:00", tieneExposicion: true });
    const r = proponerFecha({ nombreArchivo: "DSC01234.jpg", exif: meta, hoy });
    expect(r.automatica).toEqual({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta" });
  });

  it("original de 1987 escaneada en 2026, con XMP: sugiere 1987", async () => {
    const datos = await jpeg({
      exif: { IFD0: { Make: "EPSON", Model: "FF-680W" }, IFD2: { DateTimeOriginal: "1987:06:01 00:00:00", DateTimeDigitized: "2026:10:30 10:00:00" } },
      xmp: xmp('xmp:CreateDate="2026-10-30T10:00:00+01:00" xmp:CreatorTool="FastFoto"'),
    });
    const meta = await leerMetadatos(datos);
    expect(meta).toMatchObject({ XmpCreateDate: "2026-10-30T10:00:00+01:00", CreatorTool: "FastFoto" });
    const r = proponerFecha({ nombreArchivo: "FastFoto_0001.jpg", exif: meta, hoy });
    expect(r.automatica).toBeNull();
    expect(r.sugerencias.map((s) => [aIso(s.fecha), s.motivo])).toEqual([["1987-06-01", "digitalizada-despues"]]);
  });

  it("IPTC «19870000» y el historial XMP de un programa de escaneo", async () => {
    const datos = await jpeg({
      xmp: xmp("", '<xmpMM:History><rdf:Seq><rdf:li stEvt:action="created" stEvt:softwareAgent="VueScan 9.8"/></rdf:Seq></xmpMM:History>'),
      iptc: [
        [55, "19870000"],
        [62, "20261030"],
        [65, "VueScan"],
      ],
    });
    const meta = await leerMetadatos(datos);
    expect(meta).toMatchObject({ IptcDateCreated: "19870000", IptcDigitalCreationDate: "20261030", OriginatingProgram: "VueScan", ProgramasHistorial: ["VueScan 9.8"] });
    const r = proponerFecha({ nombreArchivo: "abuela.jpg", exif: meta, hoy });
    expect(r.sugerencias.map((s) => [aIso(s.fecha), s.motivo])).toEqual([["1987", "fecha-anotada"]]);
    expect(r.motivo).toBe("posible-escaneo");
  });

  it("una imagen sin metadatos o que no es una imagen no rompe la lectura", async () => {
    expect(await leerMetadatos(await jpeg())).toBeNull();
    expect(await leerMetadatos(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
