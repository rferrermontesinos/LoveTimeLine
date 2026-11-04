"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { fechaLegible } from "@/domain/fechas/formato";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { useFoto } from "@/lib/fotos/useFoto";
import { datosCarta } from "@/lib/mazo/derivados";
import type { Carta, Mazo } from "@/lib/mazo/tipos";
import { CartaCanvas } from "./CartaCanvas";

/** Una carta de recuerdo del mazo; si es de foto, con su imagen cargada desde el almacén local. */
export function VistaCarta({
  carta,
  mazo,
  cara,
  icono,
  calidad = "mini",
  ancho,
  guias,
  className,
  version = 0,
}: {
  carta: Carta;
  mazo: Mazo;
  cara: Cara;
  icono: string | null;
  calidad?: "mini" | "copia";
  ancho?: number;
  guias?: boolean;
  className?: string;
  version?: number;
}) {
  const img = useFoto(carta.tipo === "foto" ? carta.id : null, calidad, version);
  const t = useTranslations("comun");
  const locale = useLocale();
  const datos = useMemo<DatosCarta>(
    () => ({
      ...datosCarta(carta, icono),
      foto:
        img && carta.tipo === "foto"
          ? { imagen: img.imagen, escala: img.ancho / carta.ancho, recorteAnverso: carta.recorteAnverso, recorteReverso: carta.recorteReverso }
          : null,
    }),
    [carta, icono, img],
  );
  const fecha = carta.fecha ? fechaLegible(carta.fecha, locale) : "";
  const etiqueta = `${cara === "anverso" ? t("anverso") : t("reverso")}${fecha ? `: ${fecha}` : ""}${carta.descripcion ? `. ${carta.descripcion}` : ""}`;
  return (
    <CartaCanvas
      cara={cara}
      datos={datos}
      estiloId={mazo.estiloId}
      paletaId={mazo.paletaId}
      tono={mazo.tono}
      idiomaMazo={mazo.idiomaMazo}
      ancho={ancho}
      etiqueta={etiqueta}
      guias={guias}
      className={className}
    />
  );
}
