"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRINT } from "@config/print";
import { dibujarCara } from "@/lib/carta/dibujar";
import { cargarFuentesCartas } from "@/lib/carta/fuentes";
import { textosCarta } from "@/lib/carta/textos";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { obtenerEstilo, obtenerPlantilla, obtenerTinta, type Tono } from "@/lib/estilos";

export interface PropsCartaCanvas {
  cara: Cara;
  datos: DatosCarta;
  estiloId: string;
  tintaId: string;
  tono: Tono;
  idiomaMazo: string;
  /** Ancho en px CSS. Sin ancho, ocupa el ancho del contenedor. */
  ancho?: number;
  etiqueta: string;
  guias?: boolean;
  className?: string;
  sombra?: boolean;
}

const PROPORCION = PRINT.carta.altoMm / PRINT.carta.anchoMm;

/** Dibuja una cara de carta con el mismo código que el archivo de impresión. */
export function CartaCanvas({ cara, datos, estiloId, tintaId, tono, idiomaMazo, ancho, etiqueta, guias, className = "", sombra = true }: PropsCartaCanvas) {
  const ref = useRef<HTMLCanvasElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const [anchoMedido, setAnchoMedido] = useState<number>(ancho ?? 0);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (ancho) return;
    const el = contenedor.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAnchoMedido(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ancho]);

  const anchoFinal = ancho ?? anchoMedido;
  const estilo = obtenerEstilo(estiloId);
  const plantilla = obtenerPlantilla(estilo.plantilla);
  const firma = useMemo(() => JSON.stringify({ ...datos, foto: datos.foto ? { r1: datos.foto.recorteAnverso, r2: datos.foto.recorteReverso, e: datos.foto.escala } : null }), [datos]);
  const imagen = datos.foto?.imagen ?? null;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || anchoFinal <= 0) return;
    let vivo = true;
    void cargarFuentesCartas(plantilla).then(() => {
      if (!vivo) return;
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2.5);
      const pxPorMm = (anchoFinal * dpr) / PRINT.carta.anchoMm;
      canvas.width = Math.round(PRINT.carta.anchoMm * pxPorMm);
      canvas.height = Math.round(PRINT.carta.altoMm * pxPorMm);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      dibujarCara(ctx, cara, datos, {
        plantilla,
        estilo,
        tinta: obtenerTinta(estilo, tintaId),
        tono,
        idioma: idiomaMazo,
        textos: textosCarta(idiomaMazo),
        conSangrado: false,
        pxPorMm,
        redondear: true,
        guias,
      });
      setListo(true);
    });
    return () => {
      vivo = false;
    };
    // `firma` resume los datos; la imagen se compara por identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, imagen, cara, estiloId, tintaId, tono, idiomaMazo, anchoFinal, guias]);

  return (
    <div ref={contenedor} className={`relative ${ancho ? "" : "w-full"} ${className}`} style={ancho ? { width: ancho } : undefined}>
      <canvas
        ref={ref}
        role="img"
        aria-label={etiqueta}
        className={`block w-full rounded-[calc(var(--radius-carta)*var(--escala-radio,1))] transition-opacity duration-200 ${listo ? "opacity-100" : "opacity-0"} ${sombra ? "shadow-[var(--shadow-carta)]" : ""}`}
        style={{ aspectRatio: `${PRINT.carta.anchoMm} / ${PRINT.carta.altoMm}`, ["--escala-radio" as string]: anchoFinal ? String(Math.min(1, anchoFinal / 378)) : "1" }}
      />
      {!listo && <div aria-hidden="true" className="absolute inset-0 animate-pulse rounded-[12px] bg-papel-3" style={{ aspectRatio: `1 / ${PROPORCION}` }} />}
    </div>
  );
}
