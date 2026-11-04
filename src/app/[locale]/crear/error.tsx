"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSinConexion } from "@/components/crear/SinConexion";
import { Boton } from "@/components/ui/Boton";
import { Pestana } from "@/components/ui/Piezas";

/**
 * No ha llegado un trozo del código de la página (lo normal sin conexión, o justo después de
 * desplegar una versión nueva): volver a pintar no basta, hay que recargar la página.
 */
function esFalloDeCarga(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "ChunkLoadError" || /loading (css )?chunk|dynamically imported module|importing a module script/i.test(error.message);
}

/**
 * Si algo falla dentro del configurador. El mazo no se pierde: vive en el dispositivo
 * (IndexedDB) y se vuelve a abrir tal cual al reintentar.
 */
export default function ErrorCrear({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("crear.error");
  const sinConexion = useSinConexion();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const reintentar = () => (esFalloDeCarga(error) ? window.location.reload() : retry());

  return (
    <main id="contenido" className="mx-auto grid min-h-[80dvh] max-w-[1200px] place-items-center px-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-carta)] bg-tinta p-8 pt-28 text-papel shadow-[var(--shadow-carta)]">
        <Pestana tamano="lg">!</Pestana>
        <h1 className="tipo-titular text-4xl leading-[0.95]">{t("titulo")}</h1>
        <p className="mt-4 text-base leading-relaxed text-papel/85">{sinConexion ? t("sinConexion") : t("texto")}</p>
        <div className="mt-8">
          <Boton variante="acento" color="var(--color-rosa)" onClick={reintentar}>
            {t("reintentar")}
          </Boton>
        </div>
      </div>
    </main>
  );
}
