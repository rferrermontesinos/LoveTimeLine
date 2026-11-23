"use client";

import { useTranslations } from "next-intl";
import { CartaDeMuestra, MUESTRAS, useMuestra } from "@/components/carta/Muestra";
import { fechaLegible } from "@/domain/fechas/formato";

/** Tres cartas en abanico sobre la mesa, repartidas con una animación corta: una por la cara de la fecha y dos por la de la foto. */
export function Abanico({ idioma }: { idioma: string }) {
  const t = useTranslations("inicio");
  const muestra = useMuestra();
  const cartas = [
    { muestra: muestra("tren"), cara: "reverso" as const, giro: -11, x: "-58%", y: "6%", retraso: 0 },
    { muestra: muestra("playa"), cara: "anverso" as const, giro: 1, x: "0%", y: "-4%", retraso: 120 },
    { muestra: muestra("casa"), cara: "anverso" as const, giro: 11, x: "58%", y: "8%", retraso: 240 },
  ];
  return (
    <div role="img" aria-label={t("abanicoAlt", { fecha: fechaLegible(MUESTRAS.tren.fecha, idioma) })} className="relative mx-auto aspect-[1.15/1] w-full max-w-[520px]">
      {cartas.map((c, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 w-[38%] [animation:repartir_700ms_var(--ease-salida)_both]"
          style={{
            transform: `translate(-50%, -50%) translate(${c.x}, ${c.y}) rotate(${c.giro}deg)`,
            animationDelay: `${c.retraso}ms`,
            zIndex: i === 1 ? 2 : 1,
          }}
        >
          <CartaDeMuestra muestra={c.muestra} cara={c.cara} etiqueta="" idiomaMazo={idioma} ligera />
        </div>
      ))}
    </div>
  );
}
