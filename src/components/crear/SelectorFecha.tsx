"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { crearFecha, diasDelMes, esFutura, precisionDe, type FechaCarta, type Precision } from "@/domain/fechas/fecha";
import { nombresMeses } from "@/domain/fechas/formato";

interface Borrador {
  precision: Precision;
  dia: string;
  mes: string;
  anio: string;
}

function aBorrador(f: FechaCarta | null, precisionPorDefecto: Precision): Borrador {
  if (!f) return { precision: precisionPorDefecto, dia: "", mes: "", anio: "" };
  return { precision: precisionDe(f), dia: f.dia ? String(f.dia) : "", mes: f.mes ? String(f.mes) : "", anio: String(f.anio) };
}

function desdeBorrador(b: Borrador): FechaCarta | null {
  const anio = Number(b.anio);
  if (!/^\d{4}$/.test(b.anio)) return null;
  if (b.precision === "anio") return crearFecha(anio);
  const mes = Number(b.mes);
  if (!mes) return null;
  if (b.precision === "mes") return crearFecha(anio, mes);
  const dia = Number(b.dia);
  if (!dia) return null;
  return crearFecha(anio, mes, dia);
}

/**
 * Fecha con precisión elegible. Emite la fecha solo cuando es válida; mientras se escribe,
 * guarda el borrador para no perder lo tecleado.
 */
export function SelectorFecha({
  valor,
  alCambiar,
  hoy,
  compacto = false,
  idBase,
}: {
  valor: FechaCarta | null;
  alCambiar: (f: FechaCarta | null) => void;
  hoy: Date;
  compacto?: boolean;
  idBase?: string;
}) {
  const t = useTranslations("fechas");
  const locale = useLocale();
  const generado = useId();
  const id = idBase ?? generado;
  const meses = useMemo(() => nombresMeses(locale), [locale]);
  const [b, setB] = useState<Borrador>(() => aBorrador(valor, "dia"));

  // Si cambia la fecha desde fuera (otra carta, deshacer…), recargamos el borrador durante el render.
  const clave = valor ? `${valor.anio}-${valor.mes ?? ""}-${valor.dia ?? ""}` : "";
  const [claveAnterior, setClaveAnterior] = useState(clave);
  if (clave !== claveAnterior) {
    setClaveAnterior(clave);
    const f = desdeBorrador(b);
    const igual = f && valor && f.anio === valor.anio && f.mes === valor.mes && f.dia === valor.dia;
    if (!igual) setB(aBorrador(valor, b.precision));
  }

  const actualizar = (cambios: Partial<Borrador>) => {
    const nuevo = { ...b, ...cambios };
    if (nuevo.precision === "dia" && nuevo.mes && nuevo.anio && nuevo.dia) {
      const max = diasDelMes(Number(nuevo.anio) || 2000, Number(nuevo.mes));
      if (Number(nuevo.dia) > max) nuevo.dia = String(max);
    }
    setB(nuevo);
    const f = desdeBorrador(nuevo);
    if (f && !esFutura(f, hoy)) alCambiar(f);
    else if (!nuevo.anio) alCambiar(null);
  };

  const f = desdeBorrador(b);
  const error = b.anio.length === 4 && !f ? t("invalida") : f && esFutura(f, hoy) ? t("futura") : null;
  const precisiones: Precision[] = ["dia", "mes", "anio"];
  const campo = "h-12 rounded-[12px] border-2 border-tinta bg-blanco px-3 text-base font-semibold";

  return (
    <fieldset className="space-y-3">
      <legend className={compacto ? "sr-only" : "mb-2 font-semibold"}>{t("precision")}</legend>
      <div role="radiogroup" aria-label={t("precision")} className="inline-flex flex-wrap gap-1 rounded-[14px] bg-papel-2 p-1">
        {precisiones.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={b.precision === p}
            onClick={() => actualizar({ precision: p })}
            className={`tipo-boton min-h-10 rounded-[10px] px-3 text-sm transition-colors ${b.precision === p ? "bg-tinta text-papel" : "hover:bg-papel-3"}`}
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
              value={b.dia}
              onChange={(e) => actualizar({ dia: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              className={`${campo} w-[4.5rem]`}
              aria-invalid={!!error}
            />
          </label>
        )}
        {b.precision !== "anio" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="tipo-micro text-micro text-tinta-2">{t("campoMes")}</span>
            <select id={`${id}-mes`} value={b.mes} onChange={(e) => actualizar({ mes: e.target.value })} className={`${campo} min-w-[9.5rem] capitalize`}>
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
            placeholder={String(hoy.getFullYear())}
            value={b.anio}
            onChange={(e) => actualizar({ anio: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            className={`${campo} w-[6.5rem]`}
            aria-invalid={!!error}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-rojo-texto">
          {error}
        </p>
      )}
    </fieldset>
  );
}
