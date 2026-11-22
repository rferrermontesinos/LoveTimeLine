import type { Catalogo } from "./tipos";

/**
 * Solo para las pruebas: el catálogo con las mecánicas de cartas especiales (comodines y cartas en
 * blanco) encendidas, como estaban hasta el 22-11-2026. Ese día Ricard las apagó «de momento»
 * («Solo cartas y fechas»); el código que las cuenta, imprime y explica sigue ahí y se prueba con
 * ellas, para que volver a encenderlas sea cambiar `activo` en supabase/catalogo.json.
 */
export function conCartasEspeciales(catalogo: Catalogo): Catalogo {
  return { ...catalogo, mecanicas: catalogo.mecanicas.map((m) => (m.tipo === "cartas" ? { ...m, activo: true } : m)) };
}
