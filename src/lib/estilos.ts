import naipe from "../../styles/plantillas/naipe.json";
import estiloNaipe from "../../styles/naipe/style.json";
import type { TextoI18n } from "@/domain/precios/tipos";

/** Paleta de color que elige el cliente. */
export interface Paleta {
  id: string;
  nombre: TextoI18n;
  /** Color de las pestañas de las esquinas y del fondo del reverso. */
  fondo: string;
  /** Segundo color de la paleta (cartas de texto y detalles). */
  acento: string;
  /** Color del texto sobre el fondo (contraste ≥ 4.5:1). */
  texto: string;
}

export interface Estilo {
  id: string;
  version: number;
  plantilla: string;
  nombre: TextoI18n;
  descripcion: TextoI18n;
  paletaPorDefecto: string;
  paletas: Paleta[];
  colores: { tinta: string; papel: string; celdaInactiva: string; velo: string };
}

export type Plantilla = typeof naipe;
export type Tono = keyof Plantilla["tonosFoto"];
export const TONOS: Tono[] = ["original", "bn", "calido"];

const PLANTILLAS: Record<string, Plantilla> = { naipe };

/**
 * Estilos activos. Hoy hay uno («naipe») con varias paletas: el cliente elige la paleta, no el
 * estilo. Añadir uno = crear styles/<id>/style.json y sumarlo aquí.
 */
export const ESTILOS: Estilo[] = [estiloNaipe];
export const ESTILO_POR_DEFECTO: Estilo = ESTILOS[0]!;

export function obtenerEstilo(id: string | null | undefined): Estilo {
  return ESTILOS.find((e) => e.id === id) ?? ESTILO_POR_DEFECTO;
}

export function obtenerPaleta(estilo: Estilo, paletaId: string | null | undefined): Paleta {
  return estilo.paletas.find((p) => p.id === paletaId) ?? estilo.paletas.find((p) => p.id === estilo.paletaPorDefecto) ?? estilo.paletas[0]!;
}

export function obtenerPlantilla(id: string): Plantilla {
  const p = PLANTILLAS[id];
  if (!p) throw new Error(`Plantilla desconocida: ${id}`);
  return p;
}
