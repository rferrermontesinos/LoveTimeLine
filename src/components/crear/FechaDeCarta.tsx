"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Piezas";
import { aIso, precisionDe, type FechaCarta } from "@/domain/fechas/fecha";
import { fechaLegible } from "@/domain/fechas/formato";
import { useMazo } from "@/lib/mazo/contexto";
import { esAproximada } from "@/lib/mazo/derivados";
import type { Carta, SugerenciaFecha } from "@/lib/mazo/tipos";
import { SelectorFecha } from "./SelectorFecha";

/**
 * La fecha de la carta abierta en el paso 2, con foto o sin ella, y de dónde sale. Si es
 * aproximada (solo en mazos guardados antes del 20-11-2026), lo dice. Si no se ha podido saber, el
 * campo está en blanco y aquí se explica por qué, con las fechas sugeridas para usarlas con un toque
 * (`alUsarSugerencia` avisa después de usarla). Escribirla a mano descarta las sugerencias.
 *
 * `hecho` confirma lo último que se ha hecho (la fecha puesta a la carta anterior y cuántas quedan):
 * va junto a las sugerencias, para que en el móvil se vea con lo siguiente que hay que decidir, con
 * una miniatura de la foto (`miniatura`), que allí queda más arriba.
 */
export function FechaDeCarta({
  carta,
  hoy,
  alUsarSugerencia,
  hecho,
  miniatura,
}: {
  carta: Carta;
  hoy: Date;
  alUsarSugerencia?: (s: SugerenciaFecha) => void;
  hecho?: string | null;
  miniatura?: string | null;
}) {
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
      {hecho && sugerencias.length === 0 && <Hecho texto={hecho} />}
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
          {esAproximada(carta) ? (
            <p className="text-sm text-tinta-2">
              <span aria-hidden="true" className="font-semibold text-tinta">
                ≈{" "}
              </span>
              {t("aproximada")}
            </p>
          ) : (
            carta.fuente && <p className="text-sm text-tinta-2">{t(`fuente.${carta.fuente}`)}</p>
          )}
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
            <div data-zona-sugerencias className="scroll-mt-36 scroll-mb-40 space-y-2">
              {hecho && <Hecho texto={hecho} />}
              <h3 className="tipo-micro text-micro text-tinta-2">{t("sugerenciasTitulo", { n: sugerencias.length })}</h3>
              <ul className="space-y-2">
                {sugerencias.map((s, i) => {
                  const idTexto = `${base}-sugerencia-${i}`;
                  return (
                    <li key={`${aIso(s.fecha)}-${s.fuente}`} data-sugerencia className="flex flex-wrap items-center gap-3 rounded-[14px] border-2 border-dashed border-linea p-3 sm:flex-nowrap">
                      {/* En el móvil la foto queda más arriba: una miniatura para decidir sin subir. */}
                      {miniatura && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={miniatura} alt="" className="h-16 w-16 shrink-0 rounded-[10px] object-cover sm:hidden" draggable={false} />
                      )}
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
                        onClick={() => {
                          despachar({ tipo: "aceptarSugerencia", ids: [carta.id], indice: i });
                          alUsarSugerencia?.(s);
                        }}
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

/** Confirmación de lo último hecho, en verde, que se anuncia al aparecer. */
function Hecho({ texto }: { texto: string }) {
  return (
    <p role="status" className="flex max-w-full items-start gap-2 rounded-[12px] bg-[#E3F4EA] px-3 py-2 text-sm font-semibold text-verde-texto">
      <span aria-hidden="true">✓</span>
      <span>{texto}</span>
    </p>
  );
}
