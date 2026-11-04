"use client";

import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { cotizar, formatearImporte, packsActivos, type Cotizacion } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { useMazo } from "@/lib/mazo/contexto";
import { useCrear } from "./contexto";

/**
 * Los packs del catálogo para elegir, de menor a mayor: nombre, para quién, cartas incluidas,
 * precio y precio de cada carta de más, y lo que costaría el mazo con cada uno. Todo sale del
 * catálogo. Elegir uno lo aplica al momento (se puede deshacer): el pack solo marca el mínimo.
 */
export function OpcionesPack({ columnas = true }: { columnas?: boolean }) {
  const t = useTranslations("crear.packs");
  const locale = useLocale();
  const { mazo, despachar } = useMazo();
  const { catalogo, cotizacion } = useCrear();
  const nombre = useId();
  const packs = useMemo(() => packsActivos(catalogo), [catalogo]);
  // Lo que costaría el mazo con cada pack, con sus extras y mecánicas de ahora.
  const precios = useMemo(() => {
    const m = new Map<string, Cotizacion | null>();
    if (!mazo || !cotizacion) return m;
    const extras = mazo.extras.filter((id) => catalogo.extras.some((x) => x.id === id && x.activo));
    const mecanicas = mazo.mecanicas.filter((id) => catalogo.mecanicas.some((x) => x.id === id && x.activo));
    for (const p of packs) {
      try {
        m.set(p.id, cotizar({ catalogo, packId: p.id, cartas: mazo.cartas.length, extras, mecanicas }));
      } catch {
        m.set(p.id, null);
      }
    }
    return m;
  }, [mazo, cotizacion, packs, catalogo]);
  if (!mazo || !cotizacion) return null;
  const n = mazo.cartas.length;

  return (
    <div role="radiogroup" aria-label={t("etiqueta")} className={`grid gap-3 ${columnas ? "sm:grid-cols-3" : ""}`}>
      {packs.map((p) => {
        const activo = p.id === cotizacion.pack.id;
        // Con muchas cartas puede cobrarse un pack mayor que el elegido, porque sale más barato.
        const aplicado = p.id === cotizacion.packAplicado.id && !activo;
        const c = precios.get(p.id);
        const faltan = Math.max(0, p.cartas - n);
        const idDetalle = `${nombre}-${p.id}`;
        // El precio va primero en la descripción: es el dato con el que se decide.
        const idPrecio = `${idDetalle}-precio`;
        return (
          <label
            key={p.id}
            className="relative block cursor-pointer rounded-[16px] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalto"
          >
            <input
              type="radio"
              name={nombre}
              checked={activo}
              onChange={() => despachar({ tipo: "cambiar", campo: "packId", valor: p.id })}
              aria-label={textoEn(p.nombre, locale)}
              aria-describedby={`${idPrecio} ${idDetalle}`}
              className="sr-only"
            />
            <span
              className={`flex h-full flex-col gap-1 rounded-[16px] border-2 bg-blanco p-4 pr-11 transition-colors ${activo ? "border-tinta" : "border-linea hover:border-tinta/50"}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="tipo-subtitular text-lg">{textoEn(p.nombre, locale)}</span>
                <span id={idPrecio} className="tipo-titular text-xl leading-none">
                  {formatearImporte(p.precioCents, p.moneda, locale)}
                </span>
              </span>
              <span id={idDetalle} className="flex flex-col gap-1">
                <span className="text-sm text-tinta-2">{textoEn(p.claim, locale)}</span>
                <span className="text-sm font-semibold">{t("incluidas", { n: p.cartas })}</span>
                <span className="text-sm text-tinta-2">{t("extra", { precio: formatearImporte(p.precioCartaExtraCents, p.moneda, locale) })}</span>
                <span className={`mt-1 text-sm ${faltan ? "text-tinta-2" : "font-semibold"}`}>
                  {faltan > 0 ? t("teFaltan", { n: faltan }) : c ? t("conTus", { n, total: formatearImporte(c.totalCents, c.moneda, locale) }) : null}
                </span>
                {aplicado && <span className="mt-1 w-fit rounded-full bg-[#E3F4EA] px-2 py-0.5 text-xs font-semibold text-verde-texto">{t("aplicado")}</span>}
              </span>
              {activo && (
                <span aria-hidden="true" className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-tinta text-sm font-bold text-papel">
                  ✓
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Diálogo para cambiar de pack desde la barra inferior. */
export function DialogoPack({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const t = useTranslations("crear.packs");
  const tc = useTranslations("comun");
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={t("titulo")}
      ancho="max-w-3xl"
      pie={<Boton onClick={alCerrar}>{tc("listo")}</Boton>}
    >
      <div className="space-y-4">
        <p className="text-sm text-tinta-2">{t("ayuda")}</p>
        <OpcionesPack />
      </div>
    </Dialogo>
  );
}
