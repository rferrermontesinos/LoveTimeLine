"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { borradorDe, cambiarBorrador, estadoBorrador, type BorradorFecha } from "@/domain/fechas/borrador";
import type { FechaCarta, Precision } from "@/domain/fechas/fecha";
import { nombresMeses } from "@/domain/fechas/formato";

const claveDe = (f: FechaCarta | null) => (f ? `${f.anio}-${f.mes ?? ""}-${f.dia ?? ""}` : "");

/**
 * Fecha con precisión elegible. Emite una fecha solo si es válida y no futura; si el borrador
 * se queda a medias, no existe o es posterior a hoy, emite null: la carta queda sin fecha (y
 * pendiente) mientras el borrador conserva lo tecleado. Nunca corrige lo escrito: un 29 de
 * febrero de un año no bisiesto avisa de que no existe en vez de guardarse como otro día. En
 * blanco se ve en blanco: los marcadores son neutros («aaaa»), nunca un año que parezca puesto.
 */
export function SelectorFecha({
  valor,
  alCambiar,
  hoy,
  compacto = false,
  idBase,
  requerida = false,
  alEnfocar,
  describidoPor,
}: {
  valor: FechaCarta | null;
  alCambiar: (f: FechaCarta | null) => void;
  hoy: Date;
  compacto?: boolean;
  idBase?: string;
  /** Marca los campos como obligatorios para los lectores de pantalla. */
  requerida?: boolean;
  /** Al entrar en el selector (con el teclado o el puntero), antes de cambiar nada. */
  alEnfocar?: () => void;
  /** Id de un texto que explica el estado de la fecha (por ejemplo, por qué está en blanco). */
  describidoPor?: string;
}) {
  const t = useTranslations("fechas");
  const locale = useLocale();
  const generado = useId();
  const id = idBase ?? generado;
  const meses = useMemo(() => nombresMeses(locale), [locale]);
  const [b, setB] = useState<BorradorFecha>(() => borradorDe(valor, "dia"));

  // La última fecha que conoce el selector: la que recibió o la que acaba de emitir. Si la de
  // fuera cambia por otra cosa (otra carta, deshacer, una sugerencia aceptada…), se recarga el
  // borrador durante el render; lo que emite él mismo no borra lo que se está tecleando.
  const clave = claveDe(valor);
  const [claveVista, setClaveVista] = useState(clave);
  if (clave !== claveVista) {
    setClaveVista(clave);
    setB(borradorDe(valor, b.precision));
  }

  const actualizar = (cambios: Partial<BorradorFecha>) => {
    const nuevo = cambiarBorrador(b, cambios);
    setB(nuevo);
    const emitida = estadoBorrador(nuevo, hoy).fecha;
    const k = claveDe(emitida);
    if (k === claveVista) return;
    setClaveVista(k);
    alCambiar(emitida);
  };

  // Año puesto pero falta el mes o el día (aMedias): se explica cómo seguir sin inventar datos.
  const estado = estadoBorrador(b, hoy);
  const error = estado.error ? t(estado.error) : null;
  const aMedias = estado.aMedias;
  const idError = `${id}-error`;
  const precisiones: Precision[] = ["dia", "mes", "anio"];
  // En blanco se ve en blanco: el marcador va en texto normal y secundario; lo escrito, en negrita.
  const campo = "h-12 rounded-[12px] border-2 border-tinta bg-blanco px-3 text-base placeholder:font-normal placeholder:text-tinta-2 aria-[invalid=true]:border-rojo-texto";
  const comunes = {
    "aria-invalid": !!error,
    "aria-required": requerida || undefined,
    "aria-describedby": error || aMedias ? idError : undefined,
  };

  return (
    <fieldset className="space-y-3" onFocus={alEnfocar} onPointerDown={alEnfocar} aria-describedby={describidoPor}>
      <legend className={compacto ? "sr-only" : "mb-2 font-semibold"}>{t("precision")}</legend>
      <div role="radiogroup" aria-label={t("precision")} className="inline-flex flex-wrap gap-1 rounded-[14px] bg-papel-2 p-1">
        {precisiones.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={b.precision === p}
            onClick={() => actualizar({ precision: p })}
            className={`tipo-boton min-h-11 rounded-[10px] px-3 text-sm transition-colors ${b.precision === p ? "bg-tinta text-papel" : "hover:bg-papel-3"}`}
          >
            {t(p === "dia" ? "dia" : p === "mes" ? "mes" : "anio")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {b.precision === "dia" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="tipo-micro text-micro text-tinta-2">{t("campoDia")}</span>
            <input
              id={`${id}-dia`}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              placeholder={t("placeholderDia")}
              value={b.dia}
              onChange={(e) => actualizar({ dia: e.target.value })}
              className={`${campo} w-[4.5rem] font-semibold`}
              {...comunes}
            />
          </label>
        )}
        {b.precision !== "anio" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="tipo-micro text-micro text-tinta-2">{t("campoMes")}</span>
            <select
              id={`${id}-mes`}
              value={b.mes}
              onChange={(e) => actualizar({ mes: e.target.value })}
              className={`${campo} min-w-[9.5rem] capitalize [&>option]:font-normal [&>option]:text-tinta ${b.mes ? "font-semibold" : "text-tinta-2"}`}
              {...comunes}
            >
              <option value="">—</option>
              {meses.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="tipo-micro text-micro text-tinta-2">{t("campoAnio")}</span>
          <input
            id={`${id}-anio`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder={t("placeholderAnio")}
            value={b.anio}
            onChange={(e) => actualizar({ anio: e.target.value })}
            className={`${campo} w-[6.5rem] font-semibold`}
            {...comunes}
          />
        </label>
      </div>
      {error && (
        <p id={idError} role="alert" className="text-sm font-semibold text-rojo-texto">
          {error}
        </p>
      )}
      {aMedias && (
        <p id={idError} className="text-sm text-tinta-2">
          {t("incompleta", { precision: b.precision })}
        </p>
      )}
    </fieldset>
  );
}
