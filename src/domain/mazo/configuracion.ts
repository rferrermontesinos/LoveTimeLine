/**
 * Cuándo una carta está «lista» (configurada) y si se puede pasar a Estilo y Pedido. Es la
 * única regla: la usan el carrusel de cartas, la barra de pasos, la barra inferior y el
 * configurador para no dejar avanzar con cartas pendientes.
 */
import { esFechaValida, esFutura, type FechaCarta } from "../fechas/fecha";
import { MAX_DESCRIPCION } from "./limites";
import { siguienteQue } from "./ordenar";

export interface CartaParaConfigurar {
  /** Sin tipo cuenta como carta con foto. */
  tipo?: "foto" | "texto";
  fecha: FechaCarta | null;
  /** Solo en mazos antiguos: fecha puesta sola que hay que confirmar. */
  revisar?: boolean;
  /** Frase de la carta con foto o texto de la carta sin foto. */
  descripcion: string;
}

export type MotivoPendiente =
  | "sin-fecha"
  | "fecha-invalida"
  | "fecha-futura"
  | "fecha-por-confirmar"
  | "descripcion-larga"
  | "texto-vacio"
  | "texto-con-hueco";

/** Hueco por rellenar entre corchetes, como en las ideas de cartas sin foto («Nació [nombre]»). */
const HUECO = /\[[^\]\n]*\]/;

export function tieneHueco(texto: string): boolean {
  return HUECO.test(texto);
}

/** Lo que le falta a una carta de texto: nada, el texto o rellenar un hueco. */
export function textoPendiente(texto: string): "texto-vacio" | "texto-con-hueco" | null {
  if (!texto.trim()) return "texto-vacio";
  return tieneHueco(texto) ? "texto-con-hueco" : null;
}

/** Lo que le falta a una carta para estar lista, en el orden en que conviene resolverlo. */
export function pendientesDeCarta(c: CartaParaConfigurar, hoy: Date): MotivoPendiente[] {
  const p: MotivoPendiente[] = [];
  if (!c.fecha) p.push("sin-fecha");
  else if (!esFechaValida(c.fecha)) p.push("fecha-invalida");
  else if (esFutura(c.fecha, hoy)) p.push("fecha-futura");
  else if (c.revisar) p.push("fecha-por-confirmar");
  if (c.tipo === "texto") {
    const t = textoPendiente(c.descripcion);
    if (t) p.push(t);
  }
  if ([...c.descripcion].length > MAX_DESCRIPCION) p.push("descripcion-larga");
  return p;
}

/**
 * Carta lista: fecha válida y no futura, confirmada si venía de un mazo antiguo, frase de 90
 * caracteres como mucho y, si no tiene foto, un texto sin huecos por rellenar.
 */
export function cartaConfigurada(c: CartaParaConfigurar, hoy: Date): boolean {
  return pendientesDeCarta(c, hoy).length === 0;
}

/** Ids de las cartas pendientes, en el orden del mazo. */
export function cartasPendientes(cartas: readonly (CartaParaConfigurar & { id: string })[], hoy: Date): string[] {
  return cartas.filter((c) => !cartaConfigurada(c, hoy)).map((c) => c.id);
}

/** Se puede pasar a Estilo (y a Pedido) con al menos una carta y ninguna pendiente. */
export function puedeIrAEstilo(cartas: readonly CartaParaConfigurar[], hoy: Date): boolean {
  return cartas.length > 0 && cartas.every((c) => cartaConfigurada(c, hoy));
}

/** Paso más avanzado al que se puede ir: Fotos y Cartas siempre; Estilo y Pedido, con todo listo. */
export function pasoMaximo(cartas: readonly CartaParaConfigurar[], hoy: Date): 2 | 4 {
  return puedeIrAEstilo(cartas, hoy) ? 4 : 2;
}

/** Índice de la siguiente carta pendiente después de `desde` (da la vuelta al final), o -1. */
export function siguientePendiente(cartas: readonly CartaParaConfigurar[], desde: number, hoy: Date): number {
  return siguienteQue(cartas, desde, (c) => !cartaConfigurada(c, hoy));
}
