"use client";

import { useMemo } from "react";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { useFoto } from "@/lib/fotos/useFoto";
import { cartaPortada, datosPortada } from "@/lib/mazo/derivados";
import type { Mazo } from "@/lib/mazo/tipos";
import { CartaCanvas } from "./CartaCanvas";

/** La portada del mazo o la caja, con la foto elegida como portada. */
export function CartaPortada({
  mazo,
  tipo,
  cara,
  etiqueta,
  version = 0,
  ancho,
  className,
}: {
  mazo: Mazo;
  tipo: "portada" | "caja";
  cara: Cara;
  etiqueta: string;
  version?: number;
  ancho?: number;
  className?: string;
}) {
  const portada = cartaPortada(mazo);
  const img = useFoto(portada?.id ?? null, "copia", version);
  const base = datosPortada(mazo, tipo, cara);
  const firma = JSON.stringify(base);
  const datos = useMemo<DatosCarta>(
    () => ({
      ...base,
      foto:
        img && portada
          ? { imagen: img.imagen, escala: img.ancho / portada.ancho, recorteAnverso: portada.recorteAnverso, recorteReverso: portada.recorteReverso }
          : null,
    }),
    // `base` cambia de identidad en cada render; `firma` recoge su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firma, img, portada?.id, portada?.recorteAnverso, portada?.recorteReverso, portada?.ancho],
  );
  return (
    <CartaCanvas
      cara={cara}
      datos={datos}
      estiloId={mazo.estiloId}
      tintaId={mazo.tintaId}
      tono={mazo.tono}
      idiomaMazo={mazo.idiomaMazo}
      ancho={ancho}
      etiqueta={etiqueta}
      className={className}
    />
  );
}
