import { esNombreDeEscaneo, PATRONES_CARPETA_ESCANEO, sinDiacriticos } from "./escaneo";
import { ANIO_MINIMO, crearFecha, esFutura, fechaDeInstante, type FechaCarta } from "./fecha";

/**
 * De dónde sale la fecha de un nombre de archivo, que dice cuánto fiarse de ella:
 * - camara: la pone la cámara del móvil al hacer la foto (IMG_20190814_123045, PXL_…, Samsung
 *   20190814_123045, Dropbox «2019-08-14 12.30.45»);
 * - mensajeria: la de envío o descarga (WhatsApp, Telegram, Signal, Facebook, marcas de tiempo);
 * - captura: la de una captura de pantalla;
 * - escaneo: la de un programa o una aplicación de escaneo (Scanned_20261030-1000, img20261030_…,
 *   «CamScanner 10-30-2026 10.10», IMG_20241030_0001 de Canon);
 * - escrito: la escribió una persona («verano 2015», «2015-08 Menorca», «Boda 14-08-2019»).
 */
export type OrigenNombre = "camara" | "mensajeria" | "captura" | "escaneo" | "escrito";

/**
 * Propone una fecha a partir del nombre de un archivo. Función pura: no lee el archivo.
 * Patrones, de más fiable a menos: marca de tiempo en milisegundos, fecha completa con
 * separadores o compacta (cámaras, WhatsApp, capturas), día-mes-año, fecha con el mes escrito,
 * año y mes, y por último un año suelto.
 */
export interface FechaDesdeNombre {
  fecha: FechaCarta;
  patron:
    | "marca-tiempo"
    | "fecha-completa"
    | "fecha-compacta"
    | "dia-mes-anio"
    | "mes-escrito"
    | "anio-mes"
    | "anio";
  origen: OrigenNombre;
  /**
   * Solo en un año suelto: va pegado a otras letras con «_» o «-» («AnaLeo_1987», «boda-1987»), en
   * vez de separado («abuelos 1958»). Puede ser el contador de un fotógrafo.
   */
  pegado?: boolean;
}

const ANIO = "(18[5-9]\\d|19\\d{2}|20\\d{2})";
const MES = "(0[1-9]|1[0-2])";
const DIA = "(0[1-9]|[12]\\d|3[01])";

const MESES: Record<string, number> = {
  // español
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  // inglés
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  // catalán
  gener: 1, febrer: 2, "març": 3, maig: 5, juny: 6, juliol: 7, agost: 8, setembre: 9,
  novembre: 11, desembre: 12,
};
const NOMBRES_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join("|");

const RE_MARCA_TIEMPO = /(?<!\d)(1\d{12})(?!\d)/;
const RE_COMPLETA = new RegExp(`(?<!\\d)${ANIO}[-_.]${MES}[-_.]${DIA}(?!\\d)`);
const RE_COMPACTA_HORA = new RegExp(`(?<!\\d)${ANIO}${MES}${DIA}(?:[01]\\d|2[0-3])[0-5]\\d[0-5]\\d(?!\\d)`);
const RE_COMPACTA = new RegExp(`(?<!\\d)${ANIO}${MES}${DIA}(?!\\d)`);
const RE_DIA_MES_ANIO = new RegExp(`(?<!\\d)(0?[1-9]|[12]\\d|3[01])[-_.](0?[1-9]|1[0-2])[-_.]${ANIO}(?!\\d)`);
const RE_DIA_MES_ESCRITO = new RegExp(
  `(?<![\\p{L}\\d])(0?[1-9]|[12]\\d|3[01])[\\s_-]*(?:de[\\s_-]+)?(${NOMBRES_MES})(?![\\p{L}])[\\s_,-]*(?:de[\\s_-]+|del[\\s_-]+)?${ANIO}(?!\\d)`,
  "u",
);
const RE_MES_ESCRITO = new RegExp(
  `(?<![\\p{L}])(${NOMBRES_MES})(?![\\p{L}])[\\s_,-]*(?:de[\\s_-]+|del[\\s_-]+)?${ANIO}(?!\\d)`,
  "u",
);
const RE_ANIO_MES_ESCRITO = new RegExp(`(?<!\\d)${ANIO}[\\s_-]+(${NOMBRES_MES})(?![\\p{L}])`, "u");
const RE_ANIO_MES = new RegExp(`(?<!\\d)${ANIO}[-_.]${MES}(?![-_.]?\\d)`);
const RE_ANIO = new RegExp(`(?<!\\d)${ANIO}(?!\\d)`, "g");

/**
 * Contadores de cámara al principio del nombre: IMG_2015 no es el año 2015, ni IMGP2015 (Pentax),
 * SDIM2001 (Sigma), SANY1999 (Sanyo) o 100_1987 (Kodak: número de carpeta y de foto). Además,
 * cualquier nombre con la forma que fija el estándar de las cámaras (DCF: 4 letras, cifras o «_» y
 * un número de 4 cifras, como «ABCD2015»), sea de la marca que sea. A cambio, un «Roma2014» escrito
 * así, todo junto, se queda sin año: mejor en blanco que con un año falso.
 */
const RE_CONTADOR = /^(?:(?:img|imgp|_igp|sdim|sany|dsc[nf_]?|_dsc|_dsf|_mg|pict?|gopr|gh\d{2}|mvi|vid|sam|wp|p|dji|cimg|hpim|imag|dcp|crw)[_-]?\d+|[a-z\d_]{4}\d{4}(?![a-z\d]))/i;
/**
 * Contadores de cámara en cualquier parte del nombre: «Boda Ana y Leo - DSC_1987», «Copia de
 * IMG_1987», «IMG_E1987» (una foto editada en el iPhone). Solo los prefijos inconfundibles.
 */
const RE_CONTADOR_DENTRO = /(?<![a-z])(?:img_e|img|imgp|_igp|sdim|sany|dsc[nf_]?|_dsc|_dsf|_mg|pict?|gopr|gh\d{2}|mvi|dji|cimg|hpim|imag|dcp|crw)[_-]?\d{3,}/gi;
/** Lo que añaden los sistemas al copiar: «Copia de IMG_1987.JPG», «Copy of DSC_2003.JPG». */
const RE_PREFIJO_COPIA = /^(?:copia\s+de|copy\s+of|kopie\s+von|copie\s+de)\s+/i;
/** Lo que separa un año suelto de lo demás («abuelos 1958», «(1958)»); «_» y «-» lo dejan pegado. */
const RE_SEPARA_ANIO = /[\s()[\]{},.;:'"«»]/;
/**
 * Un curso o una temporada («curso 2011-12», «Temporada 2009-10»): «AAAA-AA» con el año siguiente
 * no es año y mes, sino dos años. Sin una de estas palabras, «2011-12» sigue siendo diciembre.
 */
const RE_PALABRA_CURSO = /(?<![\p{L}])(?:curso|cursos|temporada|season|school|escolar|course|liga|campeonato|promoci[oó]n)(?![\p{L}])/iu;
/** Resoluciones y medidas: 1920x1080, 2048px. */
const RE_MEDIDAS = /\d{3,5}\s?[x×]\s?\d{3,5}|\d{3,5}\s?px/gi;

function quitarExtension(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? nombre;
  return base.replace(/\.[a-z0-9]{2,5}$/i, "");
}

function valida(f: FechaCarta | null, hoy: Date): FechaCarta | null {
  if (!f) return null;
  if (f.anio < ANIO_MINIMO) return null;
  if (esFutura(f, hoy)) return null;
  return f;
}

/** Capturas de pantalla en varios idiomas. */
const RE_CAPTURA = /screen\s?shot|captura\s+de\s+pantalla|^captura(?=[\s_-]*\d|$)|capture d.[ée]cran|bildschirmfoto|schermata/i;
/** Mensajería: la fecha es la de envío o descarga. */
const RE_MENSAJERIA = [
  /-WA\d{4}/i, // WhatsApp en Android: IMG-20190814-WA0001
  // WhatsApp Web y de escritorio, en el idioma de cada cual: «WhatsApp Image 2019-08-14 at 12.30.45»,
  // «Imagen de WhatsApp 2019-08-14 a las 12.30.45_…», «Imatge de WhatsApp…», «Image WhatsApp…»,
  // «WhatsApp Bild…». Las capturas («Screenshot_…_WhatsApp») ya se reconocen antes.
  /(?<![a-z])whats[\s_-]?app(?![a-z])/i,
  /^photo_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/i, // Telegram
  /^signal-\d{4}-\d{2}-\d{2}/i, // Signal
  /^fb_img_\d/i, // Facebook
];
/** Nombres que pone la cámara del móvil, siempre con la hora. */
const RE_CAMARA = [
  /^(?:img|pxl|vid|mvimg|pano|burst\d*|dji)[_-]?\d{8}[_-]?\d{6}/i, // Android, Pixel, OPPO (IMG20190814123045), DJI
  /^\d{8}_\d{6}/, // Samsung
  /^\d{14}(?!\d)/,
  /^\d{4}-\d{2}-\d{2}[ _]\d{2}[.\-_]\d{2}[.\-_]\d{2}/, // Dropbox y exportaciones con hora
];

/** Clasifica el nombre de un archivo según de dónde sale su fecha (ver OrigenNombre). */
export function origenDeNombre(nombreArchivo: string, patron?: FechaDesdeNombre["patron"]): OrigenNombre {
  const base = quitarExtension(nombreArchivo).normalize("NFC");
  if (RE_CAPTURA.test(base)) return "captura";
  if (patron === "marca-tiempo" || RE_MENSAJERIA.some((re) => re.test(base))) return "mensajeria";
  if (esNombreDeEscaneo(base)) return "escaneo";
  if (RE_CAMARA.some((re) => re.test(base))) return "camara";
  return "escrito";
}

export function fechaDesdeNombre(nombreArchivo: string, opciones: { hoy: Date }): FechaDesdeNombre | null {
  const encontrada = buscarFecha(nombreArchivo, opciones.hoy);
  return encontrada ? { ...encontrada, origen: origenDeNombre(nombreArchivo, encontrada.patron) } : null;
}

/** Carpetas que no dicen nada del recuerdo: las de mensajería, las de capturas y las de la cámara (DCIM, 100APPLE). */
const RE_CARPETA_SIN_FECHA = /whats[\s_-]?app|telegram|signal|messenger|screen[\s_-]?shots?|capturas?(?!\p{L})|^dcim$|^\d{3}[a-z_]{5}$/iu;

/**
 * Fecha escrita en el nombre de una carpeta de la ruta («Menorca 2015/IMG_1234.jpg», «2019/2019-08-14/…»,
 * «Fotos de 2019/» de Google Takeout), de la más cercana a la foto a la más lejana. Solo cuenta lo
 * que escribe una persona: no valen las carpetas de mensajería, capturas, escaneos o de la cámara.
 * Sin carpetas en la ruta, null.
 */
export function fechaDesdeCarpeta(rutaArchivo: string, opciones: { hoy: Date }): FechaCarta | null {
  const carpetas = rutaArchivo.normalize("NFC").split(/[\\/]/).slice(0, -1).reverse();
  for (const carpeta of carpetas) {
    const limpia = carpeta.trim();
    const sinTildes = sinDiacriticos(limpia);
    if (!limpia || RE_CARPETA_SIN_FECHA.test(sinTildes) || PATRONES_CARPETA_ESCANEO.some((re) => re.test(sinTildes))) continue;
    // Se lee como el nombre de un archivo: con una extensión postiza, «Fotos 2019.08» no pierde su mes.
    const encontrada = buscarFecha(`${limpia}.jpg`, opciones.hoy);
    if (encontrada && encontrada.patron !== "marca-tiempo") return encontrada.fecha;
  }
  return null;
}

function buscarFecha(nombreArchivo: string, hoy: Date): Omit<FechaDesdeNombre, "origen"> | null {
  const base = quitarExtension(nombreArchivo).normalize("NFC");
  const minus = base.toLowerCase();

  // 1. Marca de tiempo en milisegundos (FB_IMG_1565786400000.jpg, 1565786400000.jpg).
  const mt = RE_MARCA_TIEMPO.exec(base);
  if (mt) {
    const d = new Date(Number(mt[1]));
    const f = valida(crearFecha(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), hoy);
    if (f && f.anio >= 2004) return { fecha: f, patron: "marca-tiempo" };
  }

  // 2. Pixel (PXL_20190814_223000123): la hora del nombre va en UTC, así que el día es el de aquí
  //    (a las 00:30 del 15 de agosto en España, el nombre dice 14 de agosto a las 22:30).
  const pxl = /^PXL_(\d{4})(\d{2})(\d{2})_([01]\d|2[0-3])([0-5]\d)([0-5]\d)/i.exec(base);
  if (pxl) {
    const [a, m, d, h, mi, s] = pxl.slice(1).map(Number) as [number, number, number, number, number, number];
    if (crearFecha(a, m, d)) {
      const f = valida(fechaDeInstante(new Date(Date.UTC(a, m - 1, d, h, mi, s))), hoy);
      if (f) return { fecha: f, patron: "fecha-compacta" };
    }
  }

  // 2b. Fecha completa con separadores (2019-08-14, Screenshot_2019-08-14-12-30-45, photo_2019-08-14_...).
  const fc = RE_COMPLETA.exec(base);
  if (fc) {
    const f = valida(crearFecha(Number(fc[1]), Number(fc[2]), Number(fc[3])), hoy);
    if (f) return { fecha: f, patron: "fecha-completa" };
  }

  // 3. Fecha compacta (IMG_20190814_123045, PXL_20190814_..., IMG-20190814-WA0001, 20190814123045).
  for (const re of [RE_COMPACTA_HORA, RE_COMPACTA]) {
    const c = re.exec(base);
    if (c) {
      const f = valida(crearFecha(Number(c[1]), Number(c[2]), Number(c[3])), hoy);
      if (f) return { fecha: f, patron: "fecha-compacta" };
    }
  }

  // 4. Día, mes y año con separadores, como se escribe en España (14-08-2019, 14.8.2019).
  const dma = RE_DIA_MES_ANIO.exec(base);
  if (dma) {
    const f = valida(crearFecha(Number(dma[3]), Number(dma[2]), Number(dma[1])), hoy);
    if (f) return { fecha: f, patron: "dia-mes-anio" };
  }

  // 5. Mes escrito: «14 de agosto de 2019», «agosto 2019», «2019 agosto».
  const dme = RE_DIA_MES_ESCRITO.exec(minus);
  if (dme) {
    const f = valida(crearFecha(Number(dme[3]), MESES[dme[2]!], Number(dme[1])), hoy);
    if (f) return { fecha: f, patron: "mes-escrito" };
  }
  const me = RE_MES_ESCRITO.exec(minus);
  if (me) {
    const f = valida(crearFecha(Number(me[2]), MESES[me[1]!]), hoy);
    if (f) return { fecha: f, patron: "mes-escrito" };
  }
  const ame = RE_ANIO_MES_ESCRITO.exec(minus);
  if (ame) {
    const f = valida(crearFecha(Number(ame[1]), MESES[ame[2]!]), hoy);
    if (f) return { fecha: f, patron: "mes-escrito" };
  }

  // 6. Año y mes (2015-08 Menorca). Un curso o una temporada («curso 2011-12») son dos años: sin fecha.
  const am = RE_ANIO_MES.exec(base);
  if (am) {
    const anio = Number(am[1]);
    const mes = Number(am[2]);
    if (mes === (anio + 1) % 100 && RE_PALABRA_CURSO.test(base)) return null;
    const f = valida(crearFecha(anio, mes), hoy);
    if (f) return { fecha: f, patron: "anio-mes" };
  }

  // 7. Año suelto (verano 2015), sin contadores de cámara ni medidas, y solo si no hay dos años distintos.
  const limpio = base.replace(RE_PREFIJO_COPIA, "").replace(RE_CONTADOR, " ").replace(RE_CONTADOR_DENTRO, " ").replace(RE_MEDIDAS, " ");
  const encontrados = [...limpio.matchAll(RE_ANIO)];
  const anios = new Set(encontrados.map((m) => Number(m[1])));
  if (anios.size === 1) {
    const [anio] = [...anios];
    const f = valida(crearFecha(anio!), hoy);
    if (f) {
      const suelto = (i: number) => {
        const antes = limpio[i - 1];
        const despues = limpio[i + 4];
        return (antes === undefined || RE_SEPARA_ANIO.test(antes)) && (despues === undefined || RE_SEPARA_ANIO.test(despues));
      };
      return { fecha: f, patron: "anio", pegado: !encontrados.some((m) => suelto(m.index!)) };
    }
  }
  return null;
}
