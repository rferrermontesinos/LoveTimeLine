/**
 * Ideas para los recuerdos sin foto («El día que nos conocimos», «Nació [nombre]»…). Van en el
 * idioma del mazo, no en el de la interfaz: son el texto que se imprime en la carta.
 */
import { tieneHueco } from "@/domain/mazo/configuracion";
import { mensajesDe } from "../../../messages";
import type { Carta } from "./tipos";

type ClaveIdea = keyof ReturnType<typeof mensajesDe>["cartas"]["ideas"];

/** Todas las ideas, en el orden de messages/<idioma>/cartas.json. */
export function ideasDeRecuerdo(idiomaMazo: string): string[] {
  return Object.values(mensajesDe(idiomaMazo).cartas.ideas);
}

/** Las primeras que se proponen tras subir fotos: variadas, para parejas y para familias. */
const DESTACADAS: readonly ClaveIdea[] = ["conocimos", "primerViaje", "boda", "nacio", "mascota"];

/**
 * Ideas para proponer tras subir fotos: primero las destacadas y después el resto, sin las que
 * ya están en el mazo, hasta `n`.
 */
export function ideasParaProponer(idiomaMazo: string, cartas: readonly Pick<Carta, "tipo" | "descripcion">[], n = 4): string[] {
  const ideas = mensajesDe(idiomaMazo).cartas.ideas;
  const destacadas = DESTACADAS.map((k) => ideas[k]);
  const resto = Object.values(ideas).filter((i) => !destacadas.includes(i));
  return ideasLibres([...destacadas, ...resto], cartas).slice(0, n);
}

const normal = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase();

/**
 * Las ideas que aún no están en el mazo como carta sin foto. Las que llevan hueco («Nació
 * [nombre]») siempre siguen libres: puede haber varios nacimientos.
 */
export function ideasLibres(ideas: readonly string[], cartas: readonly Pick<Carta, "tipo" | "descripcion">[]): string[] {
  const usadas = new Set(cartas.filter((c) => c.tipo === "texto").map((c) => normal(c.descripcion)));
  return ideas.filter((i) => tieneHueco(i) || !usadas.has(normal(i)));
}
