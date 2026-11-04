"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CartaDeMuestra, MUESTRAS } from "@/components/carta/Muestra";

/** Carta de ejemplo que se da la vuelta al pulsarla. */
export function CartaVolteable({ idioma }: { idioma: string }) {
  const t = useTranslations();
  const [dorso, setDorso] = useState(false);
  const muestra = { ...MUESTRAS.menorca!, descripcion: t("inicio.muestras.menorca") };
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

/** Tres reversos que enseñan las tres precisiones de fecha. */
export function EjemplosPrecision({ idioma }: { idioma: string }) {
  const t = useTranslations("inicio");
  const base = MUESTRAS.excursion!;
  const ejemplos = [
    { ...base, foto: "/muestras/mar.jpg", fecha: { anio: 2019, mes: 8, dia: 14 }, descripcion: t("muestras.menorca"), paletaId: "rosa" },
    { ...base, fecha: { anio: 2015, mes: 5 }, descripcion: t("muestras.excursion") },
    { ...base, foto: "/muestras/jardin.jpg", fecha: { anio: 2008 }, descripcion: t("muestras.jardin"), paletaId: "amarillo" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-5">
      {ejemplos.map((e, i) => (
        <CartaDeMuestra key={i} muestra={e} cara="reverso" etiqueta={e.descripcion ?? ""} idiomaMazo={idioma} />
      ))}
    </div>
  );
}
