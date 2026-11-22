import { esFechaDeRelojPorDefecto, primeraFechaUtil, type MetadatosFecha, type ValorFecha } from "./exif";
import { senalesDeEscaneo, type SenalEscaneo } from "./escaneo";
import { aIso, ANIO_MINIMO, conPrecision, diferenciaDias, esFutura, fechaDeInstante, precisionDe, rangoDias, type FechaCarta } from "./fecha";
import { fechaDesdeCarpeta, fechaDesdeNombre, type FechaDesdeNombre } from "./nombre-archivo";

export type FuenteFecha = "exif" | "nombre" | "carpeta" | "archivo" | "manual";
/** Fuentes que se detectan solas (todas menos la puesta a mano). */
export type FuenteDetectada = Exclude<FuenteFecha, "manual">;
export type Confianza = "alta" | "media" | "baja";

/**
 * De qué pista sale una fecha puesta sola, que dice cuánto fiarse de ella:
 * - camara: la que guarda la cámara al hacer la foto (fecha original con datos de cámara, o el
 *   nombre que pone el móvil, como IMG_20190814_123045);
 * - metadatos: otra fecha de los metadatos (original sin datos de cámara, la anotada por un
 *   programa de fotos o la original que guarda un escáner);
 * - escrito: la que escribió una persona en el nombre del archivo o de la carpeta.
 *
 * La de envío o de captura (WhatsApp, capturas de pantalla) ya no se pone sola desde el 20 de
 * noviembre de 2026: como mucho se sugiere su mes (ver MotivoRevision «mes-de-envio»).
 */
export type PistaFecha = "camara" | "metadatos" | "escrito";

/** Por qué una fecha queda en blanco (o, en mazos antiguos, solo se sugería). Se explica en lenguaje llano. */
export type MotivoRevision =
  | "fecha-del-archivo"
  // Solo en mazos guardados antes del 4 de noviembre de 2026, cuando las fechas dudosas se
  // rellenaban solas: ya no se propone la fecha del archivo si es reciente.
  | "fecha-de-hoy"
  | "exif-y-nombre-no-coinciden"
  | "reloj-de-camara"
  | "posible-escaneo"
  | "digitalizada-despues"
  | "fecha-anotada"
  | "fecha-reciente"
  | "fecha-de-envio"
  | "captura-de-pantalla"
  /** Llegó por mensajería hace más de un mes: se sugiere el mes del envío, pero la foto puede ser de antes. */
  | "mes-de-envio"
  /** Captura de hace más de un mes: se sugiere su mes, pero lo que sale en ella puede ser de antes. */
  | "mes-de-captura"
  | "sin-datos-de-camara"
  | "fecha-digitalizacion"
  /** Muchas fotos de cámara del mismo día reciente en una subida: seguramente fotos de fotos. */
  | "sesion-de-escaneo";

/** Fecha que se pone sola. */
export interface FechaSegura {
  fecha: FechaCarta;
  fuente: FuenteDetectada;
  confianza: Confianza;
  pista: PistaFecha;
}

/** Fecha posible que no se pone sola: el cliente la usa con un toque o escribe otra. */
export interface SugerenciaPropuesta {
  fecha: FechaCarta;
  fuente: FuenteDetectada;
  /** Por qué no se ha puesto sola, explicado al cliente. */
  motivo: MotivoRevision;
}

export interface ResultadoFecha {
  /** La fecha que se pone sola. Si es null, la carta queda en blanco. */
  automatica: FechaSegura | null;
  /** Solo con la carta en blanco: como mucho MAX_SUGERENCIAS, la mejor primero. */
  sugerencias: SugerenciaPropuesta[];
  /** Por qué queda en blanco (sin fecha automática). */
  motivo?: MotivoRevision;
  /** Hay indicios de que es un escaneo o una copia digital de una foto antigua. */
  escaneo: boolean;
  /** Las señales concretas (para pruebas y depuración; no se guardan). */
  senales: SenalEscaneo[];
}

/**
 * Una fecha de cámara de los días antes de subir la foto no se pone sola: lo normal es que sea la
 * de preparar el mazo (una foto de una foto antigua hecha con el móvil, una copia, un reenvío), no
 * la del recuerdo. Ricard, 20-11-2026: «si algunas fotos tienen fecha de hoy, seguramente es porque
 * se las ha pasado para preparar el mazo».
 */
export const DIAS_PREPARACION = 7;
/**
 * Lo mismo para las fechas de envío (WhatsApp, Telegram…) y de las capturas: un reenvío del último
 * mes puede ser para el mazo, y entonces la fecha real de la foto se ha perdido.
 */
export const DIAS_PREPARACION_ENVIO = 31;
/** En un escaneo, una fecha escrita que puede ser del último año puede ser la del escaneo. */
const DIAS_ESCANEO = 365;
/** Una carpeta con una fecha de otra época (2 años o más antes que la cámara) es la del recuerdo: una foto de una foto. */
const ANIOS_CARPETA_OTRA_EPOCA = 2;
export const MAX_SUGERENCIAS = 2;
/** Días de margen entre dos fechas que deberían coincidir (zonas horarias, fotos de madrugada). */
const MARGEN_DIAS = 1;

export interface EntradaPropuesta {
  nombreArchivo: string;
  /** Ruta dentro de la carpeta elegida o soltada («Menorca 2015/IMG_1234.jpg»); por defecto, el nombre. */
  rutaArchivo?: string;
  exif?: MetadatosFecha | null;
  /** File.lastModified, en milisegundos. Solo se sugiere, nunca se pone sola. */
  ultimaModificacion?: number | null;
  /** El momento de la subida: las ventanas de preparación se cuentan desde aquí. */
  hoy: Date;
}

/** Fecha con día de hace menos de `dias` días. Las de solo año o mes nunca lo son. */
export function esFechaReciente(f: FechaCarta, hoy: Date, dias = DIAS_PREPARACION): boolean {
  return precisionDe(f) === "dia" && rangoDias(fechaDeInstante(hoy))[0] - rangoDias(f)[0] < dias;
}

/**
 * La fecha, con la precisión que tenga, puede caer en los últimos `dias` días: «2026», «noviembre
 * de 2026» o el 18 de noviembre de 2026 (con día, es lo mismo que esFechaReciente).
 */
export function puedeSerReciente(f: FechaCarta, hoy: Date, dias = DIAS_PREPARACION): boolean {
  return rangoDias(fechaDeInstante(hoy))[0] - rangoDias(f)[1] < dias;
}

/** Patrones de fecha del nombre que escribe una máquina, no una persona (20241030-101010, marcas de tiempo). */
const PATRONES_DE_MAQUINA: ReadonlySet<FechaDesdeNombre["patron"]> = new Set(["fecha-compacta", "marca-tiempo"]);

/**
 * Dos fechas que pueden ser la misma: con día, a un día como mucho; si alguna es solo de año o
 * de mes, que sus rangos se solapen («agosto de 2019» es compatible con el 14 de agosto de 2019).
 */
export function fechasCompatibles(a: FechaCarta, b: FechaCarta): boolean {
  if (precisionDe(a) === "dia" && precisionDe(b) === "dia") return diferenciaDias(a, b) <= MARGEN_DIAS;
  const [ia, fa] = rangoDias(a);
  const [ib, fb] = rangoDias(b);
  return ia <= fb && ib <= fa;
}

/** `a` es claramente anterior a `b` (más de un día, o sin solaparse si no tienen día). */
export function anterior(a: FechaCarta, b: FechaCarta): boolean {
  return !fechasCompatibles(a, b) && rangoDias(a)[0] < rangoDias(b)[0];
}

interface Candidata {
  fecha: FechaCarta;
  fuente: FuenteDetectada;
  pista: PistaFecha;
}

const CONFIANZA: Record<PistaFecha, Confianza> = { camara: "alta", metadatos: "media", escrito: "media" };

/**
 * Decide la fecha de una foto. Se pone sola cuando la foto la dice clara; si no, queda en blanco,
 * con una sugerencia de un toque cuando hay una fecha posible, porque una fecha equivocada impresa
 * es peor que una en blanco. Ricard, 20-11-2026: «no elijas fechas si no las tienes claras».
 *
 * 1. La fecha de la cámara (original, o el nombre que pone el móvil), salvo en un escaneo (sería la
 *    del escaneo) o si es de los últimos DIAS_PREPARACION días antes de subirla (foto de una foto,
 *    copia o reenvío para el mazo).
 * 2. Una fecha escrita por una persona en el nombre o en los metadatos («abuelos 1958») gana a la de
 *    la cámara si es anterior: es una foto de una foto antigua, que solo se digitaliza después.
 *    La de la carpeta («Menorca 2015/») gana solo si es de otra época (2 años o más antes).
 * 3. Sin fecha de cámara, la escrita por una persona (nombre, metadatos o carpeta).
 * 4. Sin nada mejor, la de envío o de captura (WhatsApp, capturas) no se pone sola: la foto puede
 *    ser de mucho antes. Si es de hace más de un mes, se sugiere su mes; las recientes son, casi
 *    siempre, reenvíos para el mazo que han perdido la fecha, y no se sugieren.
 *
 * La fecha del archivo nunca se pone sola (es la de la copia o la descarga): como mucho se sugiere.
 */
export function proponerFecha(e: EntradaPropuesta): ResultadoFecha {
  const { hoy } = e;
  const meta = e.exif ?? null;
  const ruta = e.rutaArchivo || e.nombreArchivo;

  let relojPorDefecto = false;
  const leer = (valores: (ValorFecha | undefined)[]) => {
    const r = primeraFechaUtil(valores, hoy);
    relojPorDefecto ||= r.relojPorDefecto;
    return r.fecha;
  };
  const deMetadatos = {
    original: leer([meta?.DateTimeOriginal]),
    digitalizada: leer([meta?.DateTimeDigitized, meta?.XmpDateTimeDigitized, meta?.XmpCreateDate, meta?.IptcDigitalCreationDate]),
    anotada: leer([meta?.IptcDateCreated, meta?.DateCreated]),
  };
  const modificada = leer([meta?.ModifyDate, meta?.XmpModifyDate]);
  // Una captura de pantalla que solo se reconoce por sus metadatos (las del iPhone se llaman
  // IMG_1234.PNG): sus fechas son las de la captura, no las del recuerdo. Va como un «Screenshot_…».
  const capturaPorMetadatos = !!meta?.esCaptura;
  const fechaCaptura = capturaPorMetadatos ? (deMetadatos.original ?? deMetadatos.digitalizada ?? deMetadatos.anotada ?? modificada) : null;
  const original = capturaPorMetadatos ? null : deMetadatos.original;
  const digitalizada = capturaPorMetadatos ? null : deMetadatos.digitalizada;
  const anotada = capturaPorMetadatos ? null : deMetadatos.anotada;
  const nombre: FechaDesdeNombre | null = fechaDesdeNombre(e.nombreArchivo, { hoy });
  const carpeta = fechaDesdeCarpeta(ruta, { hoy });
  // La fecha de envío o de captura de la propia foto: lo que salga en ella no puede ser posterior.
  const fechaEnvioOCaptura = nombre && (nombre.origen === "mensajeria" || nombre.origen === "captura") ? nombre.fecha : fechaCaptura;

  const senales = senalesDeEscaneo(meta, ruta);
  const conSenales = senales.length > 0;
  const camara = !!(meta?.Make || meta?.Model || meta?.tieneExposicion);
  // Cuándo se digitalizó: la fecha de digitalización o, en un escaneo sin ella, la de modificación.
  const fechaEscaneo = digitalizada ?? (conSenales ? modificada : null);
  // La fecha original es anterior a la digitalización: se escaneó o se copió más tarde, y la
  // original es la que guardó (o apuntó) quien la digitalizó.
  const digitalizadaDespues = !!(original && fechaEscaneo && anterior(original, fechaEscaneo));
  const escaneo = conSenales || digitalizadaDespues;
  const preparando = (f: FechaCarta) => puedeSerReciente(f, hoy, DIAS_PREPARACION);

  const resultado = (c: Candidata): ResultadoFecha => ({
    automatica: { fecha: c.fecha, fuente: c.fuente, confianza: CONFIANZA[c.pista], pista: c.pista },
    sugerencias: [],
    escaneo,
    senales,
  });

  // 1. Fecha de la cámara. La del nombre que pone el móvil, como la de los metadatos, no vale si es
  //    la de un reloj sin configurar (IMG_20000101_000500).
  const nombreDeCamara = nombre?.origen === "camara" && !conSenales && !capturaPorMetadatos ? nombre : null;
  const relojEnNombre = !!nombreDeCamara && esFechaDeRelojPorDefecto(nombreDeCamara.fecha);
  relojPorDefecto ||= relojEnNombre;
  let deCamara: Candidata | null = null;
  if (original && (!conSenales || digitalizadaDespues)) {
    // Con señales de escaneo, solo vale la original anterior al escaneo: la apuntó quien escaneó.
    deCamara = { fecha: original, fuente: "exif", pista: camara && !conSenales ? "camara" : "metadatos" };
  } else if (nombreDeCamara && !relojEnNombre) {
    deCamara = { fecha: nombreDeCamara.fecha, fuente: "nombre", pista: "camara" };
  } else if (!original && digitalizada && camara && !escaneo) {
    // Sin original, la de creación de una cámara (xmp:CreateDate de Lightroom, por ejemplo).
    deCamara = { fecha: digitalizada, fuente: "exif", pista: "camara" };
  }

  // 2. Fechas escritas por una persona: en el nombre del archivo y en los metadatos (IPTC o photoshop:DateCreated).
  const escritaEnNombre: Candidata | null =
    nombre?.origen === "escrito" &&
    !esFechaReciente(nombre.fecha, hoy, DIAS_PREPARACION) &&
    // En un escaneo, una fecha con forma de máquina o que puede ser del último año es la del escaneo.
    !(escaneo && (PATRONES_DE_MAQUINA.has(nombre.patron) || puedeSerReciente(nombre.fecha, hoy, DIAS_ESCANEO)))
      ? { fecha: nombre.fecha, fuente: "nombre", pista: "escrito" }
      : null;
  const anotadaUtil: Candidata | null =
    anotada &&
    !(fechaEscaneo && fechasCompatibles(anotada, fechaEscaneo)) &&
    !(escaneo && puedeSerReciente(anotada, hoy, DIAS_ESCANEO)) &&
    !esFechaReciente(anotada, hoy, DIAS_PREPARACION)
      ? { fecha: anotada, fuente: "exif", pista: "metadatos" }
      : null;
  const escrita = escritaEnNombre ?? anotadaUtil;
  // Una carpeta posterior al envío o a la captura («Copia móvil 2024/IMG-20190814-WA0001.jpg») no
  // puede ser la del recuerdo: la foto ya existía antes.
  const carpetaPosible = carpeta && !(fechaEnvioOCaptura && rangoDias(carpeta)[0] > rangoDias(fechaEnvioOCaptura)[1]) ? carpeta : null;
  const deCarpeta: Candidata | null = carpetaPosible && !preparando(carpetaPosible) ? { fecha: carpetaPosible, fuente: "carpeta", pista: "escrito" } : null;

  if (deCamara) {
    // Una fecha escrita anterior a la de la cámara: una foto de una foto antigua («abuelos 1958»).
    if (escrita && anterior(escrita.fecha, deCamara.fecha)) {
      // Salvo un año pegado a otras letras («AnaLeo_1987», «boda-1987»), que puede ser el contador
      // de un fotógrafo: con una cámara de verdad diciendo otra cosa, no está claro. En blanco, con las dos.
      const dudosa = escrita === escritaEnNombre && nombre?.patron === "anio" && nombre.pegado && deCamara.pista === "camara" && !preparando(deCamara.fecha);
      if (!dudosa) return resultado(escrita);
      return enBlanco("exif-y-nombre-no-coinciden", [
        { fecha: deCamara.fecha, fuente: deCamara.fuente, motivo: "exif-y-nombre-no-coinciden" },
        { fecha: escrita.fecha, fuente: escrita.fuente, motivo: "exif-y-nombre-no-coinciden" },
      ]);
    }
    if (deCarpeta && deCamara.fecha.anio - deCarpeta.fecha.anio >= ANIOS_CARPETA_OTRA_EPOCA) return resultado(deCarpeta);
    if (!preparando(deCamara.fecha)) return resultado(deCamara);
    // Cámara de estos días: vale lo que haya escrito una persona; si no, en blanco.
    const otra = escrita ?? deCarpeta;
    if (otra) return resultado(otra);
    return enBlanco("fecha-reciente", [{ fecha: deCamara.fecha, fuente: deCamara.fuente, motivo: "fecha-reciente" }]);
  }

  // 3. Sin cámara: lo escrito por una persona.
  const otra = escrita ?? deCarpeta;
  if (otra) return resultado(otra);

  // 4. Envío o captura (por el nombre o, en las del iPhone, por los metadatos): en blanco; si no
  //    puede ser de preparar el mazo, con su mes como sugerencia.
  if (fechaEnvioOCaptura && !conSenales) {
    const deMensajeria = nombre?.origen === "mensajeria";
    const fuente: FuenteDetectada = nombre && (nombre.origen === "mensajeria" || nombre.origen === "captura") ? "nombre" : "exif";
    if (!puedeSerReciente(fechaEnvioOCaptura, hoy, DIAS_PREPARACION_ENVIO)) {
      const motivoMes: MotivoRevision = deMensajeria ? "mes-de-envio" : "mes-de-captura";
      return enBlanco(motivoMes, [{ fecha: conPrecision(fechaEnvioOCaptura, "mes"), fuente, motivo: motivoMes }]);
    }
    return enBlanco(deMensajeria ? "fecha-de-envio" : "captura-de-pantalla", []);
  }
  // Una fecha de estos días escrita en el nombre («2026-11-19 mazo»): seguramente la de prepararlo.
  if (nombre?.origen === "escrito" && !escaneo && esFechaReciente(nombre.fecha, hoy, DIAS_PREPARACION)) {
    return enBlanco("fecha-reciente", [{ fecha: nombre.fecha, fuente: "nombre", motivo: "fecha-reciente" }]);
  }

  // En blanco. Como pista, la fecha del archivo si es antigua y no es un escaneo (sería la del
  // escaneo o posterior); nunca la de estos días, que es la de la copia.
  const sugerencias: SugerenciaPropuesta[] = [];
  if (!escaneo && e.ultimaModificacion !== undefined && e.ultimaModificacion !== null && Number.isFinite(e.ultimaModificacion)) {
    const f = fechaDeInstante(new Date(e.ultimaModificacion));
    if (f.anio >= ANIO_MINIMO && !esFutura(f, hoy) && !esFechaDeRelojPorDefecto(f) && !puedeSerReciente(f, hoy, DIAS_PREPARACION_ENVIO)) {
      sugerencias.push({ fecha: f, fuente: "archivo", motivo: "fecha-del-archivo" });
    }
  }
  const motivo: MotivoRevision | undefined = escaneo ? "posible-escaneo" : relojPorDefecto ? "reloj-de-camara" : undefined;
  return enBlanco(motivo, sugerencias);

  function enBlanco(motivoBlanco: MotivoRevision | undefined, lista: SugerenciaPropuesta[]): ResultadoFecha {
    const vistas = new Set<string>();
    const unicas = lista.filter((s) => {
      const iso = aIso(s.fecha);
      if (vistas.has(iso)) return false;
      vistas.add(iso);
      return true;
    });
    return { automatica: null, sugerencias: unicas.slice(0, MAX_SUGERENCIAS), motivo: motivoBlanco, escaneo, senales };
  }
}
