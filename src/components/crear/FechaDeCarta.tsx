"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Piezas";
import { aIso, precisionDe, type FechaCarta } from "@/domain/fechas/fecha";
import { fechaLegible } from "@/domain/fechas/formato";
import { useMazo } from "@/lib/mazo/contexto";
import type { Carta } from "@/lib/mazo/tipos";
import { SelectorFecha } from "./SelectorFecha";

/**
 * La fecha de la carta abierta en el paso 2, con foto o sin ella. Solo viene puesta cuando es
 * segura; si no, el campo está en blanco y aquí se explica por qué, con las fechas sugeridas para
 * usarlas con un toque. Escribirla a mano descarta las sugerencias.
 */
export function FechaDeCarta({ carta, hoy }: { carta: Carta; hoy: Date }) {
  const t = useTranslations("fechas");
  const locale = useLocale();
  const { despachar } = useMazo();
  const base = useId();
  const idTitulo = `${base}-titulo`;
  const idEstado = `${base}-estado`;
  const sugerencias = carta.fecha ? [] : (carta.sugerencias ?? []);
  // El motivo general (posible escaneo, reloj sin configurar…) solo si no lo explica ya una sugerencia.
  const motivo = !carta.fecha && carta.motivo && !sugerencias.some((s) => s.motivo === carta.motivo) ? carta.motivo : null;

  // Los cambios del selector no crean pasos de deshacer: el punto se marca al entrar en él, como
  // en la frase, para que «Deshacer» vuelva a la fecha de antes y no a cada tecla.
  const cambiar = (f: FechaCarta | null) =>
    despachar({
      tipo: "actualizarCarta",
      id: carta.id,
      deshacible: false,
      cambios: f
        ? { fecha: f, fuente: "manual", confianza: "alta", revisar: false, motivo: undefined, sugerencias: [] }
        : { fecha: null, fuente: null, confianza: null, revisar: false, motivo: undefined },
    });

  return (
    <section aria-labelledby={idTitulo} className="space-y-4 rounded-[var(--radius-carta)] bg-blanco p-5">
      <h2 id={idTitulo} className="tipo-subtitular text-lg">
        {t("titulo")}
      </h2>
      <SelectorFecha
        key={carta.id}
        idBase={`fecha-${carta.id}`}
        valor={carta.fecha}
        hoy={hoy}
        requerida
        alCambiar={cambiar}
        alEnfocar={() => despachar({ tipo: "puntoDeshacer" })}
        describidoPor={carta.fecha ? undefined : idEstado}
      />

      {carta.fecha ? (
        <>
          {carta.fuente && <p className="text-sm text-tinta-2">{t(`fuente.${carta.fuente}`)}</p>}
          {/* Solo en mazos guardados antes de que las fechas dudosas dejaran de rellenarse solas. */}
          {carta.revisar && (
            <Aviso
              tono="aviso"
              accion={
                <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11 max-sm:w-full" onClick={() => despachar({ tipo: "confirmarFecha", id: carta.id })}>
                  {t("confirmar")}
                </Boton>
              }
            >
              {carta.motivo ? t(`motivo.${carta.motivo}`) : t("fuente.archivo")}
            </Aviso>
          )}
        </>
      ) : (
        <>
          <Aviso tono="aviso">
            <span id={idEstado}>
              <span className="font-semibold">{t("vacia")}</span> {motivo && `${t(`motivo.${motivo}`)} `}
              {sugerencias.length > 0 ? t("eligeOEscribe", { n: sugerencias.length }) : t("escribela")}
            </span>
          </Aviso>
          {sugerencias.length > 0 && (
            <div className="space-y-2">
              <h3 className="tipo-micro text-micro text-tinta-2">{t("sugerenciasTitulo", { n: sugerencias.length })}</h3>
              <ul className="space-y-2">
                {sugerencias.map((s, i) => {
                  const idTexto = `${base}-sugerencia-${i}`;
                  return (
                    <li key={`${aIso(s.fecha)}-${s.fuente}`} className="flex flex-wrap items-center gap-3 rounded-[14px] border-2 border-dashed border-linea p-3 sm:flex-nowrap">
                      <div id={idTexto} className="min-w-0 flex-1">
                        <p className="font-semibold">{t("sugerencia", { precision: precisionDe(s.fecha), fecha: fechaLegible(s.fecha, locale) })}</p>
                        <p className="text-sm text-tinta-2">
                          <span className="font-semibold">{t(`origenSugerencia.${s.fuente}`)}.</span>
                          {s.motivo && ` ${t(`motivo.${s.motivo}`)}`}
                        </p>
                      </div>
                      <Boton
                        tamano="sm"
                        variante={i === 0 ? "primario" : "secundario"}
                        aria-describedby={idTexto}
                        className="shrink-0 max-sm:min-h-11 max-sm:w-full"
                        onClick={() => despachar({ tipo: "aceptarSugerencia", ids: [carta.id], indice: i })}
                      >
                        {t("usarSugerencia")}
                      </Boton>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
