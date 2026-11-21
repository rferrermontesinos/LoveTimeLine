import { notFound } from "next/navigation";

/** Cualquier ruta desconocida dentro de un idioma muestra la página «no existe» traducida. */
export default function RutaDesconocida() {
  notFound();
}
