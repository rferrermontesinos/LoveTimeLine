import { aIso, ANIO_MINIMO, crearFecha, esFutura, precisionDe, type FechaCarta } from "./fecha";

/** Fecha tal como la da el lector de metadatos: cadena sin convertir (o Date si se revivió). */
export type ValorFecha = string | Date;

/**
 * Lo que se lee de los metadatos de una foto para decidir su fecha. Solo vive en el navegador
 * mientras se importa la foto y nunca se guarda: no incluye números de serie, autores, nombres
 * de equipos ni lugares. Las fechas llegan como texto literal:
 * EXIF «2019:08:14 12:30:45», XMP «2019-08-14T12:30:45+02:00» o «2019», IPTC «20190814».
 */
export interface MetadatosFecha {
  /**
   * EXIF DateTimeOriginal (0x9003), o XMP exif:DateTimeOriginal (exifr los junta): cuándo se
   * hizo la foto según la cámara. En un escáner suele ser el día del escaneo.
   */
  DateTimeOriginal?: ValorFecha;
  /** EXIF DateTimeDigitized (0x9004; exifr lo llama CreateDate): cuándo pasó a digital. */
  DateTimeDigitized?: ValorFecha;
  /** XMP exif:DateTimeDigitized. */
  XmpDateTimeDigitized?: ValorFecha;
  /** XMP xmp:CreateDate: cuándo se creó el archivo digital. */
  XmpCreateDate?: ValorFecha;
  /** XMP xmp:ModifyDate. */
  XmpModifyDate?: ValorFecha;
  /** XMP photoshop:DateCreated: fecha del contenido que apunta una persona o un programa de fotos. */
  DateCreated?: ValorFecha;
  /** IPTC 2:55 DateCreated («AAAAMMDD»; «00» es mes o día desconocido). */
  IptcDateCreated?: ValorFecha;
  /** IPTC 2:62 DigitalCreationDate: cuándo se digitalizó. */
  IptcDigitalCreationDate?: ValorFecha;
  /** IFD0 DateTime (0x0132; exifr lo llama ModifyDate): última modificación del archivo. */
  ModifyDate?: ValorFecha;
  Make?: string;
  Model?: string;
  Software?: string;
  /** XMP xmp:CreatorTool. */
  CreatorTool?: string;
  /** IPTC 2:65 OriginatingProgram. */
  OriginatingProgram?: string;
  /** Programas del historial XMP (xmpMM:History, softwareAgent). */
  ProgramasHistorial?: string[];
  /** EXIF FileSource: «Film Scanner», «Reflection Print Scanner» o «Digital Camera». */
  FileSource?: string;
  /** EXIF SensingMethod: «Trilinear sensor» y «Color sequential linear sensor» son de escáner. */
  SensingMethod?: string;
  /** Hay datos de exposición (tiempo, diafragma, ISO, focal u objetivo): los escribe una cámara. */
  tieneExposicion?: boolean;
}

/**
 * Fechas que ponen las cámaras con el reloj sin configurar (y los «ceros» de algunos sistemas:
 * 1904 en Mac, 1970 en Unix, 1980 en FAT). Solo cuentan con día: «2000» a secas es un año normal.
 */
const RELOJ_POR_DEFECTO = new Set(["1904-01-01", "1970-01-01", "1980-01-01", "2000-01-01", "2001-01-01", "2002-01-01"]);

export function esFechaDeRelojPorDefecto(f: FechaCarta): boolean {
  return precisionDe(f) === "dia" && RELOJ_POR_DEFECTO.has(aIso(f));
}

/** Año, mes y día con «00» como desconocido (IPTC y algunos programas): «1987:06:00» es junio de 1987. */
function conDesconocidos(anio: string, mes: string, dia = "00"): FechaCarta | null {
  const a = Number(anio);
  const m = Number(mes);
  const d = Number(dia);
  if (m === 0) return d === 0 ? crearFecha(a) : null;
  if (d === 0) return crearFecha(a, m);
  return crearFecha(a, m, d);
}

/** Lee la parte de fecha literalmente, sin aplicar zonas horarias (evita saltos de día). */
export function leerFechaMetadato(valor: ValorFecha | null | undefined): FechaCarta | null {
  if (valor === undefined || valor === null) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return crearFecha(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }
  const texto = String(valor).trim();
  // EXIF «AAAA:MM:DD…», XMP «AAAA-MM-DDT…»
  const completa = /^(\d{4})[:\-/](\d{2})[:\-/](\d{2})(?!\d)/.exec(texto);
  if (completa) return conDesconocidos(completa[1]!, completa[2]!, completa[3]!);
  // IPTC «AAAAMMDD»
  const compacta = /^(\d{4})(\d{2})(\d{2})$/.exec(texto);
  if (compacta) return conDesconocidos(compacta[1]!, compacta[2]!, compacta[3]!);
  const anioMes = /^(\d{4})[:\-/](\d{2})$/.exec(texto);
  if (anioMes) return conDesconocidos(anioMes[1]!, anioMes[2]!);
  const anio = /^(\d{4})$/.exec(texto);
  if (anio) return crearFecha(Number(anio[1]));
  return null;
}

export interface LecturaFecha {
  /** La primera fecha útil, o null. */
  fecha: FechaCarta | null;
  /** Se ha descartado alguna fecha por ser la de un reloj sin configurar. */
  relojPorDefecto: boolean;
}

/**
 * Primera fecha útil de una lista de valores en orden de preferencia: que exista, sea de
 * 1850 en adelante, no sea futura y no sea la de un reloj sin configurar.
 */
export function primeraFechaUtil(valores: readonly (ValorFecha | null | undefined)[], hoy: Date): LecturaFecha {
  let relojPorDefecto = false;
  for (const valor of valores) {
    const f = leerFechaMetadato(valor);
    if (!f || f.anio < ANIO_MINIMO || esFutura(f, hoy)) continue;
    if (esFechaDeRelojPorDefecto(f)) {
      relojPorDefecto = true;
      continue;
    }
    return { fecha: f, relojPorDefecto };
  }
  return { fecha: null, relojPorDefecto };
}

// --- Traducción de la salida de exifr -------------------------------------------------------

type Bloque = Record<string, unknown>;

function esBloque(v: unknown): v is Bloque {
  return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !ArrayBuffer.isView(v);
}

function bloque(raiz: Bloque, clave: string): Bloque {
  const b = raiz[clave];
  return esBloque(b) ? b : {};
}

/** Texto de un valor de EXIF/XMP/IPTC: cadena, número, lista (el primero) o {value} (XMP con idioma). */
function texto(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : undefined;
  if (Array.isArray(v)) {
    for (const x of v) {
      const t = texto(x);
      if (t) return t;
    }
    return undefined;
  }
  if (esBloque(v) && "value" in v) return texto(v.value);
  return undefined;
}

function valorFecha(v: unknown): ValorFecha | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  return texto(v);
}

const FUENTES_ARCHIVO: Record<number, string> = { 1: "Film Scanner", 2: "Reflection Print Scanner", 3: "Digital Camera" };
const METODOS_SENSOR: Record<number, string> = {
  1: "Not defined",
  2: "One-chip color area sensor",
  3: "Two-chip color area sensor",
  4: "Three-chip color area sensor",
  5: "Color sequential area sensor",
  7: "Trilinear sensor",
  8: "Color sequential linear sensor",
};

/** Valores enumerados que exifr puede dar traducidos («Film Scanner»), como número o como bytes. */
function enumerado(v: unknown, tabla: Record<number, string>): string | undefined {
  if (v instanceof Uint8Array) return v.length ? (tabla[v[0]!] ?? String(v[0])) : undefined;
  if (typeof v === "number") return tabla[v] ?? String(v);
  const t = texto(v);
  if (t && /^\d+$/.test(t)) return tabla[Number(t)] ?? t;
  return t;
}

function programasHistorial(v: unknown): string[] | undefined {
  const entradas = Array.isArray(v) ? v : v === undefined ? [] : [v];
  const programas = entradas.flatMap((e) => {
    const t = esBloque(e) ? texto(e.softwareAgent) : undefined;
    return t ? [t] : [];
  });
  return programas.length ? [...new Set(programas)].slice(0, 8) : undefined;
}

const CLAVES_EXPOSICION = ["ExposureTime", "FNumber", "ISO", "ISOSpeedRatings", "FocalLength", "LensModel", "ApertureValue", "ShutterSpeedValue"];

/**
 * Pasa la salida de exifr por bloques (`mergeOutput: false`) a MetadatosFecha. Es pura: no
 * importa exifr. Por bloques, cada valor dice de dónde viene: exif.CreateDate es la etiqueta
 * EXIF DateTimeDigitized, exif.DateTimeDigitized viene del XMP, xmp.CreateDate es xmp:CreateDate
 * e ifd0.ModifyDate es la fecha de modificación. Solo se queda lo necesario para decidir la fecha.
 */
export function metadatosDesdeExifr(salida: unknown): MetadatosFecha | null {
  if (!esBloque(salida)) return null;
  const ifd0 = bloque(salida, "ifd0");
  const exif = bloque(salida, "exif");
  const xmp = bloque(salida, "xmp");
  const photoshop = bloque(salida, "photoshop");
  const iptc = bloque(salida, "iptc");
  const mm = bloque(salida, "xmpMM");

  const meta: MetadatosFecha = {
    DateTimeOriginal: valorFecha(exif.DateTimeOriginal),
    DateTimeDigitized: valorFecha(exif.CreateDate),
    XmpDateTimeDigitized: valorFecha(exif.DateTimeDigitized),
    XmpCreateDate: valorFecha(xmp.CreateDate),
    XmpModifyDate: valorFecha(xmp.ModifyDate),
    DateCreated: valorFecha(photoshop.DateCreated),
    IptcDateCreated: valorFecha(iptc.DateCreated),
    IptcDigitalCreationDate: valorFecha(iptc.DigitalCreationDate),
    ModifyDate: valorFecha(ifd0.ModifyDate),
    Make: texto(ifd0.Make),
    Model: texto(ifd0.Model),
    Software: texto(ifd0.Software),
    CreatorTool: texto(xmp.CreatorTool),
    OriginatingProgram: texto(iptc.OriginatingProgram),
    ProgramasHistorial: programasHistorial(mm.History),
    FileSource: enumerado(exif.FileSource, FUENTES_ARCHIVO),
    SensingMethod: enumerado(exif.SensingMethod, METODOS_SENSOR),
    tieneExposicion: CLAVES_EXPOSICION.some((k) => exif[k] !== undefined && exif[k] !== null) || undefined,
  };
  const limpio = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)) as MetadatosFecha;
  return Object.keys(limpio).length ? limpio : null;
}
