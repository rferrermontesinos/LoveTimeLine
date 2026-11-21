"use client";

import { useMemo } from "react";
import type { Catalogo } from "@/domain/precios/tipos";
import type { Cara, DatosCarta, VarianteCaja } from "@/lib/carta/tipos";
import { useFoto } from "@/lib/fotos/useFoto";
import { datosCaja, fotoCaja, varianteCaja } from "@/lib/mazo/derivados";
import type { Mazo } from "@/lib/mazo/tipos";
import { CartaCanvas } from "./CartaCanvas";

/**
 * La caja del mazo tal como llegará: la de siempre (stock, solo la marca) o, con el extra de
 * caja personalizada, con su foto (la elegida, la propia o la de la portada) y el título.
 * `variante` fuerza una de las dos (por ejemplo, para enseñar las dos al elegir el extra).
 * La etiqueta accesible es la de la variante que se dibuja: así nunca anuncia un título que la
 * caja no lleva. Con `etiquetas` a null la caja es decorativa (oculta al lector de pantalla).
 */
export function VistaCaja({
  mazo,
  catalogo,
  cara,
  etiquetas,
  variante,
  version = 0,
  ancho,
  className,
}: {
  mazo: Mazo;
  catalogo: Pick<Catalogo, "extras">;
  cara: Cara;
  etiquetas: Record<VarianteCaja, string> | null;
  variante?: VarianteCaja;
  /** Versión de la foto de la caja: cambia cuando se vuelve a guardar (recorte nuevo). */
  version?: number;
  ancho?: number;
  className?: string;
}) {
  const v = variante ?? varianteCaja(mazo, catalogo);
  const foto = v === "personalizada" ? fotoCaja(mazo) : null;
  const img = useFoto(foto?.id ?? null, "copia", version);
  const base = datosCaja(mazo, cara, v);
  const firma = JSON.stringify(base);
  const datos = useMemo<DatosCarta>(
    () => ({
      ...base,
      foto: img && foto ? { imagen: img.imagen, escala: img.ancho / foto.ancho, recorteAnverso: foto.recorte, recorteReverso: foto.recorte } : null,
    }),
    // `base` y `foto` cambian de identidad en cada render; `firma` y el recorte recogen su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firma, img, foto?.id, foto?.ancho, foto?.recorte],
  );
  return (
    <CartaCanvas
      cara={cara}
      datos={datos}
      estiloId={mazo.estiloId}
      paletaId={mazo.paletaId}
      tono={mazo.tono}
      idiomaMazo={mazo.idiomaMazo}
      ancho={ancho}
      etiqueta={etiquetas ? etiquetas[v] : ""}
      className={className}
    />
  );
}
