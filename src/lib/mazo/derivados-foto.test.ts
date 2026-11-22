import { describe, expect, it } from "vitest";
import type { ResultadoFecha } from "@/domain/fechas/proponer";
import type { FotoImportada } from "@/lib/importar/procesar";
import { cartaDesdeFoto } from "./derivados";

const foto = (propuesta: ResultadoFecha): FotoImportada => ({
  id: "f1",
  nombreArchivo: "foto-1.jpg",
  tipoArchivo: "image/jpeg",
  hash: "h1",
  copia: new Blob(),
  mini: new Blob(),
  ancho: 2000,
  alto: 1500,
  anchoOriginal: 4000,
  altoOriginal: 3000,
  propuesta,
});

const deCamara = foto({
  automatica: { fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta", pista: "camara" },
  sugerencias: [],
  escaneo: false,
  senales: [],
});

const deWhatsApp = foto({
  automatica: null,
  sugerencias: [{ fecha: { anio: 2008, mes: 7 }, fuente: "nombre", motivo: "mes-de-envio" }],
  motivo: "mes-de-envio",
  escaneo: false,
  senales: [],
});

describe("carta nueva a partir de una foto", () => {
  it("sin nada de quien la manda, entra con la fecha propuesta y sin frase", () => {
    expect(cartaDesdeFoto(deCamara, 1, 5)).toMatchObject({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", descripcion: "", anadidaEn: 5 });
    expect(cartaDesdeFoto(deWhatsApp, 1, 5)).toMatchObject({ fecha: null, motivo: "mes-de-envio", sugerencias: [{ fecha: { anio: 2008, mes: 7 } }] });
  });

  it("con el año que le puso quien la manda, entra con ese año como puesto a mano", () => {
    expect(cartaDesdeFoto(deWhatsApp, 1, 5, { fecha: { anio: 1998 } })).toMatchObject({
      fecha: { anio: 1998 },
      fuente: "manual",
      confianza: "alta",
      motivo: undefined,
      sugerencias: [],
    });
  });

  it("si quien la manda borró la fecha, entra en blanco aunque la cámara tuviera una", () => {
    expect(cartaDesdeFoto(deCamara, 1, 5, { fecha: null })).toMatchObject({ fecha: null, fuente: null, confianza: null });
  });

  it("entra con la frase de quien la manda", () => {
    expect(cartaDesdeFoto(deCamara, 1, 5, { descripcion: "La boda de los abuelos" })).toMatchObject({
      fecha: { anio: 2019, mes: 8, dia: 14 },
      fuente: "exif",
      descripcion: "La boda de los abuelos",
    });
  });
});
