/**
 * Señales de que una foto es un escaneo o una copia digital de una foto antigua. Con ellas, la
 * fecha que traen los metadatos es la del escaneo y no la del recuerdo, así que no se usa.
 *
 * Las listas de marcas, modelos y programas son aproximadas: hay que contrastarlas con los
 * metadatos de escáneres y aplicaciones reales (solo las cadenas; nunca subir las fotos).
 * Todas se comparan sin distinguir mayúsculas.
 */
import type { MetadatosFecha } from "./exif";

export type SenalEscaneo =
  /** Marca o modelo de escáner (o de impresora multifunción). */
  | "dispositivo-escaner"
  /** Programa o aplicación de escaneo en Software, CreatorTool, IPTC o el historial XMP. */
  | "software-escaneo"
  /** EXIF FileSource dice escáner de película o de copias. */
  | "fuente-escaner"
  /** EXIF SensingMethod de sensor lineal (el de los escáneres). */
  | "sensor-lineal"
  /** El nombre del archivo es el que pone un programa de escaneo. */
  | "nombre-escaneo"
  /** La carpeta se llama «Escaneos», «Scans», «Fotos digitalizadas»… */
  | "carpeta-escaneo";

/** Marcas y modelos de escáneres y multifunción (Make y Model). */
export const PATRONES_DISPOSITIVO_ESCANER: readonly RegExp[] = [
  /scan/i, // ScanSnap, CanoScan, ScanJet, Scanza, Coolscan y cualquier «scanner»
  /\bperfection\b/i, // Epson Perfection
  /\bexpression\s*\d/i, // Epson Expression 12000XL
  /fastfoto|\bff-\d{3}/i, // Epson FastFoto FF-680W
  /\blide\s?\d/i, // Canon LiDE
  /plustek|opticfilm|opticbook/i,
  /\bfi-\d{4}/i, // Fujitsu fi-7160
  /\b(?:ads|mfc|dcp)-[a-z\d]/i, // Brother
  /reflecta|doxie|iriscan|pacific image|primefilm|wolverine|flextight|imacon/i,
  /pixma|maxify|imageclass|imagerunner|officejet|deskjet|laserjet|ecotank|workforce|workcentre/i,
];

/** Cámaras de Epson: R-D1 (telémetro) y PhotoPC, L-500V. Epson sin estos modelos es un escáner. */
export const CAMARAS_EPSON = /\bR-D1|photopc|\bL-500V\b/i;

/** Programas y aplicaciones de escaneo o digitalización. */
export const PATRONES_SOFTWARE_ESCANEO: readonly RegExp[] = [
  /scan/i, // EPSON Scan, ScanSmart, VueScan, IJ Scan Utility, HP Scan, Adobe Scan, CamScanner, Genius Scan, PhotoScan, ScanGear, Scanbot, Windows Fax and Scan
  /fastfoto|silverfast|photomyne|\bnaps2\b|vflat|paperport|\bxsane\b/i,
  /office lens|microsoft lens|hp smart|mp navigator/i,
  /image capture|captura de imagen/i, // Captura de Imagen de macOS
];

/**
 * Nombres que pone un programa o una aplicación de escaneo. Se prueban sobre el nombre sin carpeta,
 * sin extensión y sin tildes:
 * - al principio, la palabra: «Scan_0001», «scan0001», «Scan 2», «Scanned_20261030-1000» (Google
 *   Drive), «Scan 2026-10-30…» (macOS), «Escaneo_0003», «escáner_001 2026»;
 * - en cualquier sitio, el nombre de la aplicación: «CamScanner 10-30-2026 10.10» (que además pone
 *   el mes antes que el día), «Adobe Scan Oct 30, 2026», «Genius Scan 20261030», «Office Lens
 *   20241030-101010»;
 * - «img20261030_10000012» (Epson Scan 2, en minúsculas: los móviles usan «IMG») e
 *   «IMG_20241030_0001» (Canon IJ Scan Utility: la fecha y un contador de 4 cifras; los móviles
 *   ponen detrás la hora, de 6 cifras).
 * «foto escaneada 1987» no es un nombre de escaneo: lo escribió una persona.
 */
export const PATRONES_NOMBRE_ESCANEO: readonly RegExp[] = [
  /^(?:scan(?:s|ned|ner|ning)?|escane(?:o|ado|ada)s?|escaner(?:es)?|escaneig|escanejat|escanejada|digitalizacion|digitalizad[oa]s?|digitalitz(?:at|ada|ats|ades|acio)|digiti[sz]ed)(?!\p{L})/iu,
  /(?<!\p{L})(?:cam\s?scanner|adobe[\s_-]?scan|genius[\s_-]?scan|office[\s_-]?lens|microsoft[\s_-]?lens|scansnap|scanbot|swift[\s_-]?scan|tiny[\s_-]?scanner|vflat|photoscan|photomyne|fastfoto)(?!\p{L})/iu,
  /^img\d{8}(?:_|$)/,
  /^IMG_\d{8}_\d{4}(?:\s?\(\d+\))?$/i,
  /^epson[_-]?\d{3,}/i,
];

/**
 * Carpetas de escaneos («Escaneos», «Scans», «Fotos del escáner», «Fotos digitalizadas»), sin
 * confundir «Scandinavia». Se prueban sin tildes.
 */
export const PATRONES_CARPETA_ESCANEO: readonly RegExp[] = [
  /(?<![\p{L}])scan(?!d)/iu,
  /escane|escanej|digitaliz|digitalis|digitalitz|digitiz|photoscan|photomyne|fastfoto/i,
];

/**
 * El texto sin tildes ni diéresis («escáner» → «escaner»), tanto si llega compuesto (NFC) como
 * descompuesto (NFD, como da a veces macOS los nombres de archivos y carpetas).
 */
export function sinDiacriticos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Nombre del archivo sin carpeta ni extensión. */
export function baseDelNombre(ruta: string): string {
  const nombre = ruta.split(/[\\/]/).pop() ?? ruta;
  return nombre.replace(/\.[a-z0-9]{2,5}$/i, "").normalize("NFC");
}

/** El nombre es el que pone un programa de escaneo (la fecha que lleve será la del escaneo). */
export function esNombreDeEscaneo(nombreArchivo: string): boolean {
  const base = sinDiacriticos(baseDelNombre(nombreArchivo));
  return PATRONES_NOMBRE_ESCANEO.some((re) => re.test(base));
}

export function esDispositivoEscaner(make: string | undefined, model: string | undefined): boolean {
  const dispositivo = sinDiacriticos([make, model].filter(Boolean).join(" "));
  if (!dispositivo) return false;
  if (/epson/i.test(dispositivo)) return !CAMARAS_EPSON.test(dispositivo);
  return PATRONES_DISPOSITIVO_ESCANER.some((re) => re.test(dispositivo));
}

function esProgramaDeEscaneo(programa: string): boolean {
  const sinTildes = sinDiacriticos(programa);
  return PATRONES_SOFTWARE_ESCANEO.some((re) => re.test(sinTildes));
}

/**
 * Señales de escaneo de una foto a partir de sus metadatos y de su ruta (la relativa dentro de
 * la carpeta elegida o soltada, o solo el nombre). Lista vacía: no hay indicios.
 */
export function senalesDeEscaneo(meta: MetadatosFecha | null | undefined, rutaArchivo: string): SenalEscaneo[] {
  const senales = new Set<SenalEscaneo>();
  if (meta) {
    if (esDispositivoEscaner(meta.Make, meta.Model)) senales.add("dispositivo-escaner");
    const programas = [meta.Software, meta.CreatorTool, meta.OriginatingProgram, ...(meta.ProgramasHistorial ?? [])];
    if (programas.some((p) => p && esProgramaDeEscaneo(p))) senales.add("software-escaneo");
    if (meta.FileSource && /film scanner|reflection print scanner/i.test(meta.FileSource)) senales.add("fuente-escaner");
    if (meta.SensingMethod && /trilinear|linear sensor/i.test(meta.SensingMethod)) senales.add("sensor-lineal");
  }
  // Ruta y nombre, sin tildes: «Fotos del escáner/…» casa con «escane» venga en NFC o en NFD.
  const partes = sinDiacriticos(rutaArchivo).split(/[\\/]/);
  const archivo = partes.pop() ?? "";
  if (esNombreDeEscaneo(archivo)) senales.add("nombre-escaneo");
  const carpeta = partes.join("/");
  if (carpeta && PATRONES_CARPETA_ESCANEO.some((re) => re.test(carpeta))) senales.add("carpeta-escaneo");
  return [...senales];
}
