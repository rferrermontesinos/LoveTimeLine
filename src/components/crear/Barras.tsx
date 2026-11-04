"use client";

import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
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

/** Los cuatro pasos como las casillas de la franja de meses. */
export function BarraPasos() {
  const t = useTranslations("crear.pasos");
  const { mazo } = useMazo();
  const { irAPaso } = useCrear();
  if (!mazo) return null;
  return (
    <nav aria-label={t("etiqueta")} className="sticky top-16 z-20 border-b border-linea bg-papel/95 backdrop-blur">
      <ol className="mx-auto flex max-w-[1200px] gap-1.5 px-4 py-2.5 sm:gap-2 sm:px-6">
        {PASOS.map(({ n, clave }) => {
          const actual = mazo.paso === n;
          const hecho = mazo.paso > n;
          return (
            <li key={n} className="flex-1">
              <button
                type="button"
                onClick={() => irAPaso(n)}
                aria-current={actual ? "step" : undefined}
                className={`group flex w-full flex-col gap-1.5 rounded-[10px] px-1 py-1 text-left hover:bg-papel-2`}
              >
                <span className={`block h-2 rounded-[3px] transition-colors ${actual ? "bg-tinta" : hecho ? "bg-rosa" : "bg-papel-3"}`} />
                <span className={`tipo-micro text-micro ${actual ? "text-tinta" : "text-tinta-2"}`}>
                  <span className="sr-only">{t("paso", { n })}: </span>
                  <span aria-hidden="true">{n} · </span>
                  {t(clave)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Barra inferior fija: cuántas fotos llevas frente al mínimo, total y siguiente paso. */
export function BarraAccion() {
  const t = useTranslations("crear");
  const locale = useLocale();
  const { mazo } = useMazo();
  const { cotizacion, irAPaso } = useCrear();
  if (!mazo || !cotizacion) return null;
  const siguiente: Record<number, { texto: string; paso: Paso } | null> = {
    1: { texto: t("barra.siguienteCartas"), paso: 2 },
    2: { texto: t("barra.siguienteEstilo"), paso: 3 },
    3: { texto: t("barra.siguientePedido"), paso: 4 },
    4: null,
  };
  const s = siguiente[mazo.paso];
  const completo = cotizacion.faltan === 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-papel/97 shadow-[var(--shadow-flotante)] backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            <span className="hidden sm:inline">{t("pack", { pack: textoEn(cotizacion.pack.nombre, locale) })} · </span>
            {t(mazo.cartas.length > cotizacion.minimo ? "contadorCompleto" : "contador", { actual: mazo.cartas.length, minimo: cotizacion.minimo })}
          </p>
          <p className={`text-sm ${completo ? "text-verde-texto" : "text-tinta-2"}`} aria-live="polite">
            {completo ? (cotizacion.huecosLibres > 0 ? t("huecos", { n: cotizacion.huecosLibres }) : `✓ ${t("barra.minimoCubierto")}`) : t("barra.faltan", { n: cotizacion.faltan })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="hidden text-right sm:block">
            <span className="tipo-micro block text-micro text-tinta-2">{t("barra.total")}</span>
            <span className="tipo-titular text-xl leading-none">{formatearImporte(cotizacion.totalCents, cotizacion.moneda, locale)}</span>
          </p>
          {s && (
            <Boton onClick={() => irAPaso(s.paso)} disabled={s.paso === 2 && mazo.cartas.length === 0}>
              {s.texto} →
            </Boton>
          )}
        </div>
      </div>
    </div>
  );
}
