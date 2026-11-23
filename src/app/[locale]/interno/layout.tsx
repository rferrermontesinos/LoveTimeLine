import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

/**
 * Herramientas internas (folleto plegable y muestrario de cartas). No forman parte de la web:
 * dan 404 salvo con HERRAMIENTAS_INTERNAS=1 en el entorno, y nunca se indexan.
 */
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function LayoutInterno({ children }: { children: React.ReactNode }) {
  // Se decide en cada petición: así la variable no se congela al compilar.
  await connection();
  if (process.env.HERRAMIENTAS_INTERNAS !== "1") notFound();
  return children;
}
