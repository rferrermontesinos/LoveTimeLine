/**
 * Lectura de metadatos de fecha en el navegador con exifr. Nada sale del dispositivo y solo se
 * conserva lo necesario para decidir la fecha (ver MetadatosFecha): ni números de serie, ni
 * autores, ni lugares.
 */
import { metadatosDesdeExifr, type MetadatosFecha } from "@/domain/fechas/exif";

/**
 * Opciones de exifr. Por bloques (`mergeOutput: false`) para saber de dónde sale cada fecha:
 * con todo junto, la etiqueta EXIF DateTimeDigitized (que exifr llama CreateDate) y la XMP
 * xmp:CreateDate se pisan. Las fechas se quedan como texto (`reviveValues: false`) para leerlas
 * literalmente, sin saltos de zona horaria.
 */
export const OPCIONES_EXIFR = {
  tiff: true,
  exif: true,
  xmp: true,
  iptc: true,
  icc: false,
  jfif: false,
  ihdr: false,
  gps: false,
  interop: false,
  ifd1: false,
  makerNote: false,
  userComment: false,
  reviveValues: false,
  mergeOutput: false,
} as const;

export async function leerMetadatos(datos: ArrayBuffer | Uint8Array): Promise<MetadatosFecha | null> {
  try {
    const exifr = (await import("exifr")).default;
    return metadatosDesdeExifr(await exifr.parse(datos, OPCIONES_EXIFR));
  } catch {
    // Archivos sin metadatos o con un formato que exifr no lee (WebP): sin fecha de metadatos.
    return null;
  }
}
