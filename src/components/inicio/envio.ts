/**
 * Países con el envío incluido, para la nota de los packs de la portada. Lógica pura (sin React)
 * para poder probarla: los nombres salen de Intl en el idioma de la página, nunca escritos a mano.
 */
import type { Catalogo } from "@/domain/precios/tipos";

/** «España», «Spain», «España y Portugal»… o null si ningún país activo tiene el envío incluido. */
export function paisesConEnvio(catalogo: Pick<Catalogo, "paises">, idioma: string): string | null {
  const codigos = catalogo.paises.filter((p) => p.activo && p.envioIncluido).map((p) => p.codigo);
  if (codigos.length === 0) return null;
  const nombres = new Intl.DisplayNames([idioma], { type: "region" });
  return new Intl.ListFormat(idioma, { type: "conjunction" }).format(codigos.map((c) => nombres.of(c) ?? c));
}
