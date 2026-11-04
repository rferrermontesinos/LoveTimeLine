"use client";

import { useLocale, useTranslations } from "next-intl";
import { CartaDeMuestra, MUESTRAS } from "@/components/carta/Muestra";
import { Boton } from "@/components/ui/Boton";
import { Pestana } from "@/components/ui/Piezas";
import { formatearImporte } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { nuevoId } from "@/lib/importar/procesar";
import { useMazo } from "@/lib/mazo/contexto";
import type { Accion } from "@/lib/mazo/reductor";
import { useCrear } from "./contexto";

/** Acción para crear un mazo nuevo (fuera del componente: usa la hora y un id aleatorio). */
function accionCrear(packId: string, estiloId: string, idiomaMazo: string, mecanicas: string[], titulo: string): Accion {
  return { tipo: "crear", id: nuevoId(), ahora: Date.now(), packId, estiloId, idiomaMazo, mecanicas, titulo };
}

export function ElegirPack({ packInicial }: { packInicial?: string | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const { despachar } = useMazo();
  const { catalogo } = useCrear();
  const packs = catalogo.packs.filter((p) => p.activo).sort((a, b) => a.orden - b.orden);

  const empezar = (packId: string) => {
    const pack = packs.find((p) => p.id === packId)!;
    despachar(
      accionCrear(pack.id, pack.estiloPorDefecto, locale, catalogo.mecanicas.filter((m) => m.activo && m.porDefecto).map((m) => m.id), t("estilo.tituloPorDefecto")),
    );
  };

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
      <h1 className="tipo-titular text-[clamp(2.4rem,7vw,4rem)] leading-[0.92]">{t("crear.eligeTitulo")}</h1>
      <p className="mt-3 max-w-xl text-md text-tinta-2">{t("crear.eligeTexto")}</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {packs.map((p, i) => {
          const muestra = i === 0 ? { ...MUESTRAS.aniversario!, descripcion: t("inicio.muestras.aniversario") } : { ...MUESTRAS.excursion!, descripcion: t("inicio.muestras.excursion") };
          const destacado = packInicial === p.id;
          return (
            <article
              key={p.id}
              className={`relative flex flex-col overflow-hidden rounded-[var(--radius-carta)] bg-blanco p-6 pt-24 shadow-[var(--shadow-carta)] ${destacado ? "outline outline-4 outline-cobalto" : ""}`}
            >
              <Pestana tamano="lg" color={i === 0 ? "var(--color-rosa)" : "var(--color-verde)"}>
                {p.cartas}
              </Pestana>
              <div className="absolute right-6 top-6 w-[92px] rotate-6">
                <CartaDeMuestra muestra={muestra} cara="reverso" etiqueta="" idiomaMazo={locale} />
              </div>
              <h2 className="tipo-titular text-2xl">{textoEn(p.nombre, locale)}</h2>
              <p className="mt-1 max-w-[16rem] text-tinta-2">{textoEn(p.descripcion, locale)}</p>
              <p className="tipo-titular mt-6 text-[3.2rem] leading-none">{formatearImporte(p.precioCents, p.moneda, locale)}</p>
              <p className="mt-2 text-sm">{t("inicio.packCartas", { n: p.cartas })}</p>
              <p className="text-sm text-tinta-2">{t("inicio.packIncluye")}</p>
              <Boton className="mt-6 w-full" tamano="lg" onClick={() => empezar(p.id)} autoFocus={destacado}>
                {t("crear.eligeBoton", { pack: textoEn(p.nombre, locale) })}
              </Boton>
            </article>
          );
        })}
      </div>
    </div>
  );
}
