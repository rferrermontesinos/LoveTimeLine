import type { Plantilla } from "@/lib/estilos";

let promesa: Promise<void> | null = null;

/** Carga una sola vez las instancias estáticas de Bricolage que usa el dibujante. */
export function cargarFuentesCartas(plantilla: Plantilla): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  if (!promesa) {
    promesa = Promise.all(
      Object.values(plantilla.fuentes).map(async (f) => {
        const cara = new FontFace(f.familia, `url(${f.url})`, { weight: String(f.peso), display: "block" });
        await cara.load();
        document.fonts.add(cara);
      }),
    )
      .then(() => undefined)
      .catch((e) => {
        console.warn("No se pudieron cargar las fuentes de las cartas", e);
      });
  }
  return promesa;
}
