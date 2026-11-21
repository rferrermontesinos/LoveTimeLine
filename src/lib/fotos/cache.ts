/**
 * Decodifica las fotos guardadas para dibujarlas. Las miniaturas se guardan en memoria
 * (muchas, pequeñas); de la copia de trabajo solo unas pocas a la vez.
 */
import { leerFoto } from "@/lib/almacen/idb";

export interface ImagenDecodificada {
  imagen: ImageBitmap;
  ancho: number;
  alto: number;
}

type Tipo = "copia" | "mini";
const LIMITE: Record<Tipo, number> = { mini: 400, copia: 4 };
const caches: Record<Tipo, Map<string, Promise<ImagenDecodificada | null>>> = { mini: new Map(), copia: new Map() };
/** Versión por foto: al girar una foto, se invalida su caché. */
const versiones = new Map<string, number>();

function claveCache(id: string) {
  return `${id}#${versiones.get(id) ?? 0}`;
}

export function invalidarFoto(id: string) {
  versiones.set(id, (versiones.get(id) ?? 0) + 1);
}

export function obtenerImagen(id: string, tipo: Tipo): Promise<ImagenDecodificada | null> {
  const cache = caches[tipo];
  const k = claveCache(id);
  const existente = cache.get(k);
  if (existente) {
    cache.delete(k);
    cache.set(k, existente);
    return existente;
  }
  const p = (async () => {
    const blob = await leerFoto(id, tipo);
    if (!blob) return null;
    const imagen = await createImageBitmap(blob);
    return { imagen, ancho: imagen.width, alto: imagen.height };
  })().catch(() => null);
  cache.set(k, p);
  while (cache.size > LIMITE[tipo]) {
    const primera = cache.keys().next().value as string;
    const vieja = cache.get(primera);
    cache.delete(primera);
    void vieja?.then((v) => v?.imagen.close());
  }
  return p;
}

/** Decodifica un blob suelto para un uso puntual (por ejemplo, la impresión). Hay que cerrarlo. */
export async function decodificarFoto(id: string, tipo: Tipo): Promise<ImagenDecodificada | null> {
  const blob = await leerFoto(id, tipo);
  if (!blob) return null;
  const imagen = await createImageBitmap(blob);
  return { imagen, ancho: imagen.width, alto: imagen.height };
}
