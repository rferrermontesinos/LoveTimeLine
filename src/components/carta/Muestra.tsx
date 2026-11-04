"use client";

import { useEffect, useMemo, useState } from "react";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { recorteCentrado, recorteReversoDesdeAnverso } from "@/domain/imagen/recorte";
import { PROPORCION_ANVERSO, proporcionReverso } from "@/lib/carta/dibujar";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { obtenerEstilo, obtenerPlantilla } from "@/lib/estilos";
import { CartaCanvas } from "./CartaCanvas";

const cacheUrls = new Map<string, Promise<ImageBitmap | null>>();

function cargarUrl(url: string): Promise<ImageBitmap | null> {
  let p = cacheUrls.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .catch(() => null);
    cacheUrls.set(url, p);
  }
  return p;
}

export function useImagenUrl(url: string | null): ImageBitmap | null {
  const [img, setImg] = useState<{ url: string; bmp: ImageBitmap | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    void cargarUrl(url).then((bmp) => vivo && setImg({ url, bmp }));
    return () => {
      vivo = false;
    };
  }, [url]);
  return img && img.url === url ? img.bmp : null;
}

export interface CartaMuestra {
  foto: string;
  fecha: FechaCarta | null;
  descripcion?: string;
  descripcionEnAnverso?: boolean;
  icono?: string | null;
  /** Sin estilo ni paleta, los de por defecto. */
  estiloId?: string;
  paletaId?: string;
}

/** Carta de ejemplo con una foto de muestra generada (para la portada y las instrucciones). */
export function CartaDeMuestra({
  muestra,
  cara,
  ancho,
  etiqueta,
  idiomaMazo = "es",
  className,
}: {
  muestra: CartaMuestra;
  cara: Cara;
  ancho?: number;
  etiqueta: string;
  idiomaMazo?: string;
  className?: string;
}) {
  const bmp = useImagenUrl(muestra.foto);
  const estilo = obtenerEstilo(muestra.estiloId);
  const plantilla = obtenerPlantilla(estilo.plantilla);
  const datos = useMemo<DatosCarta>(() => {
    if (!bmp) return { tipo: "foto", fecha: muestra.fecha, descripcion: muestra.descripcion, descripcionEnAnverso: muestra.descripcionEnAnverso, icono: muestra.icono ?? null, foto: null };
    const recorteAnverso = recorteCentrado(bmp.width, bmp.height, PROPORCION_ANVERSO);
    const recorteReverso = recorteReversoDesdeAnverso(recorteAnverso, proporcionReverso(plantilla.reverso.altoFoto), bmp.width, bmp.height);
    return {
      tipo: "foto",
      fecha: muestra.fecha,
      descripcion: muestra.descripcion,
      descripcionEnAnverso: muestra.descripcionEnAnverso,
      icono: muestra.icono ?? null,
      foto: { imagen: bmp, escala: 1, recorteAnverso, recorteReverso },
    };
  }, [bmp, muestra, plantilla]);
  return (
    <CartaCanvas
      cara={cara}
      datos={datos}
      estiloId={estilo.id}
      paletaId={muestra.paletaId ?? estilo.paletaPorDefecto}
      tono="original"
      idiomaMazo={idiomaMazo}
      ancho={ancho}
      etiqueta={etiqueta}
      className={className}
    />
  );
}

/**
 * Cartas de ejemplo de la web. Las paletas son las de los antiguos estilos «Pareja» (rosa) y
 * «Familia» (verde), para que la portada se siga viendo como se validó.
 */
export const MUESTRAS: Record<string, CartaMuestra> = {
  menorca: { foto: "/muestras/mar.jpg", fecha: { anio: 2019, mes: 8, dia: 14 }, descripcion: "Nuestro primer viaje juntos, Menorca", descripcionEnAnverso: true, paletaId: "rosa", icono: "estrella" },
  aniversario: { foto: "/muestras/luces.jpg", fecha: { anio: 2021, mes: 12, dia: 12 }, descripcion: "Cena de aniversario", paletaId: "rosa" },
  excursion: { foto: "/muestras/montanas.jpg", fecha: { anio: 2015, mes: 5 }, descripcion: "La primera excursión con los abuelos", paletaId: "verde" },
  jardin: { foto: "/muestras/jardin.jpg", fecha: { anio: 2008 }, descripcion: "El jardín de la casa del pueblo", paletaId: "verde" },
  nieve: { foto: "/muestras/nieve.jpg", fecha: { anio: 2010, mes: 1 }, descripcion: "Primera vez en la nieve", paletaId: "cobalto" },
};
