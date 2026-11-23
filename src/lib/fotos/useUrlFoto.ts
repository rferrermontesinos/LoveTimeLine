"use client";

import { useEffect, useState } from "react";
import { leerFoto } from "@/lib/almacen/idb";

/** URL temporal (blob:) de una foto guardada; se libera al desmontar. */
export function useUrlFoto(id: string | null | undefined, tipo: "mini" | "copia", version = 0): string | null {
  const [url, setUrl] = useState<{ clave: string; url: string } | null>(null);
  const clave = id ? `${id}:${tipo}:${version}` : "";
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    let creada: string | null = null;
    void leerFoto(id, tipo).then((blob) => {
      if (!vivo || !blob) return;
      creada = URL.createObjectURL(blob);
      setUrl({ clave, url: creada });
    });
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [id, tipo, clave]);
  return url && url.clave === clave ? url.url : null;
}
