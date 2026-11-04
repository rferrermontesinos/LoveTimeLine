import naipe from "../../styles/plantillas/naipe.json";
import pareja from "../../styles/pareja/style.json";
import familia from "../../styles/familia/style.json";
import type { TextoI18n } from "@/domain/precios/tipos";

export interface Tinta {
  id: string;
  nombre: TextoI18n;
  /** Color de fondo de pestañas y reverso. */
  fondo: string;
  /** Color de la franja de meses. */
  franja: string;
  /** Color del texto sobre el fondo (contraste ≥ 4.5:1). */
  texto: string;
}

export interface Estilo {
  id: string;
  version: number;
  plantilla: string;
  nombre: TextoI18n;
  descripcion: TextoI18n;
  tintaPorDefecto: string;
  tintas: Tinta[];
  colores: { tinta: string; papel: string; celdaInactiva: string; velo: string };
}

export type Plantilla = typeof naipe;
export type Tono = keyof Plantilla["tonosFoto"];
export const TONOS: Tono[] = ["original", "bn", "calido"];

const PLANTILLAS: Record<string, Plantilla> = { naipe };

/** Estilos activos. Añadir uno = crear styles/<id>/style.json y sumarlo aquí. */
export const ESTILOS: Estilo[] = [pareja, familia];

export function obtenerEstilo(id: string): Estilo {
  return ESTILOS.find((e) => e.id === id) ?? ESTILOS[0]!;
}

export function obtenerTinta(estilo: Estilo, tintaId: string | null | undefined): Tinta {
  return estilo.tintas.find((t) => t.id === tintaId) ?? estilo.tintas.find((t) => t.id === estilo.tintaPorDefecto) ?? estilo.tintas[0]!;
}

export function obtenerPlantilla(id: string): Plantilla {
  const p = PLANTILLAS[id];
  if (!p) throw new Error(`Plantilla desconocida: ${id}`);
  return p;
}
