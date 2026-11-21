"use client";

import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import type { Oferta } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { useMazo } from "@/lib/mazo/contexto";
import { textoOferta } from "@/lib/mazo/ofertas";
import { useCrear } from "./contexto";

/** La frase de una oferta en el idioma de la interfaz (la corta o, con `detalle`, la larga). */
export function useTextoOferta() {
  const t = useTranslations("crear");
  const locale = useLocale();
  return (o: Oferta, moneda: string, detalle = false) => {
    const { clave, valores } = textoOferta(o, moneda, locale, detalle);
    return t(`ofertas.${clave}`, valores);
  };
}

/** Icono de la oferta: una etiqueta de precio para las que proponen algo; un ✓ para el pack ya aplicado. */
export function IconoOferta({ tipo }: { tipo: Oferta["tipo"] }) {
  if (tipo === "pack-aplicado") {
    return (
      <span aria-hidden="true" className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-verde-texto text-[11px] font-bold text-blanco">
        ✓
      </span>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-px h-[18px] w-[18px] shrink-0">
      <path d="M10.6 2.5H16a1.5 1.5 0 0 1 1.5 1.5v5.4a1.5 1.5 0 0 1-.44 1.06l-6.6 6.6a1.5 1.5 0 0 1-2.12 0l-4.9-4.9a1.5 1.5 0 0 1 0-2.12l6.6-6.6a1.5 1.5 0 0 1 1.06-.44Z" fill="var(--color-amarillo)" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13.6" cy="6.4" r="1.4" fill="currentColor" />
    </svg>
  );
}

/**
 * Las ofertas en el paso Pedido, todas y con la frase larga. Subir de pack se consigue con más
 * cartas: fotos o recuerdos sin foto. Bajar de pack se hace aquí mismo. El pack ya aplicado es
 * solo una buena noticia.
 */
export function OfertasPedido() {
  const t = useTranslations("crear");
  const tp = useTranslations("pedido");
  const locale = useLocale();
  const { despachar } = useMazo();
  const { cotizacion, irAPaso, abrirRecuerdo } = useCrear();
  const texto = useTextoOferta();
  if (!cotizacion || cotizacion.ofertas.length === 0) return null;
  return (
    <ul className="space-y-2" data-testid="ofertas-pedido">
      {cotizacion.ofertas.map((o) => (
        <li
          key={o.tipo}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] bg-blanco px-4 py-3 text-sm"
          style={{ boxShadow: `inset 4px 0 0 ${o.tipo === "pack-aplicado" ? "var(--color-verde-texto)" : "var(--color-amarillo)"}` }}
        >
          <p className="flex min-w-0 flex-1 basis-64 items-start gap-2">
            <IconoOferta tipo={o.tipo} />
            <span>{texto(o, cotizacion.moneda, true)}</span>
          </p>
          {(o.tipo === "subir" || (o.tipo === "pack-aplicado" && o.huecos > 0)) && (
            <span className="flex flex-wrap gap-2">
              <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => irAPaso(1)}>
                {tp("anadirFotos")}
              </Boton>
              <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => abrirRecuerdo()}>
                {t("recuerdo.boton")}
              </Boton>
            </span>
          )}
          {o.tipo === "bajar" && (
            <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => despachar({ tipo: "cambiar", campo: "packId", valor: o.pack.id })}>
              {t("ofertas.cambiarA", { pack: textoEn(o.pack.nombre, locale) })}
            </Boton>
          )}
        </li>
      ))}
    </ul>
  );
}
