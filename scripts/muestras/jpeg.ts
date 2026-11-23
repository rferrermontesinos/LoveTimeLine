/**
 * Cabecera de un JPEG leída byte a byte, sin depender de sharp: medidas, si es progresivo, qué
 * segmentos lleva antes de los datos de la imagen y si termina donde debe. La usan preparar.ts,
 * para comprobar cada archivo que escribe, y su test, para comprobar los que hay en public/.
 *
 * Los metadatos se buscan con una lista blanca, no negra: de la familia APPn (0xE0–0xEF) solo se
 * permiten APP0 (JFIF: versión y densidad de píxeles) y APP14 (Adobe: la transformación de color),
 * que no dicen nada de la foto ni de quien la hizo. Cualquier otro APPn —APP1 (EXIF y XMP), APP2
 * (perfil ICC), APP11 (JUMBF, donde va el manifiesto C2PA con el autor y el historial de edición),
 * APP13 (IPTC) o uno que aún no conozcamos— y los comentarios (COM) cuentan como metadatos.
 */

export interface InfoJpeg {
  ancho: number;
  alto: number;
  progresivo: boolean;
  /** Marcadores de los segmentos antes de los datos de la imagen (0xE1 = APP1…), en orden. */
  marcadores: number[];
  /** El archivo acaba en el marcador de fin de imagen (EOI): no lleva nada pegado detrás. */
  terminaBien: boolean;
}

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;

/** APP0 (JFIF) y APP14 (Adobe): los únicos APPn que pueden quedar. */
export const APP_PERMITIDOS: ReadonlySet<number> = new Set([0xe0, 0xee]);

/** Marcadores sin longitud: TEM y los de reinicio (RST0–RST7). */
const sinLongitud = (m: number) => m === 0x01 || (m >= 0xd0 && m <= 0xd7);
/** SOF0–SOF15, salvo DHT (0xC4), JPG (0xC8) y DAC (0xCC), que comparten el rango. */
const esSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/** Lee la cabecera de un JPEG. Lanza si no es un JPEG o si un segmento no cuadra. */
export function leerJpeg(datos: Uint8Array): InfoJpeg {
  if (datos.length < 4 || datos[0] !== 0xff || datos[1] !== SOI) throw new Error("No es un JPEG");
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const info: InfoJpeg = { ancho: 0, alto: 0, progresivo: false, marcadores: [], terminaBien: datos.at(-2) === 0xff && datos.at(-1) === EOI };
  let i = 2;
  while (i + 2 <= datos.length) {
    if (datos[i] !== 0xff) throw new Error(`Segmento mal formado en el byte ${i}`);
    const marcador = datos[i + 1]!;
    if (marcador === 0xff) {
      // Relleno entre segmentos.
      i++;
      continue;
    }
    info.marcadores.push(marcador);
    if (marcador === SOS || marcador === EOI) break; // Empiezan los datos de la imagen (o se acabó).
    if (sinLongitud(marcador)) {
      i += 2;
      continue;
    }
    if (i + 4 > datos.length) throw new Error(`Segmento 0x${marcador.toString(16)} cortado en el byte ${i}`);
    const largo = vista.getUint16(i + 2);
    if (largo < 2 || i + 2 + largo > datos.length) throw new Error(`Segmento 0x${marcador.toString(16)} con longitud imposible en el byte ${i}`);
    if (esSof(marcador)) {
      info.alto = vista.getUint16(i + 5);
      info.ancho = vista.getUint16(i + 7);
      info.progresivo = marcador === 0xc2;
    }
    i += 2 + largo;
  }
  return info;
}

/** Los marcadores que delatan metadatos: cualquier APPn fuera de la lista blanca y los comentarios. */
export function marcadoresDeMetadatos(marcadores: readonly number[]): number[] {
  return marcadores.filter((m) => (m >= 0xe0 && m <= 0xef && !APP_PERMITIDOS.has(m)) || m === COM);
}

/** «APP11», «COM»…: para los mensajes de error. */
export function nombreMarcador(m: number): string {
  if (m >= 0xe0 && m <= 0xef) return `APP${m - 0xe0}`;
  if (m === COM) return "COM";
  return `0x${m.toString(16)}`;
}

/**
 * Lo que tiene de malo un JPEG publicado: metadatos, que no sea progresivo o que lleve algo pegado
 * detrás del final. Vacío si está bien.
 */
export function problemasJpeg(datos: Uint8Array): string[] {
  const info = leerJpeg(datos);
  const problemas: string[] = [];
  const sobran = marcadoresDeMetadatos(info.marcadores);
  if (sobran.length) problemas.push(`lleva metadatos: ${sobran.map(nombreMarcador).join(", ")}`);
  if (!info.progresivo) problemas.push("no es progresivo");
  if (!info.terminaBien) problemas.push("no acaba en el marcador de fin de imagen");
  return problemas;
}
