"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { VistaCarta } from "@/components/carta/VistaCarta";
import { fechaLegible } from "@/domain/fechas/formato";
import { agruparPorAnio } from "@/domain/mazo/ordenar";
import type { Carta, Mazo } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";

/**
 * El mazo como se jugará: las cartas por la cara de la fecha, ordenadas y agrupadas por año, y al
 * final, aparte, las que aún no tienen fecha. Lo usan Cartas (con la carta abierta resaltada y
 * las que faltan por completar marcadas) y Pedido.
 */
export function LineaDelMazo({
  mazo,
  activa = null,
  pendientes,
  alPulsar,
}: {
  mazo: Mazo;
  activa?: string | null;
  /** Ids de las cartas por completar: llevan un punto amarillo. */
  pendientes?: ReadonlySet<string>;
  alPulsar: (id: string) => void;
}) {
  const t = useTranslations("cartas.mazo");
  const { iconos, versiones } = useCrear();
  const grupos = useMemo(() => agruparPorAnio(mazo.cartas), [mazo.cartas]);
  return (
    <ol className="mesa flex flex-wrap items-start gap-x-4 gap-y-6 rounded-[24px] p-4 sm:p-6" data-testid="linea-del-mazo">
      {grupos.map((g) => (
        <li key={g.anio ?? "sin-fecha"} className={`min-w-0 max-w-full space-y-2 ${g.anio === null ? "basis-full" : ""}`}>
          <h3 className={`tipo-titular border-t-2 pt-1.5 text-lg leading-none ${g.anio === null ? "border-dashed border-rojo text-rojo-texto" : "border-tinta"}`}>
            {g.anio ?? t("sinFecha", { n: g.cartas.length })}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {g.cartas.map((c) => (
              <CartaDelMazo
                key={c.id}
                carta={c}
                mazo={mazo}
                icono={iconos.get(c.id) ?? null}
                version={versiones[c.id] ?? 0}
                activa={c.id === activa}
                pendiente={!!pendientes?.has(c.id)}
                alPulsar={() => alPulsar(c.id)}
              />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function CartaDelMazo({
  carta,
  mazo,
  icono,
  version,
  activa,
  pendiente,
  alPulsar,
}: {
  carta: Carta;
  mazo: Mazo;
  icono: string | null;
  version: number;
  activa: boolean;
  pendiente: boolean;
  alPulsar: () => void;
}) {
  const t = useTranslations("cartas");
  const locale = useLocale();
  const nombre = carta.tipo === "foto" ? carta.nombreArchivo : carta.descripcion.trim() || t("cartaSinFoto");
  const fecha = carta.fecha ? fechaLegible(carta.fecha, locale) : t("sinFechaCorta");
  return (
    <li className="w-[4.6rem] sm:w-[5.6rem]">
      <button
        type="button"
        onClick={alPulsar}
        aria-current={activa ? "true" : undefined}
        aria-label={t("mazo.carta", { nombre, fecha, estado: pendiente ? "pendiente" : "lista" })}
        className={`relative block w-full rounded-[10px] text-left transition-transform hover:-translate-y-0.5 ${activa ? "outline outline-[3px] outline-offset-2 outline-tinta" : ""}`}
      >
        <span aria-hidden="true" className="pointer-events-none block">
          <VistaCarta carta={carta} mazo={mazo} cara="reverso" icono={icono} version={version} />
        </span>
        {pendiente && <span aria-hidden="true" className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-amarillo shadow-[0_0_0_2px_var(--color-blanco)]" />}
      </button>
    </li>
  );
}
