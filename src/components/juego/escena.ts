/**
 * Escena de «Cómo se juega»: una partida en marcha vista desde arriba, sobre la foto de una mesa
 * de madera. Aquí solo se decide qué carta va dónde (en % de la escena), en dos formatos: apaisada
 * para pantallas anchas y vertical para el móvil, cada una con su foto de fondo. La dibuja
 * MesaPartida con las cartas de muestra (MUESTRAS) y el mismo dibujo que el archivo de impresión.
 *
 * Lo que tiene que contar de un vistazo: la línea de recuerdos en el centro, ordenada por fecha y
 * por la cara de la fecha; una carta por la cara de la foto a punto de entrar en un hueco; las
 * cartas de dos personas en abanico; el mazo de robo; un comodín y una carta en blanco; y alguna
 * carta de texto (un recuerdo sin foto). Lógica pura, sin React, para poder probarla.
 */
import type { ClaveMuestra } from "@/components/inicio/muestras";
import type { FechaCarta } from "@/domain/fechas/fecha";
import type { Cara } from "@/lib/carta/tipos";

export type FormatoEscena = "apaisada" | "vertical";
export const FORMATOS: readonly FormatoEscena[] = ["apaisada", "vertical"];

/** Foto de fondo de cada formato (la preparan scripts/muestras/preparar.ts y su SALIDAS_MESA). */
export const FONDOS: Record<FormatoEscena, string> = { apaisada: "/juego/mesa.jpg", vertical: "/juego/mesa-movil.jpg" };
/** Ancho/alto de cada formato: el de su foto, para que no se deforme. */
export const PROPORCION_ESCENA: Record<FormatoEscena, number> = { apaisada: 1600 / 1000, vertical: 900 / 1200 };
/** Ancho/alto de una carta (63 × 88 mm). */
export const PROPORCION_CARTA = 63 / 88;

export type Papel = "linea" | "hueco" | "candidata" | "mano" | "robo" | "comodin" | "en-blanco";

export type ContenidoPieza =
  /** Una carta de muestra (foto, fecha y frase de MUESTRAS). */
  | { tipo: "muestra"; clave: ClaveMuestra; cara: Cara }
  /** Un recuerdo sin foto: el texto sale de los mensajes (juego.mesa.textoCarta). */
  | { tipo: "texto"; fecha: FechaCarta; cara: Cara }
  | { tipo: "comodin" }
  | { tipo: "en-blanco" }
  /** El hueco discontinuo de la línea donde va a entrar la candidata. */
  | { tipo: "hueco" };

/** Centro de la pieza en % del ancho (x) y del alto (y) de la escena; ancho en % del ancho; giro en grados. */
export interface Colocacion {
  x: number;
  y: number;
  ancho: number;
  giro: number;
}

export interface PiezaEscena {
  id: string;
  papel: Papel;
  contenido: ContenidoPieza;
  /** Orden de apilado: la mayor, encima. */
  capa: number;
  /** Cartas que asoman debajo, un poco desplazadas (el mazo de robo, los comodines). */
  debajo?: number;
  /** Dónde va en cada formato. Sin colocación, la pieza no sale en ese formato. */
  en: Partial<Record<FormatoEscena, Colocacion>>;
}

/** Recuerdo de texto de la línea: la fecha va antes de la primera cita (MUESTRAS.cita, noviembre de 2015). */
const FECHA_TEXTO: FechaCarta = { anio: 2015, mes: 9 };

/**
 * Las piezas, de atrás adelante. En la línea, de izquierda a derecha y siempre en orden de fecha:
 * recuerdo de texto (sep 2015) · cita (nov 2015, solo apaisada) · tren (2016) · hueco · montaña
 * (2018) · boda (2022). La candidata es la playa (agosto de 2017): encaja justo en el hueco.
 */
export const PIEZAS: readonly PiezaEscena[] = [
  // Línea de recuerdos, por la cara de la fecha.
  {
    id: "linea-texto",
    papel: "linea",
    contenido: { tipo: "texto", fecha: FECHA_TEXTO, cara: "reverso" },
    capa: 1,
    en: { apaisada: { x: 22.5, y: 50, ancho: 9.5, giro: -1 }, vertical: { x: 11.5, y: 54, ancho: 15.5, giro: -1 } },
  },
  {
    id: "linea-cita",
    papel: "linea",
    contenido: { tipo: "muestra", clave: "cita", cara: "reverso" },
    capa: 1,
    en: { apaisada: { x: 33.5, y: 50.5, ancho: 9.5, giro: 1 } },
  },
  {
    id: "linea-tren",
    papel: "linea",
    contenido: { tipo: "muestra", clave: "tren", cara: "reverso" },
    capa: 1,
    en: { apaisada: { x: 44.5, y: 49.5, ancho: 9.5, giro: -0.5 }, vertical: { x: 30.75, y: 54.5, ancho: 15.5, giro: 1 } },
  },
  {
    id: "hueco",
    papel: "hueco",
    contenido: { tipo: "hueco" },
    capa: 1,
    en: { apaisada: { x: 55.5, y: 50, ancho: 9.5, giro: 0 }, vertical: { x: 50, y: 54, ancho: 15.5, giro: 0 } },
  },
  {
    id: "linea-montana",
    papel: "linea",
    contenido: { tipo: "muestra", clave: "montana", cara: "reverso" },
    capa: 1,
    en: { apaisada: { x: 66.5, y: 50.5, ancho: 9.5, giro: 1.5 }, vertical: { x: 69.25, y: 53.5, ancho: 15.5, giro: -1 } },
  },
  {
    id: "linea-boda",
    papel: "linea",
    contenido: { tipo: "muestra", clave: "boda", cara: "reverso" },
    capa: 1,
    en: { apaisada: { x: 77.5, y: 49.5, ancho: 9.5, giro: -1 }, vertical: { x: 88.5, y: 54.5, ancho: 15.5, giro: 1.5 } },
  },

  // Fuera de la línea: comodín y carta en blanco a un lado, mazo de robo al otro.
  {
    id: "comodin",
    papel: "comodin",
    contenido: { tipo: "comodin" },
    capa: 2,
    debajo: 1,
    en: { apaisada: { x: 8.5, y: 33, ancho: 9, giro: -6 }, vertical: { x: 12, y: 24, ancho: 14.5, giro: -6 } },
  },
  {
    id: "en-blanco",
    papel: "en-blanco",
    contenido: { tipo: "en-blanco" },
    capa: 2,
    en: { apaisada: { x: 9, y: 70, ancho: 9, giro: 5 }, vertical: { x: 11.5, y: 79, ancho: 14, giro: 5 } },
  },
  {
    id: "robo",
    papel: "robo",
    contenido: { tipo: "muestra", clave: "picnic", cara: "anverso" },
    capa: 2,
    debajo: 2,
    en: { apaisada: { x: 91.5, y: 50, ancho: 9.5, giro: 3 }, vertical: { x: 87.5, y: 24, ancho: 14.5, giro: 3 } },
  },

  // Las cartas de cada persona, por la cara de la foto: arriba, la de enfrente (del revés para quien mira).
  {
    id: "mano-arriba-1",
    papel: "mano",
    contenido: { tipo: "muestra", clave: "casa", cara: "anverso" },
    capa: 3,
    en: { apaisada: { x: 46, y: 12, ancho: 9, giro: 172 }, vertical: { x: 42, y: 11, ancho: 16, giro: 172 } },
  },
  {
    id: "mano-arriba-2",
    papel: "mano",
    contenido: { tipo: "muestra", clave: "acampada", cara: "anverso" },
    capa: 4,
    en: { apaisada: { x: 54, y: 12.5, ancho: 9, giro: 188 }, vertical: { x: 58, y: 11.5, ancho: 16, giro: 188 } },
  },
  {
    id: "mano-abajo-1",
    papel: "mano",
    contenido: { tipo: "muestra", clave: "furgoneta", cara: "anverso" },
    capa: 3,
    en: { apaisada: { x: 41, y: 86, ancho: 10, giro: -12 }, vertical: { x: 35, y: 87, ancho: 17.5, giro: -11 } },
  },
  {
    id: "mano-abajo-2",
    papel: "mano",
    contenido: { tipo: "muestra", clave: "cumple", cara: "anverso" },
    capa: 4,
    en: { apaisada: { x: 50, y: 85, ancho: 10, giro: 0 }, vertical: { x: 50, y: 85.5, ancho: 17.5, giro: 0 } },
  },
  {
    id: "mano-abajo-3",
    papel: "mano",
    contenido: { tipo: "muestra", clave: "nochevieja", cara: "anverso" },
    capa: 5,
    en: { apaisada: { x: 59, y: 86, ancho: 10, giro: 12 }, vertical: { x: 65, y: 87, ancho: 17.5, giro: 11 } },
  },

  // La carta que va a colocarse, por la cara de la foto, sobre el hueco.
  {
    id: "candidata",
    papel: "candidata",
    contenido: { tipo: "muestra", clave: "playa", cara: "anverso" },
    capa: 6,
    en: { apaisada: { x: 55.5, y: 36, ancho: 10, giro: -7 }, vertical: { x: 50, y: 41, ancho: 16.5, giro: -7 } },
  },
];

/** Numeritos sobre la escena que remiten a la leyenda de debajo, en el orden de la leyenda. */
export interface MarcaEscena {
  numero: number;
  /** Clave de la leyenda (juego.mesa.leyenda.<clave>). */
  clave: "linea" | "candidata" | "manos" | "robo" | "comodin" | "enBlanco";
  /** Las piezas a las que señala. */
  papeles: Papel[];
  en: Record<FormatoEscena, { x: number; y: number }>;
}

/** Diámetro de cada marca, en % del ancho de la escena (el estilo usa las mismas medidas). */
export const DIAMETRO_MARCA: Record<FormatoEscena, number> = { apaisada: 2.8, vertical: 7.5 };

/** Lo que una carta de `debajo` asoma respecto a la de encima, en % de su ancho. */
export const ASOMA_DEBAJO = 3.5;

export const MARCAS: readonly MarcaEscena[] = [
  { numero: 1, clave: "linea", papeles: ["linea"], en: { apaisada: { x: 22.5, y: 65 }, vertical: { x: 11.5, y: 66.5 } } },
  { numero: 2, clave: "candidata", papeles: ["candidata", "hueco"], en: { apaisada: { x: 64.5, y: 26 }, vertical: { x: 64.5, y: 31 } } },
  { numero: 3, clave: "manos", papeles: ["mano"], en: { apaisada: { x: 68.5, y: 86 }, vertical: { x: 86, y: 86 } } },
  { numero: 4, clave: "robo", papeles: ["robo"], en: { apaisada: { x: 91.5, y: 33 }, vertical: { x: 87.5, y: 9 } } },
  { numero: 5, clave: "comodin", papeles: ["comodin"], en: { apaisada: { x: 8.5, y: 17.5 }, vertical: { x: 12, y: 9 } } },
  { numero: 6, clave: "enBlanco", papeles: ["en-blanco"], en: { apaisada: { x: 9, y: 85.5 }, vertical: { x: 11.5, y: 92.5 } } },
];

/** Piezas que salen en un formato, con su colocación. */
export function piezasEn(formato: FormatoEscena): (PiezaEscena & { colocacion: Colocacion })[] {
  return PIEZAS.flatMap((p) => {
    const colocacion = p.en[formato];
    return colocacion ? [{ ...p, colocacion }] : [];
  });
}

/** La línea de un formato (cartas y hueco), de izquierda a derecha. */
export function lineaEn(formato: FormatoEscena) {
  return piezasEn(formato)
    .filter((p) => p.papel === "linea" || p.papel === "hueco")
    .sort((a, b) => a.colocacion.x - b.colocacion.x);
}

/** Rectángulo en % de la escena: izquierda, arriba, derecha, abajo. */
export interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Caja que ocupa una carta girada, en % de la escena. El alto de la carta en % del alto de la
 * escena depende de la forma de la escena: por eso se pasa por píxeles relativos.
 */
export function cajaDe(c: Colocacion, formato: FormatoEscena): Caja {
  const proporcion = PROPORCION_ESCENA[formato];
  // Unidades: ancho de la escena = 100, alto = 100 / proporción.
  const altoEscena = 100 / proporcion;
  const w = c.ancho;
  const h = c.ancho / PROPORCION_CARTA;
  const g = (c.giro * Math.PI) / 180;
  const anchoGirada = Math.abs(w * Math.cos(g)) + Math.abs(h * Math.sin(g));
  const altoGirada = Math.abs(w * Math.sin(g)) + Math.abs(h * Math.cos(g));
  const cx = c.x;
  const cy = (c.y / 100) * altoEscena;
  return {
    x0: cx - anchoGirada / 2,
    x1: cx + anchoGirada / 2,
    y0: ((cy - altoGirada / 2) / altoEscena) * 100,
    y1: ((cy + altoGirada / 2) / altoEscena) * 100,
  };
}

/** ¿Se pisan dos cajas? */
export function sePisan(a: Caja, b: Caja): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
