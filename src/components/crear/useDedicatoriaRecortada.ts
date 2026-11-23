"use client";

import { useEffect, useMemo, useState } from "react";
import { dedicatoriaRecortada } from "@/lib/carta/dibujar";
import { cargarFuentesCartas, fuentesCartasCargadas } from "@/lib/carta/fuentes";
import { obtenerEstilo, obtenerPlantilla } from "@/lib/estilos";

/**
 * Si la dedicatoria no cabe entera detrás de la portada y se imprimiría cortada con «…» (caben
 * hasta las líneas de la plantilla, y cada salto de línea cuenta). Mide con las fuentes de las
 * cartas, como el archivo de impresión: mientras no estén, no dice nada.
 */
export function useDedicatoriaRecortada(estiloId: string | undefined, texto: string): boolean {
  const plantilla = estiloId === undefined ? null : obtenerPlantilla(obtenerEstilo(estiloId).plantilla);
  const [listas, setListas] = useState(false);
  useEffect(() => {
    if (!plantilla) return;
    let vivo = true;
    void cargarFuentesCartas(plantilla).then(() => {
      if (vivo) setListas(fuentesCartasCargadas(plantilla));
    });
    return () => {
      vivo = false;
    };
  }, [plantilla]);
  return useMemo(() => {
    if (!plantilla || !listas || !texto.trim()) return false;
    const ctx = document.createElement("canvas").getContext("2d");
    return !!ctx && dedicatoriaRecortada(ctx, plantilla, texto);
  }, [plantilla, listas, texto]);
}
