"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Piezas";
import { formatearImporte } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { useMazo } from "@/lib/mazo/contexto";
import type { Paso } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";

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
 * Barra inferior fija: cuántas fotos llevas frente al mínimo, total y siguiente paso. En el paso
 * de cartas, si falta alguna por completar, «Siguiente: estilo» se desactiva y la barra dice
 * cuántas faltan, con un botón para ir a la siguiente.
 */
export function BarraAccion() {
  const t = useTranslations("crear");
  const locale = useLocale();
  const { mazo } = useMazo();
  const { cotizacion, irAPaso, pasoActual, pendientes, puedeAvanzar, cartaActiva, irASiguientePendiente } = useCrear();
  const idFaltan = useId();
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
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-papel/97 shadow-[var(--shadow-flotante)] backdrop-blur pb-[env(safe-area-inset-bottom)]">
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
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              <span className="hidden sm:inline">{t("pack", { pack: textoEn(cotizacion.pack.nombre, locale) })} · </span>
              {t(mazo.cartas.length > cotizacion.minimo ? "contadorCompleto" : "contador", { actual: mazo.cartas.length, minimo: cotizacion.minimo })}
            </p>
            <p className={`text-sm ${completo ? "text-verde-texto" : "text-tinta-2"}`} aria-live="polite">
              {completo ? `✓ ${t("barra.minimoCubierto")}` : t("barra.faltan", { n: cotizacion.faltan })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="hidden text-right sm:block">
              <span className="tipo-micro block text-micro text-tinta-2">{t("barra.total")}</span>
              <span className="tipo-titular text-xl leading-none">{formatearImporte(cotizacion.totalCents, cotizacion.moneda, locale)}</span>
            </p>
            {s && (
              <Boton onClick={() => irAPaso(s.paso)} disabled={desactivado} aria-describedby={bloqueado ? idFaltan : undefined}>
                {s.texto} →
              </Boton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
