import { describe, expect, it } from "vitest";
import { aIso } from "./fecha";
import { fechaDesdeExif, leerFechaMetadato } from "./exif";
import { proponerFecha } from "./proponer";

const hoy = new Date("2026-11-04T10:00:00");

describe("fechaDesdeExif", () => {
  it("prioriza DateTimeOriginal, luego CreateDate y XMP", () => {
    const r = fechaDesdeExif(
      { CreateDate: "2018:01:02 10:00:00", DateTimeOriginal: "2019:08:14 23:59:59", DateCreated: "2017-05-05" },
      { hoy },
    );
    expect(r && aIso(r.fecha)).toBe("2019-08-14");
    expect(r?.campo).toBe("DateTimeOriginal");
    const x = fechaDesdeExif({ DateCreated: "2017-05-05T23:30:00+02:00" }, { hoy });
    expect(x && aIso(x.fecha)).toBe("2017-05-05");
  });

  it("lee la fecha literal sin saltos de zona horaria", () => {
    expect(aIso(leerFechaMetadato("2019:12:31 23:59:59")!)).toBe("2019-12-31");
    expect(aIso(leerFechaMetadato("2019-12-31T23:59:59-08:00")!)).toBe("2019-12-31");
  });

  it("ignora fechas vacías, imposibles o futuras", () => {
    expect(fechaDesdeExif({ DateTimeOriginal: "0000:00:00 00:00:00" }, { hoy })).toBeNull();
    expect(fechaDesdeExif({ DateTimeOriginal: "1970:01:01 00:00:00" }, { hoy })).toBeNull();
    expect(fechaDesdeExif({ DateTimeOriginal: "2030:01:01 00:00:00" }, { hoy })).toBeNull();
    expect(fechaDesdeExif({}, { hoy })).toBeNull();
    expect(fechaDesdeExif(null, { hoy })).toBeNull();
  });

  it("marca como sospechosa la fecha de un reloj sin configurar", () => {
    expect(fechaDesdeExif({ DateTimeOriginal: "2000:01:01 00:00:00" }, { hoy })?.sospechosa).toBe(true);
  });
});

describe("proponerFecha", () => {
  it("EXIF da confianza alta", () => {
    const p = proponerFecha({ nombreArchivo: "foto.jpg", exif: { DateTimeOriginal: "2019:08:14 12:00:00" }, hoy });
    expect(p).toMatchObject({ fuente: "exif", confianza: "alta", revisar: false });
  });

  it("el nombre del archivo da confianza media", () => {
    const p = proponerFecha({ nombreArchivo: "IMG-20190814-WA0001.jpg", exif: null, ultimaModificacion: Date.now(), hoy });
    expect(p).toMatchObject({ fuente: "nombre", confianza: "media", revisar: false });
    expect(aIso(p!.fecha)).toBe("2019-08-14");
  });

  it("la fecha del archivo es el último recurso y se marca para revisar", () => {
    const p = proponerFecha({
      nombreArchivo: "foto.jpg",
      ultimaModificacion: new Date("2016-07-10T12:00:00").getTime(),
      hoy,
    });
    expect(p).toMatchObject({ fuente: "archivo", confianza: "baja", revisar: true, motivo: "fecha-del-archivo" });
    expect(aIso(p!.fecha)).toBe("2016-07-10");
  });

  it("avisa si la fecha del archivo es de hoy (seguramente la de la copia)", () => {
    const p = proponerFecha({ nombreArchivo: "foto.jpg", ultimaModificacion: hoy.getTime(), hoy });
    expect(p?.motivo).toBe("fecha-de-hoy");
  });

  it("señala cuando EXIF y nombre no coinciden", () => {
    const p = proponerFecha({
      nombreArchivo: "IMG_20150101_120000.jpg",
      exif: { DateTimeOriginal: "2019:08:14 12:00:00" },
      hoy,
    });
    expect(p).toMatchObject({ fuente: "exif", confianza: "media", revisar: true, motivo: "exif-y-nombre-no-coinciden" });
  });

  it("si el EXIF parece un reloj sin configurar, prefiere el nombre", () => {
    const p = proponerFecha({
      nombreArchivo: "verano 2015.jpg",
      exif: { DateTimeOriginal: "2000:01:01 00:00:00" },
      hoy,
    });
    expect(p).toMatchObject({ fuente: "nombre" });
    expect(aIso(p!.fecha)).toBe("2015");
  });

  it("sin nada, no propone", () => {
    expect(proponerFecha({ nombreArchivo: "foto.jpg", hoy })).toBeNull();
  });
});
