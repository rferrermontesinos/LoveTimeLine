/**
 * Qué fotos de la carpeta de Pexels se usan en la web, con qué encuadre, y cuáles no y por qué.
 * Todas se han mirado a tamaño completo: solo quedan las que no muestran a nadie que pueda ser
 * menor de edad ni nombres reales. Lo usan scripts/muestras/preparar.ts y sus tests.
 */
import type { EncuadreMuestra } from "./recorte";

export type TextoI18n = { es: string; en: string };

export interface FotoElegida {
  /** Nombre del archivo de salida (public/muestras/<id>.jpg) y clave en MUESTRAS (src/components/inicio/muestras.ts). */
  id: string;
  /** Archivo original en la carpeta de Pexels. */
  archivo: string;
  /** Encuadre comprobado con las caras dentro en las dos caras de la carta. */
  encuadre?: EncuadreMuestra;
  /** Qué se ve en la foto, para la lista de créditos (no es el recuerdo inventado de la carta). */
  descripcion: TextoI18n;
}

/** Fotos para las cartas de ejemplo. */
export const SELECCION: FotoElegida[] = [
  { id: "tren", archivo: "01-primer-viaje_pexels-1170184.jpg", encuadre: { centroX: 0.7 }, descripcion: { es: "Pareja de mochileros junto a un tren", en: "Backpacking couple next to a train" } },
  { id: "playa", archivo: "02-playa_pexels-30716714.jpg", descripcion: { es: "Pareja abrazada en la playa al atardecer", en: "Couple hugging on the beach at sunset" } },
  { id: "montana", archivo: "03-montana_pexels-7350882.jpg", encuadre: { centroX: 0.45 }, descripcion: { es: "Pareja mirando el valle desde la montaña", en: "Couple looking out over a valley from a mountain" } },
  { id: "furgoneta", archivo: "04-road-trip_pexels-8230959.jpg", encuadre: { centroX: 0.65 }, descripcion: { es: "Pareja de viaje con una furgoneta camper", en: "Couple on a road trip with a camper van" } },
  { id: "cumple", archivo: "05-cumpleanos_pexels-6800133.jpg", encuadre: { centroX: 0.58 }, descripcion: { es: "Pareja con una tarta de cumpleaños y una bengala", en: "Couple with a birthday cake and a sparkler" } },
  { id: "boda", archivo: "07-brindis-boda_pexels-636006.jpg", encuadre: { centroX: 0.45 }, descripcion: { es: "Brindis de boda", en: "Wedding toast" } },
  { id: "picnic", archivo: "09-picnic_pexels-4873547.jpg", encuadre: { centroY: 0.7, zoom: 1.25 }, descripcion: { es: "Pareja de pícnic en un prado", en: "Couple having a picnic in a meadow" } },
  { id: "cita", archivo: "13-primera-cita_pexels-8836421.jpg", encuadre: { centroX: 0.39 }, descripcion: { es: "Pareja riendo en una cafetería", en: "Couple laughing in a café" } },
  { id: "nochevieja", archivo: "14-nochevieja_pexels-3171811.jpg", encuadre: { centroX: 0.45, centroY: 0.64, zoom: 1.4 }, descripcion: { es: "Brindis bajo una lluvia de confeti", en: "A toast under falling confetti" } },
  { id: "acampada", archivo: "15-acampada_pexels-9630132.jpg", encuadre: { centroX: 0.55 }, descripcion: { es: "Amigos alrededor de una hoguera", en: "Friends around a campfire" } },
  { id: "casa", archivo: "16-casa-nueva_pexels-36729704.jpg", encuadre: { centroX: 0.48 }, descripcion: { es: "Pareja con las llaves de su casa nueva", en: "Couple with the keys to their new home" } },
];

/** Salidas de la mesa: apaisada para pantallas anchas y vertical para el móvil (la escena cambia de forma). */
export const SALIDAS_MESA = [
  { nombre: "mesa.jpg", ancho: 1600, alto: 1000, maxBytes: 200_000 },
  { nombre: "mesa-movil.jpg", ancho: 900, alto: 1200, maxBytes: 160_000 },
] as const;

/** La mesa de madera de la escena de «Cómo se juega»: un fondo, sin personas. */
export const MESA: FotoElegida = {
  id: "mesa",
  archivo: "mesa-madera_pexels-2768391.jpg",
  descripcion: { es: "Mesa de madera vista desde arriba", en: "Wooden table seen from above" },
};

/** Fotos de la carpeta que no se usan, y por qué. */
export const DESCARTADAS: { archivo: string; motivo: string }[] = [
  { archivo: "06-cena-amigos_pexels-5638814.jpg", motivo: "Salen un niño y una chica que puede ser menor de edad." },
  { archivo: "08-concierto_pexels-14267300.jpg", motivo: "Una multitud de festival: no se puede asegurar que todos sean mayores de edad." },
  { archivo: "10-navidad_pexels-5888523.jpg", motivo: "Sale una niña." },
  { archivo: "11-graduacion_pexels-35286503.jpg", motivo: "La banda lleva impreso el nombre real de la graduada y al fondo hay personas que no se distinguen." },
  { archivo: "12-fiesta-sorpresa_pexels-7180617.jpg", motivo: "Sale un bebé (es el cumpleaños de una niña)." },
];

/** Alto de las muestras: unos 1000 × 1400 px, de sobra para la carta más grande de la web. */
export const ALTO_MUESTRA = 1400;
export const MAX_BYTES_MUESTRA = 250_000;

/**
 * Versión ligera de cada muestra (public/muestras/mini/<id>.jpg) para las cartas pequeñas
 * (abanico, ejemplos de fechas, mesa): no pasan de unos 200 px de ancho en pantalla.
 */
export const MINI = { carpeta: "mini", alto: 670, maxBytes: 60_000 } as const;
