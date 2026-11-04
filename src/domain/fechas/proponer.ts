import { esFechaDeRelojPorDefecto, primeraFechaUtil, type MetadatosFecha, type ValorFecha } from "./exif";
import { senalesDeEscaneo, type SenalEscaneo } from "./escaneo";
import { aIso, ANIO_MINIMO, diferenciaDias, esFutura, fechaDeInstante, precisionDe, rangoDias, type FechaCarta } from "./fecha";
import { fechaDesdeNombre, type FechaDesdeNombre } from "./nombre-archivo";

export type FuenteFecha = "exif" | "nombre" | "archivo" | "manual";
/** Fuentes que se detectan solas (todas menos la puesta a mano). */
export type FuenteDetectada = Exclude<FuenteFecha, "manual">;
export type Confianza = "alta" | "media" | "baja";

/** Por qué una fecha queda en blanco o solo se sugiere. Se muestra al cliente en lenguaje llano. */
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
  | "sin-datos-de-camara"
  | "fecha-digitalizacion";

/** Fecha segura: se rellena sola. */
export interface FechaSegura {
  fecha: FechaCarta;
  fuente: FuenteDetectada;
  confianza: Confianza;
}

/** Fecha posible que no se rellena sola: el cliente la acepta o escribe otra. */
export interface SugerenciaPropuesta {
  fecha: FechaCarta;
  fuente: FuenteDetectada;
  /** Por qué no es segura, explicado al cliente. */
  motivo: MotivoRevision;
}

export interface ResultadoFecha {
  /** Solo cuando estamos seguros. Si es null, la carta queda en blanco. */
  automatica: FechaSegura | null;
  /** Como mucho MAX_SUGERENCIAS, la mejor primero. Nunca se rellenan solas. */
  sugerencias: SugerenciaPropuesta[];
  /** Por qué queda en blanco (sin fecha automática). */
  motivo?: MotivoRevision;
  /** Hay indicios de que es un escaneo o una copia digital de una foto antigua. */
  escaneo: boolean;
  /** Las señales concretas (para pruebas y depuración; no se guardan). */
  senales: SenalEscaneo[];
}

/**
 * Una fecha con día de hace menos de estos días es «reciente» y nunca se rellena sola: quien
 * digitaliza este año fotos antiguas con el móvil obtiene una foto «de cámara» con la fecha de
 * hoy. Con un mes no bastaría: las copias de hace unos meses seguirían colándose.
 */
export const DIAS_FECHA_RECIENTE = 365;
export const MAX_SUGERENCIAS = 2;
/** Días de margen entre dos fechas que deberían coincidir (zonas horarias, fotos de madrugada). */
const MARGEN_DIAS = 1;

export interface EntradaPropuesta {
  nombreArchivo: string;
  /** Ruta dentro de la carpeta elegida o soltada («Escaneos/abuelos.jpg»); por defecto, el nombre. */
  rutaArchivo?: string;
  exif?: MetadatosFecha | null;
  /** File.lastModified, en milisegundos. */
  ultimaModificacion?: number | null;
  hoy: Date;
  /** Para ajustar el umbral de «reciente»; por defecto DIAS_FECHA_RECIENTE. */
  diasReciente?: number;
}

function diasHastaHoy(f: FechaCarta, hoy: Date): number {
  return rangoDias(fechaDeInstante(hoy))[0] - rangoDias(f)[0];
}

/** Fecha con día de hace menos de `dias` días. Las de solo año o mes nunca son recientes. */
export function esFechaReciente(f: FechaCarta, hoy: Date, dias = DIAS_FECHA_RECIENTE): boolean {
  return precisionDe(f) === "dia" && diasHastaHoy(f, hoy) < dias;
}

/**
 * La fecha, con la precisión que tenga, puede caer en los últimos `dias` días: «2026», «octubre de
 * 2026» o el 30 de octubre de 2026 (con día, es lo mismo que esFechaReciente).
 */
export function puedeSerReciente(f: FechaCarta, hoy: Date, dias = DIAS_FECHA_RECIENTE): boolean {
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
function anterior(a: FechaCarta, b: FechaCarta): boolean {
  return !fechasCompatibles(a, b) && rangoDias(a)[0] < rangoDias(b)[0];
}

/**
 * Decide la fecha de una foto. Solo se rellena sola cuando es segura:
 * A) fecha original de una cámara (DateTimeOriginal con marca, modelo o exposición), sin señales
 *    de escaneo, sin digitalizarse después, no reciente y sin contradecir la fecha del nombre;
 * B) sin fecha original (o con una que coincide), el nombre que pone la cámara del móvil
 *    (IMG_/PXL_ AAAAMMDD_hhmmss, Samsung, Dropbox), sin señales de escaneo y no reciente;
 * C) una fecha escrita por una persona en el nombre («abuelos 1958», «2015-08 Menorca»), aunque
 *    la foto parezca escaneada, salvo que sea reciente con día, choque con una fecha de cámara
 *    fiable o, en un escaneo, tenga forma de fecha de máquina o pueda ser del último año (entonces
 *    será la del escaneo: «foto escaneada 2026» en «Escaneos/»).
 * Si no, la carta queda en blanco con hasta dos sugerencias, cada una con su motivo. Nunca se
 * sugieren fechas de digitalización de un escaneo, fechas de reloj sin configurar ni la fecha del
 * archivo si es reciente.
 */
export function proponerFecha(e: EntradaPropuesta): ResultadoFecha {
  const { hoy } = e;
  const dias = e.diasReciente ?? DIAS_FECHA_RECIENTE;
  const meta = e.exif ?? null;
  const reciente = (f: FechaCarta) => esFechaReciente(f, hoy, dias);

  let relojPorDefecto = false;
  const leer = (valores: (ValorFecha | undefined)[]) => {
    const r = primeraFechaUtil(valores, hoy);
    relojPorDefecto ||= r.relojPorDefecto;
    return r.fecha;
  };
  const original = leer([meta?.DateTimeOriginal]);
  const digitalizada = leer([meta?.DateTimeDigitized, meta?.XmpDateTimeDigitized, meta?.XmpCreateDate, meta?.IptcDigitalCreationDate]);
  const modificada = leer([meta?.ModifyDate, meta?.XmpModifyDate]);
  const anotada = leer([meta?.IptcDateCreated, meta?.DateCreated]);
  const nombre: FechaDesdeNombre | null = fechaDesdeNombre(e.nombreArchivo, { hoy });

  const senales = senalesDeEscaneo(meta, e.rutaArchivo || e.nombreArchivo);
  const camara = !!(meta?.Make || meta?.Model || meta?.tieneExposicion);
  // La fecha original es anterior a la digitalización: se escaneó o copió más tarde.
  const digitalizadaDespues = !!(original && digitalizada && anterior(original, digitalizada));
  const escaneo = senales.length > 0 || digitalizadaDespues;
  // Solo las fechas de cámara o escritas por una persona pueden contradecir a la original:
  // las de mensajería y capturas son, por naturaleza, posteriores. Choca con cualquier precisión
  // («verano 2015» frente a una cámara del 14-8-2019), no solo con otro día como decía el encargo:
  // así no se rellena sola una fecha de cámara que la persona contradice (reloj mal puesto, foto en
  // papel fotografiada con cámara años después). Pendiente de que lo confirme Ricard; para bloquear
  // solo con otro día basta con exigir aquí precisionDe(nombre.fecha) === "dia".
  const nombreChoca = !!(original && nombre && (nombre.origen === "camara" || nombre.origen === "escrito") && !fechasCompatibles(original, nombre.fecha));
  const originalFiable = !!(original && camara && !escaneo && !reciente(original));
  // En un escaneo, una fecha del nombre con forma de máquina o que puede ser del último año es,
  // seguramente, la del escaneo: ni se rellena ni se sugiere.
  const nombreDelEscaneo = !!(escaneo && nombre && (PATRONES_DE_MAQUINA.has(nombre.patron) || puedeSerReciente(nombre.fecha, hoy, dias)));

  const segura = (fecha: FechaCarta, fuente: FuenteDetectada, confianza: Confianza): ResultadoFecha => ({
    automatica: { fecha, fuente, confianza },
    sugerencias: [],
    escaneo,
    senales,
  });

  // A) Fecha original de cámara.
  if (original && originalFiable && !nombreChoca) return segura(original, "exif", "alta");
  // B) Nombre de la cámara del móvil, sin original o con una que coincide.
  if (nombre?.origen === "camara" && !escaneo && !reciente(nombre.fecha) && (!original || fechasCompatibles(original, nombre.fecha))) {
    return segura(nombre.fecha, "nombre", "media");
  }
  // C) Fecha escrita por una persona en el nombre.
  if (nombre?.origen === "escrito" && !reciente(nombre.fecha) && !nombreDelEscaneo && !(originalFiable && nombreChoca)) {
    return segura(nombre.fecha, "nombre", "media");
  }

  // Sin fecha segura: sugerencias, de la mejor a la peor.
  const candidatas: SugerenciaPropuesta[] = [];
  const sugerir = (fecha: FechaCarta, fuente: FuenteDetectada, motivo: MotivoRevision) => candidatas.push({ fecha, fuente, motivo });
  // En un escaneo sin fecha de digitalización, la de modificación hace de referencia.
  const referenciaDigital = digitalizada ?? (escaneo ? modificada : null);

  // 1. La foto guarda una fecha original anterior a cuando se digitalizó.
  if (original && referenciaDigital && anterior(original, referenciaDigital)) sugerir(original, "exif", "digitalizada-despues");
  // 2. Fecha anotada (IPTC o photoshop:DateCreated) que no es la de la digitalización.
  if (anotada && !(referenciaDigital && fechasCompatibles(anotada, referenciaDigital)) && !(escaneo && reciente(anotada))) {
    sugerir(anotada, "exif", "fecha-anotada");
  }
  if (original && !escaneo) {
    // 3. Original reciente: puede ser una foto de una foto antigua.
    if (reciente(original)) sugerir(original, "exif", "fecha-reciente");
    // 4. La original y el nombre no coinciden: primero la que escribió una persona.
    if (nombre && nombreChoca) {
      const deNombre = () => sugerir(nombre.fecha, "nombre", "exif-y-nombre-no-coinciden");
      const deOriginal = () => sugerir(original, "exif", "exif-y-nombre-no-coinciden");
      if (nombre.origen === "escrito") {
        deNombre();
        deOriginal();
      } else {
        deOriginal();
        deNombre();
      }
    }
    // 5. Original sin datos de cámara: puede ser la de una copia o una edición.
    if (!camara) sugerir(original, "exif", "sin-datos-de-camara");
  }
  // 6. Fecha del nombre: de envío, de una captura o reciente.
  if (nombre && !escaneo) {
    if (nombre.origen === "mensajeria") sugerir(nombre.fecha, "nombre", "fecha-de-envio");
    else if (nombre.origen === "captura") sugerir(nombre.fecha, "nombre", "captura-de-pantalla");
    else if ((nombre.origen === "camara" || nombre.origen === "escrito") && reciente(nombre.fecha)) sugerir(nombre.fecha, "nombre", "fecha-reciente");
  }
  // 7. Solo la fecha de digitalización, en una foto de cámara que no parece escaneada.
  if (!original && digitalizada && camara && !escaneo) {
    sugerir(digitalizada, "exif", reciente(digitalizada) ? "fecha-reciente" : "fecha-digitalizacion");
  }
  // 8. Último recurso: la fecha del archivo, si es antigua y no es un escaneo (sería la del escaneo o posterior).
  if (candidatas.length === 0 && !escaneo && e.ultimaModificacion !== undefined && e.ultimaModificacion !== null && Number.isFinite(e.ultimaModificacion)) {
    const f = fechaDeInstante(new Date(e.ultimaModificacion));
    if (f.anio >= ANIO_MINIMO && !esFutura(f, hoy) && !esFechaDeRelojPorDefecto(f) && !reciente(f)) sugerir(f, "archivo", "fecha-del-archivo");
  }

  const vistas = new Set<string>();
  const sugerencias = candidatas
    .filter((s) => {
      const iso = aIso(s.fecha);
      if (vistas.has(iso)) return false;
      vistas.add(iso);
      return true;
    })
    .slice(0, MAX_SUGERENCIAS);
  const motivo: MotivoRevision | undefined = escaneo ? "posible-escaneo" : (sugerencias[0]?.motivo ?? (relojPorDefecto ? "reloj-de-camara" : undefined));
  return { automatica: null, sugerencias, motivo, escaneo, senales };
}
