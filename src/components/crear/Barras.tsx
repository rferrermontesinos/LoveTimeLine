"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Piezas";
import { reservarAbajo } from "@/components/ui/reservaAbajo";
import { formatearImporte } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { useMazo } from "@/lib/mazo/contexto";
import { ofertaPrincipal } from "@/lib/mazo/ofertas";
import type { Paso } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";
import { IconoOferta, useTextoOferta } from "./Ofertas";
import { DialogoPack } from "./SelectorPack";

const PASOS: { n: Paso; clave: "fotos" | "cartas" | "estilo" | "pedido" }[] = [
  { n: 1, clave: "fotos" },
  { n: 2, clave: "cartas" },
  { n: 3, clave: "estilo" },
  { n: 4, clave: "pedido" },
];

/**
 * Los cuatro pasos. Estilo y Pedido no están disponibles mientras falte alguna carta por
 * completar: siguen enfocables y, al pulsarlos, llevan a la primera carta pendiente.
 */
export function BarraPasos() {
  const t = useTranslations("crear.pasos");
  const { mazo } = useMazo();
  const { irAPaso, pasoActual, puedeAvanzar } = useCrear();
  const idBloqueo = useId();
  if (!mazo) return null;
  return (
    <nav aria-label={t("etiqueta")} className="sticky top-16 z-20 border-b border-linea bg-papel/95 backdrop-blur">
      <ol className="mx-auto flex max-w-[1200px] gap-1.5 px-4 py-2.5 sm:gap-2 sm:px-6">
        {PASOS.map(({ n, clave }) => {
          const actual = pasoActual === n;
          const hecho = pasoActual > n;
          const bloqueado = n >= 3 && !puedeAvanzar;
          return (
            <li key={n} className="flex-1">
              <button
                type="button"
                onClick={() => irAPaso(n)}
                aria-current={actual ? "step" : undefined}
                aria-disabled={bloqueado || undefined}
                aria-describedby={bloqueado ? idBloqueo : undefined}
                title={bloqueado ? t("bloqueado") : undefined}
                className={`group flex w-full flex-col justify-center gap-1.5 rounded-[10px] px-1 py-1 text-left max-sm:min-h-11 ${bloqueado ? "cursor-not-allowed" : "hover:bg-papel-2"}`}
              >
                <span className={`block h-2 rounded-[3px] transition-colors ${actual ? "bg-tinta" : hecho ? "bg-rosa" : "bg-papel-3"}`} />
                <span className={`tipo-micro text-micro ${actual ? "text-tinta" : "text-tinta-2"} ${bloqueado ? "opacity-60" : ""}`}>
                  <span className="sr-only">{t("paso", { n })}: </span>
                  <span aria-hidden="true">{n} · </span>
                  {t(clave)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <span id={idBloqueo} className="sr-only">
        {t("bloqueado")}
      </span>
    </nav>
  );
}

/**
 * Barra inferior fija: el pack (con su selector), cuántas cartas llevas frente al mínimo, una
 * línea de oferta si la hay, el total y el siguiente paso. En el paso de cartas, si falta alguna
 * por completar, «Siguiente: estilo» se desactiva y la barra dice cuántas faltan, con un botón
 * para ir a la siguiente (y la oferta espera: primero, completar las cartas).
 */
export function BarraAccion() {
  const t = useTranslations("crear");
  const tc = useTranslations("comun");
  const locale = useLocale();
  const { mazo, despachar } = useMazo();
  const { cotizacion, irAPaso, pasoActual, pendientes, puedeAvanzar, cartaActiva, irASiguientePendiente } = useCrear();
  const [dialogoPack, setDialogoPack] = useState(false);
  const idFaltan = useId();
  const textoDe = useTextoOferta();
  if (!mazo || !cotizacion) return null;
  const siguiente: Record<number, { texto: string; paso: Paso } | null> = {
    1: { texto: t("barra.siguienteCartas"), paso: 2 },
    2: { texto: t("barra.siguienteEstilo"), paso: 3 },
    3: { texto: t("barra.siguientePedido"), paso: 4 },
    4: null,
  };
  const s = siguiente[pasoActual];
  const completo = cotizacion.faltan === 0;
  const bloqueado = pasoActual === 2 && mazo.cartas.length > 0 && !puedeAvanzar;
  const desactivado = s ? (s.paso === 2 ? mazo.cartas.length === 0 : s.paso >= 3 && !puedeAvanzar) : false;
  // En Pedido la oferta va en su propio bloque, con más detalle.
  const oferta = !bloqueado && pasoActual !== 4 ? ofertaPrincipal(cotizacion.ofertas) : null;
  return (
    <div
      ref={reservarAbajo}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-papel/97 shadow-[var(--shadow-flotante)] backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {bloqueado && (
          <Aviso
            tono="aviso"
            className="mt-2.5 !py-2"
            accion={
              <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => irASiguientePendiente(cartaActiva)}>
                {t("barra.irAPendiente")} →
              </Boton>
            }
          >
            <span id={idFaltan} className="font-semibold">
              {t("barra.faltanCartas", { n: pendientes.length })}
            </span>
          </Aviso>
        )}
        {/* La oferta se anuncia al aparecer o cambiar (con el total, que cambia con ella): la región
            viva está siempre montada y solo lleva el texto; la línea que se ve no se lee dos veces. */}
        <p role="status" className="sr-only">
          {oferta ? `${textoDe(oferta, cotizacion.moneda)} ${t("barra.total")}: ${formatearImporte(cotizacion.totalCents, cotizacion.moneda, locale)}.` : ""}
        </p>
        {oferta && (
          <div className="flex items-center gap-x-3 gap-y-1 border-b border-linea py-2 text-sm max-sm:flex-wrap" data-testid="oferta-barra">
            <p aria-hidden="true" className="flex min-w-0 flex-1 items-start gap-2">
              <IconoOferta tipo={oferta.tipo} />
              <span>{textoDe(oferta, cotizacion.moneda)}</span>
            </p>
            {oferta.tipo === "bajar" && (
              <Boton tamano="sm" variante="secundario" className="shrink-0 max-sm:min-h-11" onClick={() => despachar({ tipo: "cambiar", campo: "packId", valor: oferta.pack.id })}>
                {t("ofertas.cambiarA", { pack: textoEn(oferta.pack.nombre, locale) })}
              </Boton>
            )}
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:py-3">
          <button
            type="button"
            onClick={() => setDialogoPack(true)}
            aria-haspopup="dialog"
            className="col-start-1 row-start-1 -mx-1.5 inline-flex min-h-9 items-center gap-1 justify-self-start rounded-[8px] px-1.5 text-left text-sm font-semibold hover:bg-papel-2 max-sm:min-h-11"
          >
            <span className="truncate">{t("pack", { pack: textoEn(cotizacion.pack.nombre, locale) })}</span>
            <span className="sr-only"> · {t("packs.cambiar")}</span>
            <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className={`col-start-1 row-start-2 truncate text-sm ${completo ? "text-verde-texto" : "text-tinta-2"}`} aria-live="polite">
            {t(mazo.cartas.length > cotizacion.minimo ? "contadorCompleto" : "contador", { actual: mazo.cartas.length, minimo: cotizacion.minimo })}
            <span className="max-sm:hidden"> · </span>
            <span className="max-sm:sr-only">{completo ? `✓ ${t("barra.minimoCubierto")}` : t("barra.faltan", { n: cotizacion.faltan })}</span>
          </p>
          <p className="col-start-2 row-start-1 text-right sm:row-span-2 sm:row-start-1">
            <span className="tipo-micro mr-1.5 text-micro text-tinta-2 sm:mr-0 sm:block">{t("barra.total")}</span>
            <span className="tipo-titular text-lg leading-none sm:text-xl">{formatearImporte(cotizacion.totalCents, cotizacion.moneda, locale)}</span>
          </p>
          {s && (
            <Boton
              onClick={() => irAPaso(s.paso)}
              disabled={desactivado}
              aria-describedby={bloqueado ? idFaltan : undefined}
              className="col-start-2 row-start-2 max-sm:min-h-11 max-sm:px-4 sm:col-start-3 sm:row-span-2 sm:row-start-1"
            >
              {/* En el móvil se ve solo «Siguiente»; el nombre accesible sigue siendo el completo. */}
              <span aria-hidden="true" className="sm:hidden">
                {tc("siguiente")}
              </span>
              <span className="max-sm:sr-only">{s.texto}</span> →
            </Boton>
          )}
        </div>
      </div>
      <DialogoPack abierto={dialogoPack} alCerrar={() => setDialogoPack(false)} />
    </div>
  );
}
