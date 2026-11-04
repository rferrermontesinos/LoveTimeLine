"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CartaDeMuestra, useMuestra } from "@/components/carta/Muestra";
import { fechaLegible } from "@/domain/fechas/formato";

/** Carta de ejemplo que se da la vuelta al pulsarla. */
export function CartaVolteable({ idioma }: { idioma: string }) {
  const t = useTranslations();
  const muestra = useMuestra()("cita");
  const [dorso, setDorso] = useState(false);
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => setDorso((d) => !d)}
        aria-pressed={dorso}
        aria-label={`${t("inicio.voltear")}. ${dorso ? t("comun.reverso") : t("comun.anverso")}`}
        className="group relative w-[min(78vw,300px)] [perspective:1400px]"
      >
        <span
          className="relative block transition-transform duration-500 ease-[var(--ease-salida)] [transform-style:preserve-3d]"
          style={{ transform: dorso ? "rotateY(180deg)" : "none" }}
        >
          <span className="block [backface-visibility:hidden]">
            <CartaDeMuestra muestra={muestra} cara="anverso" etiqueta="" idiomaMazo={idioma} />
          </span>
          <span className="absolute inset-0 block [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CartaDeMuestra muestra={muestra} cara="reverso" etiqueta="" idiomaMazo={idioma} />
          </span>
        </span>
      </button>
      <p className="tipo-micro text-micro text-tinta-2" aria-live="polite">
        {dorso ? t("comun.reverso") : t("comun.anverso")} · {t("inicio.voltear")}
      </p>
    </div>
  );
}

/** Tres reversos que enseñan las tres precisiones de fecha: día, mes y solo año. */
export function EjemplosPrecision({ idioma }: { idioma: string }) {
  const muestra = useMuestra();
  const ejemplos = [muestra("boda"), muestra("montana"), muestra("picnic")];
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-5">
      {ejemplos.map((e, i) => (
        <CartaDeMuestra key={i} muestra={e} cara="reverso" etiqueta={`${e.descripcion ?? ""}: ${e.fecha ? fechaLegible(e.fecha, idioma) : ""}`} idiomaMazo={idioma} ligera />
      ))}
    </div>
  );
}
