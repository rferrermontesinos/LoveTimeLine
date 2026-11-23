/**
 * Abrir en el navegador del dueño una foto llegada por el enlace: descifrarla, separar sus partes,
 * comprobar que son imágenes de verdad y dejarla lista para entrar en el mazo como una foto más.
 */
import { PRINT } from "@config/print";
import { desempaquetar, ErrorAportacion, medidasJpeg, type DeQuienManda } from "@/domain/colaboracion/aportacion";
import { descifrarAportacion, ErrorCifrado } from "@/domain/colaboracion/cifrado";
import { nuevoId, type FotoImportada } from "@/lib/importar/procesar";

export interface FotoRecibida {
  foto: FotoImportada;
  /** Nombre que dejó quien la mandó, si quiso. */
  autor: string | null;
  /** Las fotos que mandó de una vez. */
  lote: string;
  /** La fecha (si la tocó) y la frase que le puso al mandarla. Vacío en los paquetes de antes del 22-11-2026. */
  deQuienManda: DeQuienManda;
}

/** Decodifica un JPEG y devuelve sus medidas reales (en el navegador, con createImageBitmap). */
export type Medidor = (jpeg: Uint8Array<ArrayBuffer>) => Promise<{ ancho: number; alto: number }>;

const medirConBitmap: Medidor = async (jpeg) => {
  const bitmap = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
  try {
    return { ancho: bitmap.width, alto: bitmap.height };
  } finally {
    bitmap.close();
  }
};

/** Un paquete que nunca se podrá abrir: no es para estas llaves, se ha tocado o no trae una foto. */
export function esInservible(e: unknown): boolean {
  return e instanceof ErrorCifrado || e instanceof ErrorAportacion;
}

/** Comprueba la cabecera (sin pasarse de `ladoMax`) y que de verdad se decodifica. */
async function medir(jpeg: Uint8Array<ArrayBuffer>, ladoMax: number, medidor: Medidor): Promise<{ ancho: number; alto: number }> {
  const declaradas = medidasJpeg(jpeg);
  if (!declaradas || Math.max(declaradas.ancho, declaradas.alto) > ladoMax) throw new ErrorAportacion("medidas");
  try {
    return await medidor(jpeg);
  } catch {
    throw new ErrorAportacion("imagen");
  }
}

/** Lanza ErrorCifrado o ErrorAportacion si el paquete no sirve (ver `esInservible`). */
export async function abrirAportacion(paquete: Uint8Array, llaves: CryptoKeyPair, invitacionId: string, medidor: Medidor = medirConBitmap): Promise<FotoRecibida> {
  const { datos, copia, mini } = desempaquetar(await descifrarAportacion(paquete, llaves, invitacionId));
  const medidas = await medir(copia, PRINT.ladoMaximoCopiaPx, medidor);
  await medir(mini, PRINT.ladoMiniaturaPx, medidor);
  const deQuienManda: DeQuienManda = {};
  if (datos.fecha !== undefined) deQuienManda.fecha = datos.fecha;
  if (datos.descripcion) deQuienManda.descripcion = datos.descripcion;
  return {
    foto: {
      id: nuevoId(),
      nombreArchivo: datos.nombreArchivo,
      tipoArchivo: datos.tipoArchivo,
      hash: datos.hash,
      copia: new Blob([copia], { type: "image/jpeg" }),
      mini: new Blob([mini], { type: "image/jpeg" }),
      // Las medidas de la copia son las de verdad; las del original, como mínimo esas.
      ancho: medidas.ancho,
      alto: medidas.alto,
      anchoOriginal: Math.max(datos.anchoOriginal, medidas.ancho),
      altoOriginal: Math.max(datos.altoOriginal, medidas.alto),
      propuesta: datos.propuesta,
    },
    autor: datos.autor,
    lote: datos.lote,
    deQuienManda,
  };
}
