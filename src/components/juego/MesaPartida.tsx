"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { CartaCanvas } from "@/components/carta/CartaCanvas";
import { CartaDeMuestra, useMuestra } from "@/components/carta/Muestra";
import { obtenerEstilo, obtenerPaleta } from "@/lib/estilos";
import { ASOMA_DEBAJO, FONDOS, FORMATOS, MARCAS, PIEZAS, type Colocacion, type ContenidoPieza, type FormatoEscena } from "./escena";
import estilos from "./MesaPartida.module.css";

/** Iconos de la esquina del comodín y de la carta en blanco (los del catálogo). */
export interface IconosMesa {
  comodin: string | null;
  enBlanco: string | null;
}

const SUFIJO: Record<FormatoEscena, string> = { apaisada: "a", vertical: "v" };

/** Variables CSS con la colocación de una pieza en cada formato (las lee MesaPartida.module.css). */
function variables(en: Partial<Record<FormatoEscena, Partial<Colocacion>>>): CSSProperties {
  const v: Record<string, string> = {};
  for (const f of FORMATOS) {
    const c = en[f];
    if (!c) continue;
    const s = SUFIJO[f];
    if (c.x !== undefined) v[`--x-${s}`] = `${c.x}%`;
    if (c.y !== undefined) v[`--y-${s}`] = `${c.y}%`;
    if (c.ancho !== undefined) v[`--w-${s}`] = `${c.ancho}%`;
    if (c.giro !== undefined) v[`--g-${s}`] = `${c.giro}deg`;
  }
  return v as CSSProperties;
}

/** En qué formato sale solo una pieza, si no sale en los dos. */
function soloEn(en: Partial<Record<FormatoEscena, unknown>>): FormatoEscena | undefined {
  const formatos = FORMATOS.filter((f) => en[f]);
  return formatos.length === 1 ? formatos[0] : undefined;
}

/**
 * Una partida en marcha sobre la mesa, con cartas dibujadas igual que las de verdad (todas con la
 * paleta por defecto, como un mazo). Es una imagen: un solo `role="img"` con su descripción, y las
 * cartas ocultas a los lectores de pantalla. Debajo, la leyenda de los números.
 */
export function MesaPartida({ idioma, iconos }: { idioma: string; iconos: IconosMesa }) {
  const t = useTranslations("juego");
  const muestra = useMuestra();
  const estilo = obtenerEstilo(undefined);
  const paleta = obtenerPaleta(estilo, null);

  const carta = (c: ContenidoPieza) => {
    const comun = { estiloId: estilo.id, paletaId: paleta.id, tono: "original" as const, idiomaMazo: idioma, etiqueta: "" };
    switch (c.tipo) {
      case "muestra":
        return <CartaDeMuestra muestra={muestra(c.clave, { paletaId: paleta.id })} cara={c.cara} etiqueta="" idiomaMazo={idioma} ligera />;
      case "texto":
        return <CartaCanvas {...comun} cara={c.cara} datos={{ tipo: "texto", fecha: c.fecha, texto: t("mesa.textoCarta"), icono: null }} />;
      case "comodin":
        return <CartaCanvas {...comun} cara="anverso" datos={{ tipo: "comodin", icono: iconos.comodin }} />;
      case "en-blanco":
        return <CartaCanvas {...comun} cara="anverso" datos={{ tipo: "en-blanco", icono: iconos.enBlanco }} />;
      case "hueco":
        return <div className={estilos.hueco} />;
    }
  };

  return (
    <figure>
      <div
        role="img"
        aria-label={t("mesaAlt")}
        data-escena
        className={estilos.escena}
        style={{ "--fondo-v": `url(${FONDOS.vertical})`, "--fondo-a": `url(${FONDOS.apaisada})` } as CSSProperties}
      >
        {PIEZAS.map((p) => (
          <div key={p.id} aria-hidden="true" data-pieza={p.id} data-solo={soloEn(p.en)} className={estilos.pieza} style={{ ...variables(p.en), zIndex: p.capa }}>
            {Array.from({ length: p.debajo ?? 0 }, (_, i) => (
              <span
                key={i}
                className={estilos.debajo}
                style={{ background: paleta.fondo, transform: `translate(${-ASOMA_DEBAJO * (i + 1)}%, ${(ASOMA_DEBAJO * (i + 1)) / 2}%) rotate(${-2.5 * (i + 1)}deg)` }}
              />
            ))}
            <div className={`relative ${p.papel === "candidata" ? estilos.flota : ""}`}>{carta(p.contenido)}</div>
          </div>
        ))}
        {MARCAS.map((m) => (
          <span key={m.numero} aria-hidden="true" className={estilos.marca} style={variables(m.en)}>
            {m.numero}
          </span>
        ))}
      </div>
      <figcaption className="mt-5">
        <ol className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {MARCAS.map((m) => (
            <li key={m.numero} className="flex gap-3">
              <span aria-hidden="true" className="tipo-titular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-tinta text-[0.95rem] leading-none text-papel">
                {m.numero}
              </span>
              <span className="text-tinta-2">{t(`mesa.leyenda.${m.clave}`)}</span>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
