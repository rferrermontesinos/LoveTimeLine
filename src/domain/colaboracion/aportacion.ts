/**
 * Lo que va dentro de cada aportación cifrada: los datos de la foto (nombre, huella, medidas, la
 * fecha que se le ha propuesto en el móvil de quien la manda y, desde el 22-11-2026, la fecha y la
 * frase que le haya puesto esa persona), la copia de trabajo y la miniatura. La foto original no
 * viaja: la copia es un JPEG nuevo, sin GPS ni el resto de metadatos.
 *
 * Formato: largo de los datos (4 bytes) · datos en JSON · largo de la copia (4 bytes) · copia · miniatura.
 *
 * Quien tiene el enlace puede mandar cualquier cosa, así que al abrir una aportación se valida todo.
 */
import { esFechaValida, type FechaCarta } from "@/domain/fechas/fecha";
import { MAX_SUGERENCIAS, type Confianza, type FuenteDetectada, type MotivoRevision, type PistaFecha, type ResultadoFecha } from "@/domain/fechas/proponer";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { concatenar } from "./cifrado";

export const VERSION_APORTACION = 1;
/** Largo máximo del nombre de quien manda las fotos. */
export const MAX_AUTOR = 40;
export const MAX_BYTES_COPIA = 12 * 1024 * 1024;
export const MAX_BYTES_MINI = 2 * 1024 * 1024;
const MAX_BYTES_DATOS = 16 * 1024;
const MAX_LADO = 20_000;

/** Datos de una foto aportada. `propuesta` es la de su móvil, sin las señales de depuración. */
export interface DatosAportacion {
  v: typeof VERSION_APORTACION;
  nombreArchivo: string;
  tipoArchivo: string;
  /** SHA-256 (hex) del archivo original: sirve para no añadir dos veces la misma foto. */
  hash: string;
  ancho: number;
  alto: number;
  anchoOriginal: number;
  altoOriginal: number;
  propuesta: ResultadoFecha;
  /** Nombre que ha escrito quien la manda, si ha querido. */
  autor: string | null;
  /** Fotos mandadas de una vez: sirve para reconocer una sesión de fotos de fotos. */
  lote: string;
  enviadaEn: number;
  /**
   * La fecha que le ha puesto quien la manda, escrita o con una sugerencia; null si ha borrado la
   * que traía. Sin el campo, no la ha tocado y vale `propuesta`. Opcional porque los paquetes de
   * antes del 22-11-2026 no lo traen: por eso la versión sigue siendo la 1.
   */
  fecha?: FechaCarta | null;
  /** La frase para la carta que ha escrito quien la manda, si ha escrito alguna (desde el 22-11-2026). */
  descripcion?: string;
}

/** Lo que pone quien manda la foto para su carta: la fecha (si la ha tocado) y la frase. */
export type DeQuienManda = Pick<DatosAportacion, "fecha" | "descripcion">;

export interface Aportacion {
  datos: DatosAportacion;
  copia: Uint8Array<ArrayBuffer>;
  mini: Uint8Array<ArrayBuffer>;
}

export class ErrorAportacion extends Error {
  constructor(readonly detalle: string) {
    super(`Aportación no válida: ${detalle}`);
    this.name = "ErrorAportacion";
  }
}

// Listas completas de cada tipo: si se añade un valor al tipo, TypeScript obliga a añadirlo aquí.
const FUENTES: Record<FuenteDetectada, true> = { exif: true, nombre: true, carpeta: true, archivo: true };
const CONFIANZAS: Record<Confianza, true> = { alta: true, media: true, baja: true };
const PISTAS: Record<PistaFecha, true> = { camara: true, metadatos: true, escrito: true };
const MOTIVOS: Record<MotivoRevision, true> = {
  "fecha-del-archivo": true,
  "fecha-de-hoy": true,
  "exif-y-nombre-no-coinciden": true,
  "reloj-de-camara": true,
  "posible-escaneo": true,
  "digitalizada-despues": true,
  "fecha-anotada": true,
  "fecha-reciente": true,
  "fecha-de-envio": true,
  "captura-de-pantalla": true,
  "mes-de-envio": true,
  "mes-de-captura": true,
  "sin-datos-de-camara": true,
  "fecha-digitalizacion": true,
  "sesion-de-escaneo": true,
};

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const enLista = <T extends string>(lista: Record<T, true>, x: unknown): x is T => typeof x === "string" && Object.hasOwn(lista, x);
const entero = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

/** Quita caracteres de control y recorta. */
function texto(x: unknown, max: number): string | null {
  if (typeof x !== "string") return null;
  const limpio = x.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return limpio.length > 0 && limpio.length <= max ? limpio : null;
}

/**
 * Una frase tal como viaja: los saltos de línea y demás caracteres de control pasan a espacios, y
 * sin espacios al principio ni al final. Se cuenta por caracteres, como en Cartas (un emoji, uno).
 */
export function limpiarFrase(x: string): string {
  return x.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function fecha(x: unknown): FechaCarta | null {
  if (!esObjeto(x)) return null;
  const f: FechaCarta = { anio: x.anio as number };
  if (x.mes !== undefined) f.mes = x.mes as number;
  if (x.dia !== undefined) f.dia = x.dia as number;
  return esFechaValida(f) ? f : null;
}

function propuesta(x: unknown): ResultadoFecha {
  if (!esObjeto(x) || !Array.isArray(x.sugerencias) || typeof x.escaneo !== "boolean") throw new ErrorAportacion("propuesta");
  let automatica: ResultadoFecha["automatica"] = null;
  if (x.automatica !== null) {
    const a = x.automatica;
    const f = esObjeto(a) ? fecha(a.fecha) : null;
    if (!esObjeto(a) || !f || !enLista(FUENTES, a.fuente) || !enLista(CONFIANZAS, a.confianza) || !enLista(PISTAS, a.pista)) throw new ErrorAportacion("fecha");
    automatica = { fecha: f, fuente: a.fuente, confianza: a.confianza, pista: a.pista };
  }
  if (x.sugerencias.length > MAX_SUGERENCIAS) throw new ErrorAportacion("sugerencias");
  const sugerencias = x.sugerencias.map((s: unknown) => {
    const f = esObjeto(s) ? fecha(s.fecha) : null;
    if (!esObjeto(s) || !f || !enLista(FUENTES, s.fuente) || !enLista(MOTIVOS, s.motivo)) throw new ErrorAportacion("sugerencia");
    return { fecha: f, fuente: s.fuente, motivo: s.motivo };
  });
  if (x.motivo !== undefined && !enLista(MOTIVOS, x.motivo)) throw new ErrorAportacion("motivo");
  const r: ResultadoFecha = { automatica, sugerencias, escaneo: x.escaneo, senales: [] };
  if (x.motivo !== undefined) r.motivo = x.motivo as MotivoRevision;
  return r;
}

/** Valida los datos de una aportación (vienen de quien tenga el enlace). */
export function validarDatos(x: unknown): DatosAportacion {
  if (!esObjeto(x) || x.v !== VERSION_APORTACION) throw new ErrorAportacion("versión");
  const nombreArchivo = texto(x.nombreArchivo, 255);
  if (!nombreArchivo) throw new ErrorAportacion("nombre");
  if (typeof x.tipoArchivo !== "string" || !/^image\/[a-z0-9.+-]{1,40}$/i.test(x.tipoArchivo)) throw new ErrorAportacion("tipo");
  if (typeof x.hash !== "string" || !/^[0-9a-f]{64}$/.test(x.hash)) throw new ErrorAportacion("huella");
  for (const lado of ["ancho", "alto", "anchoOriginal", "altoOriginal"] as const) if (!entero(x[lado], 1, MAX_LADO)) throw new ErrorAportacion(lado);
  const autor = x.autor === null ? null : texto(x.autor, MAX_AUTOR);
  if (x.autor !== null && !autor) throw new ErrorAportacion("autor");
  if (typeof x.lote !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(x.lote)) throw new ErrorAportacion("lote");
  if (typeof x.enviadaEn !== "number" || !Number.isFinite(x.enviadaEn) || x.enviadaEn < 0) throw new ErrorAportacion("envío");
  const datos: DatosAportacion = {
    v: VERSION_APORTACION,
    nombreArchivo,
    tipoArchivo: x.tipoArchivo.toLowerCase(),
    hash: x.hash,
    ancho: x.ancho as number,
    alto: x.alto as number,
    anchoOriginal: x.anchoOriginal as number,
    altoOriginal: x.altoOriginal as number,
    propuesta: propuesta(x.propuesta),
    autor,
    lote: x.lote,
    enviadaEn: x.enviadaEn,
  };
  if (x.fecha !== undefined) {
    const puesta = x.fecha === null ? null : fecha(x.fecha);
    if (x.fecha !== null && !puesta) throw new ErrorAportacion("fecha puesta");
    datos.fecha = puesta;
  }
  if (x.descripcion !== undefined) {
    const frase = typeof x.descripcion === "string" ? limpiarFrase(x.descripcion) : null;
    if (frase === null || [...frase].length > MAX_DESCRIPCION) throw new ErrorAportacion("frase");
    if (frase) datos.descripcion = frase;
  }
  return datos;
}

/** ¿Empieza como un JPEG? (las copias y miniaturas siempre lo son). */
export function esJpeg(b: Uint8Array): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/**
 * Las medidas que declara un JPEG en su cabecera (marcador SOF), sin decodificarlo: así se rechaza
 * una imagen enorme antes de abrirla. Null si no es un JPEG que se pueda medir.
 */
export function medidasJpeg(b: Uint8Array): { ancho: number; alto: number } | null {
  if (!esJpeg(b)) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    // Uno o varios 0xFF de relleno antes de cada marcador.
    while (i < b.length && b[i] === 0xff) i++;
    if (i >= b.length) return null;
    const marcador = b[i++]!;
    // Marcadores sueltos, sin largo detrás.
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) continue;
    // Fin de la imagen o empiezan los datos sin haber dicho las medidas.
    if (marcador === 0xd9 || marcador === 0xda || i + 2 > b.length) return null;
    const largo = (b[i]! << 8) | b[i + 1]!;
    if (largo < 2) return null;
    // SOF0…SOF15, salvo DHT (C4), JPG (C8) y DAC (CC): precisión, alto y ancho.
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      if (i + 7 > b.length) return null;
      const alto = (b[i + 3]! << 8) | b[i + 4]!;
      const ancho = (b[i + 5]! << 8) | b[i + 6]!;
      return ancho > 0 && alto > 0 ? { ancho, alto } : null;
    }
    i += largo;
  }
  return null;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

/** Junta datos, copia y miniatura en los bytes que se cifran. */
export function empaquetar(datos: DatosAportacion, copia: Uint8Array, mini: Uint8Array): Uint8Array<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify({ ...datos, propuesta: { ...datos.propuesta, senales: [] } }));
  return concatenar(u32(json.length), json, u32(copia.length), copia, mini);
}

/** Separa y valida lo que hay dentro de una aportación descifrada. */
export function desempaquetar(bytes: Uint8Array): Aportacion {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 8) throw new ErrorAportacion("corta");
  const largoDatos = vista.getUint32(0);
  if (largoDatos > MAX_BYTES_DATOS || 8 + largoDatos > bytes.length) throw new ErrorAportacion("datos");
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(4, 4 + largoDatos)));
  } catch {
    throw new ErrorAportacion("datos");
  }
  const datos = validarDatos(json);
  const largoCopia = vista.getUint32(4 + largoDatos);
  const inicioCopia = 8 + largoDatos;
  if (largoCopia > MAX_BYTES_COPIA || inicioCopia + largoCopia > bytes.length) throw new ErrorAportacion("copia");
  const copia = bytes.slice(inicioCopia, inicioCopia + largoCopia);
  const mini = bytes.slice(inicioCopia + largoCopia);
  if (mini.length > MAX_BYTES_MINI) throw new ErrorAportacion("miniatura");
  if (!esJpeg(copia) || !esJpeg(mini)) throw new ErrorAportacion("imagen");
  return { datos, copia, mini };
}
