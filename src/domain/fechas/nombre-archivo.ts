import { ANIO_MINIMO, crearFecha, esFutura, type FechaCarta } from "./fecha";

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

/** Contadores de cámara al principio del nombre: IMG_2015 no es el año 2015. */
const RE_CONTADOR = /^(?:img|dsc[nf_]?|_dsc|_mg|pict?|gopr|gh\d{2}|mvi|vid|sam|wp|p|dji|cimg|hpim|imag)[_-]?\d+/i;
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

export function fechaDesdeNombre(nombreArchivo: string, opciones: { hoy: Date }): FechaDesdeNombre | null {
  const { hoy } = opciones;
  const base = quitarExtension(nombreArchivo).normalize("NFC");
  const minus = base.toLowerCase();

  // 1. Marca de tiempo en milisegundos (FB_IMG_1565786400000.jpg, 1565786400000.jpg).
  const mt = RE_MARCA_TIEMPO.exec(base);
  if (mt) {
    const d = new Date(Number(mt[1]));
    const f = valida(crearFecha(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), hoy);
    if (f && f.anio >= 2004) return { fecha: f, patron: "marca-tiempo" };
  }

  // 2. Fecha completa con separadores (2019-08-14, Screenshot_2019-08-14-12-30-45, photo_2019-08-14_...).
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

  // 6. Año y mes (2015-08 Menorca).
  const am = RE_ANIO_MES.exec(base);
  if (am) {
    const f = valida(crearFecha(Number(am[1]), Number(am[2])), hoy);
    if (f) return { fecha: f, patron: "anio-mes" };
  }

  // 7. Año suelto (verano 2015), sin contadores de cámara ni medidas, y solo si no hay dos años distintos.
  const limpio = base.replace(RE_CONTADOR, " ").replace(RE_MEDIDAS, " ");
  const anios = new Set<number>();
  for (const m of limpio.matchAll(RE_ANIO)) anios.add(Number(m[1]));
  if (anios.size === 1) {
    const [anio] = [...anios];
    const f = valida(crearFecha(anio!), hoy);
    if (f) return { fecha: f, patron: "anio" };
  }
  return null;
}
