import type { Plantilla } from "@/lib/estilos";

type Fuente = Plantilla["fuentes"][keyof Plantilla["fuentes"]];

const clave = (f: Fuente) => `${f.familia}|${f.peso}|${f.url}`;

/** Fuentes ya cargadas y añadidas al documento: no se vuelven a pedir. */
const cargadas = new Set<string>();
/** La carga en curso, compartida por quien la pida mientras tanto. */
let enCurso: Promise<void> | null = null;

/**
 * Carga las instancias estáticas de Bricolage que usa el dibujante. Las que ya se cargaron no se
 * vuelven a pedir; si alguna falla (sin conexión, por ejemplo), se dibuja con la de respaldo y la
 * siguiente llamada la reintenta. Nunca falla: quien dibuja sigue adelante.
 */
export function cargarFuentesCartas(plantilla: Plantilla): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  if (enCurso) return enCurso;
  const faltan = Object.values(plantilla.fuentes).filter((f) => !cargadas.has(clave(f)));
  if (!faltan.length) return Promise.resolve();
  enCurso = Promise.allSettled(
    faltan.map(async (f) => {
      const cara = new FontFace(f.familia, `url(${f.url})`, { weight: String(f.peso), display: "block" });
      await cara.load();
      document.fonts.add(cara);
      cargadas.add(clave(f));
    }),
  ).then((resultados) => {
    enCurso = null;
    const fallo = resultados.find((r) => r.status === "rejected");
    if (fallo) console.warn("No se pudieron cargar las fuentes de las cartas; se reintentará", fallo.reason);
  });
  return enCurso;
}

/** Ya están todas las fuentes de la plantilla (para saber si hay que reintentar). */
export function fuentesCartasCargadas(plantilla: Plantilla): boolean {
  return Object.values(plantilla.fuentes).every((f) => cargadas.has(clave(f)));
}
