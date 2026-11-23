"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { recorteCentrado, recorteReversoDesdeAnverso } from "@/domain/imagen/recorte";
import { PROPORCION_ANVERSO, proporcionReverso } from "@/lib/carta/dibujar";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { obtenerEstilo, obtenerPlantilla } from "@/lib/estilos";
import { CartaCanvas } from "./CartaCanvas";
import { MUESTRAS, type CartaMuestra, type ClaveMuestra } from "@/components/inicio/muestras";

export { MUESTRAS, type CartaMuestra, type ClaveMuestra } from "@/components/inicio/muestras";

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

/**
 * Carta de ejemplo con una foto de muestra (portada, «Cómo se juega»). Con `ligera`, carga la
 * versión pequeña de la foto: basta para cartas de hasta unos 200 px de ancho.
 */
export function CartaDeMuestra({
  muestra,
  cara,
  ancho,
  etiqueta,
  idiomaMazo = "es",
  ligera = false,
  className,
}: {
  muestra: CartaMuestra;
  cara: Cara;
  ancho?: number;
  etiqueta: string;
  idiomaMazo?: string;
  ligera?: boolean;
  className?: string;
}) {
  const bmp = useImagenUrl(ligera && muestra.mini ? muestra.mini : muestra.foto);
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

/** Devuelve una función que da cada muestra con su frase en el idioma de la página (y los cambios que se pidan). */
export function useMuestra(): (clave: ClaveMuestra, cambios?: Partial<CartaMuestra>) => CartaMuestra {
  const t = useTranslations("inicio.muestras");
  return useCallback((clave, cambios) => ({ ...MUESTRAS[clave], descripcion: t(clave), ...cambios }), [t]);
}
