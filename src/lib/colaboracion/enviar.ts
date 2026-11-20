/**
 * Del lado de quien manda fotos por el enlace: cada foto se procesa en su móvil como en el portal
 * (fecha, copia de trabajo y miniatura, sin GPS ni otros metadatos) y se cifra para el dueño del
 * mazo antes de salir.
 */
import { empaquetar, MAX_AUTOR, VERSION_APORTACION, type DatosAportacion } from "@/domain/colaboracion/aportacion";
import { cifrarAportacion, deBase64url, huella, pareceClavePublica } from "@/domain/colaboracion/cifrado";
import type { FotoImportada } from "@/lib/importar/procesar";

/**
 * La clave pública del dueño, solo si su huella es la del enlace: así el servicio no puede dar
 * otra clave y quedarse con las fotos. Null si no coincide.
 */
export async function claveComprobada(clavePublica: string, huellaEsperada: string): Promise<Uint8Array<ArrayBuffer> | null> {
  let cruda: Uint8Array<ArrayBuffer>;
  try {
    cruda = deBase64url(clavePublica);
  } catch {
    return null;
  }
  if (!pareceClavePublica(cruda)) return null;
  return (await huella(cruda)) === huellaEsperada ? cruda : null;
}

/** El paquete cifrado de una foto, listo para mandar. */
export async function prepararAportacion(
  foto: FotoImportada,
  extra: { autor: string | null; lote: string; enviadaEn: number },
  clavePublica: Uint8Array,
  invitacionId: string,
): Promise<Uint8Array<ArrayBuffer>> {
  // Con los límites que comprueba quien lo recibe: nombre de archivo corto y autor sin espacios de más.
  const datos: DatosAportacion = {
    v: VERSION_APORTACION,
    nombreArchivo: foto.nombreArchivo.slice(0, 200),
    tipoArchivo: foto.tipoArchivo,
    hash: foto.hash,
    ancho: foto.ancho,
    alto: foto.alto,
    anchoOriginal: foto.anchoOriginal,
    altoOriginal: foto.altoOriginal,
    propuesta: foto.propuesta,
    autor: extra.autor?.trim().slice(0, MAX_AUTOR) || null,
    lote: extra.lote,
    enviadaEn: extra.enviadaEn,
  };
  const [copia, mini] = await Promise.all([foto.copia.arrayBuffer(), foto.mini.arrayBuffer()]);
  return cifrarAportacion(empaquetar(datos, new Uint8Array(copia), new Uint8Array(mini)), clavePublica, invitacionId);
}
