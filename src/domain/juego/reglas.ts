/**
 * Números de las reglas que dependen del mazo: cuántas personas caben y cuántas vidas hay.
 * Propuesta pendiente de las partidas de prueba de Jose.
 */

/** Cartas que recibe cada persona al empezar, en los dos tipos de juego. */
export const CARTAS_POR_PERSONA = 7;
/** Más de 6 personas alarga demasiado la partida: a partir de ahí, por parejas. */
export const MAX_PERSONAS = 6;
/** Cartas que se roban de media por persona en el Clásico: conviene que queden en el mazo. */
const RESERVA_POR_PERSONA = 2;
/** La carta inicial, que se pone en el centro con la fecha a la vista. */
const CARTA_INICIAL = 1;

export interface Jugadores {
  /** Hasta cuántas personas se juega con holgura. */
  recomendado: number;
  /** Hasta cuántas cabe repartir y que quede algo para robar. */
  maximo: number;
  /** El mazo da para más de MAX_PERSONAS: el resto, por parejas. */
  porParejas: boolean;
}

/** Cuántas personas pueden jugar con un mazo de n cartas de recuerdos. */
export function jugadoresPorMazo(cartas: number): Jugadores {
  const holgado = Math.floor((cartas - CARTA_INICIAL) / (CARTAS_POR_PERSONA + RESERVA_POR_PERSONA));
  const justo = Math.floor((cartas - CARTA_INICIAL - 1) / CARTAS_POR_PERSONA);
  const recomendado = Math.max(2, Math.min(MAX_PERSONAS, holgado));
  const maximo = Math.max(recomendado, Math.min(MAX_PERSONAS, justo));
  return { recomendado, maximo, porParejas: holgado > MAX_PERSONAS };
}

/** Nuestra historia: una vida por persona con cartas, más una. */
export function vidas(personasConCartas: number): number {
  return Math.max(1, personasConCartas) + 1;
}

/** Variante «Historia completa»: una vida por cada 8 cartas del mazo, redondeando hacia arriba. */
export function vidasHistoriaCompleta(cartas: number): number {
  return Math.max(1, Math.ceil(cartas / 8));
}
