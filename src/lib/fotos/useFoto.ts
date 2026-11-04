"use client";

import { useEffect, useState } from "react";
import { obtenerImagen, type ImagenDecodificada } from "./cache";

/** Imagen decodificada de una foto guardada (miniatura o copia de trabajo). */
export function useFoto(id: string | null | undefined, tipo: "mini" | "copia", version = 0): ImagenDecodificada | null {
  const [img, setImg] = useState<{ clave: string; valor: ImagenDecodificada | null } | null>(null);
  const clave = id ? `${id}:${tipo}:${version}` : "";
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    void obtenerImagen(id, tipo).then((valor) => {
      if (vivo) setImg({ clave, valor });
    });
    return () => {
      vivo = false;
    };
  }, [id, tipo, clave]);
  return img && img.clave === clave ? img.valor : null;
}
