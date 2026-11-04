"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BotonEnlace } from "@/components/ui/Boton";
import { cargarMazo } from "@/lib/almacen/idb";
import { marcaCierre, resumenBorrador, tiempoRelativo, type ResumenBorrador } from "./borrador";

/** En sessionStorage: el aviso cerrado no vuelve en esta sesión, salvo que el mazo cambie. */
const CLAVE_CERRADO = "portada:aviso-borrador-cerrado";

function leerCerrado(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_CERRADO);
  } catch {
    return null;
  }
}

function guardarCerrado(marca: string) {
  try {
    window.sessionStorage.setItem(CLAVE_CERRADO, marca);
  } catch {
    /* sin almacenamiento de sesión: el aviso volverá al recargar */
  }
}

/**
 * «Continuar mi mazo»: si en este dispositivo hay un mazo guardado con cartas (o ya pedido), un
 * aviso fijo abajo lo recuerda con su título, sus cartas y cuándo se guardó. Sin mazo no pinta
 * nada. Va fijo, fuera del flujo de la página, para no mover nada al aparecer; el hueco del final
 * deja ver el pie entero con el aviso abierto. En el móvil es una barra baja (64 px como mucho)
 * para no tapar los packs del primer pantallazo.
 */
export function ContinuarMazo() {
  const t = useTranslations("inicio.borrador");
  const tc = useTranslations("comun");
  const idioma = useLocale();
  const [aviso, setAviso] = useState<{ resumen: ResumenBorrador; ahora: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    void cargarMazo().then((mazo) => {
      const resumen = resumenBorrador(mazo);
      if (!vivo || !resumen || leerCerrado() === marcaCierre(resumen)) return;
      setAviso({ resumen, ahora: Date.now() });
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!aviso) return null;
  const { resumen, ahora } = aviso;
  const cerrar = () => {
    guardarCerrado(marcaCierre(resumen));
    setAviso(null);
  };

  return (
    <>
      {/* Hueco al final de la página, del alto del aviso: con él abierto, el pie se puede ver entero. */}
      <div aria-hidden="true" className="h-16 bg-tinta sm:h-52" />
      <aside
        aria-label={t("etiqueta")}
        data-aviso-borrador
        className="fixed inset-x-0 bottom-0 z-40 [animation:aparecer_260ms_var(--ease-salida)_both] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem]"
      >
        {/* En el móvil, una barra baja pegada al borde (estado, título, «Continuar» y cerrar en una
            fila) para que los tres packs del primer pantallazo se sigan viendo enteros. Desde sm,
            la tarjeta flotante de la esquina, con las cartas y cuándo se guardó. */}
        <div className="relative flex items-center gap-2 rounded-t-[18px] bg-tinta pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-4 pr-1 pt-1 text-papel shadow-[var(--shadow-carta)] sm:block sm:rounded-[var(--radius-carta)] sm:p-5 sm:pr-14">
          <div className="min-w-0 flex-1">
            <p className="tipo-micro truncate text-micro text-amarillo">{resumen.pagado ? t("pedido") : t("aMedias")}</p>
            <h2 className="tipo-titular truncate text-[1.125rem] max-sm:leading-[1.15] sm:mt-1 sm:text-xl">{resumen.titulo || t("sinTitulo")}</h2>
            <p className="mt-0.5 text-sm text-papel/80 max-sm:sr-only">
              {tc("cartas", { n: resumen.cartas })} · {t("guardado", { cuando: tiempoRelativo(resumen.actualizadoEn, ahora, idioma, t("momento")) })}
            </p>
          </div>
          <BotonEnlace href="/crear" variante="acento" color="var(--color-rosa)" tamano="sm" className="min-h-11 shrink-0 sm:mt-3">
            {resumen.pagado ? (
              t("ver")
            ) : (
              <>
                {/* En el móvil se lee «Continuar»; el nombre accesible sigue siendo el completo. */}
                <span aria-hidden="true" className="sm:hidden">
                  {t("continuarCorto")}
                </span>
                <span className="max-sm:sr-only">{t("continuar")}</span>
              </>
            )}
            <span aria-hidden="true">→</span>
          </BotonEnlace>
          <button
            type="button"
            onClick={cerrar}
            aria-label={t("cerrar")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.6rem] leading-none text-papel/85 hover:bg-papel/10 hover:text-papel sm:absolute sm:right-1.5 sm:top-1.5"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </aside>
    </>
  );
}
