"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { nuevoId } from "@/lib/importar/procesar";
import { accionCrearMazo, decidirArranque, urlSinPack, type Arranque } from "@/lib/mazo/arranque";
import { useMazo } from "@/lib/mazo/contexto";
import { useCrear } from "./contexto";

/**
 * Arranque del configurador: se empieza siempre en Fotos. En cuanto se ha leído el almacén, se
 * decide una sola vez qué hacer con el mazo guardado y con el `?pack=` de la URL (crear el mazo,
 * cambiarle el pack o nada) y se quita `?pack=` de la URL sin recargar. Devuelve la decisión, que
 * el configurador usa para el aviso del cambio de pack y su «Deshacer».
 * `packUrl`: el `?pack=` con que se abrió la página, leído en el navegador (no como prop del
 * servidor, que volvería con «Atrás» aunque ya no esté en la URL).
 */
export function useArranque(packUrl: string | null): Arranque | null {
  const { estado, mazo, despachar } = useMazo();
  const { catalogo } = useCrear();
  const locale = useLocale();
  const t = useTranslations("estilo");

  // Se decide en el primer render con el almacén leído y se guarda: el aviso y su «Deshacer»
  // necesitan saber qué había antes aunque el mazo cambie después.
  const [decision, setDecision] = useState<Arranque | null>(null);
  if (estado === "listo" && decision === null) setDecision(decidirArranque(mazo, packUrl, catalogo));

  // Se aplica una sola vez: el modo estricto de React repite los efectos al montar, y un segundo
  // «crear» haría otro mazo con otro id.
  const aplicada = useRef(false);
  useEffect(() => {
    if (!decision || aplicada.current) return;
    aplicada.current = true;
    if (decision.tipo === "crear") {
      despachar(accionCrearMazo({ id: nuevoId(), ahora: Date.now(), packId: decision.packId, idiomaMazo: locale, titulo: t("tituloPorDefecto"), catalogo }));
    } else if (decision.tipo === "cambiarPack") {
      despachar({ tipo: "cambiar", campo: "packId", valor: decision.a });
    }
    // Ya usado: si se queda en la URL, al recargar volvería a cambiar el pack.
    const limpia = urlSinPack(window.location.href);
    if (limpia) window.history.replaceState(null, "", limpia);
  }, [decision, despachar, locale, t, catalogo]);

  return decision;
}
