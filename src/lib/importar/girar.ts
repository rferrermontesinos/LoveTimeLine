import { leerFoto, guardarFoto } from "@/lib/almacen/idb";
import { invalidarFoto } from "@/lib/fotos/cache";
import { crearLienzo } from "./lienzo";

async function girarBlob(blob: Blob, sentido: 1 | -1, calidad: number) {
  const bitmap = await createImageBitmap(blob);
  try {
    const l = crearLienzo(bitmap.height, bitmap.width);
    l.ctx.translate(bitmap.height / 2, bitmap.width / 2);
    l.ctx.rotate((sentido * Math.PI) / 2);
    l.ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return { blob: await l.aBlob("image/jpeg", calidad), ancho: bitmap.height, alto: bitmap.width };
  } finally {
    bitmap.close();
  }
}

/** Gira 90° la copia de trabajo y la miniatura de una foto. Devuelve el nuevo tamaño. */
export async function girarFoto(id: string, sentido: 1 | -1): Promise<{ ancho: number; alto: number } | null> {
  const [copia, mini] = await Promise.all([leerFoto(id, "copia"), leerFoto(id, "mini")]);
  if (!copia || !mini) return null;
  const [c, m] = await Promise.all([girarBlob(copia, sentido, 0.92), girarBlob(mini, sentido, 0.85)]);
  await guardarFoto(id, c.blob, m.blob);
  invalidarFoto(id);
  return { ancho: c.ancho, alto: c.alto };
}
