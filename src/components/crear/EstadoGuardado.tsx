"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Piezas";
import { useMazo } from "@/lib/mazo/contexto";
import { haceCuantoTexto, type EstadoGuardado } from "@/lib/mazo/guardado";

/** Cada cuánto se refresca «hace 1 min». */
const REFRESCO_MS = 20_000;

/** La hora, refrescada cada poco: para que «hace 1 min» avance solo. */
export function useAhora(cadaMs = REFRESCO_MS): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

/** Color del punto de la línea de estado. */
const PUNTO: Record<EstadoGuardado["tipo"], string> = {
  guardado: "bg-verde",
  guardando: "bg-tinta-2 motion-safe:animate-pulse",
  "sin-almacen": "bg-amarillo",
  conflicto: "bg-amarillo",
  "sin-espacio": "bg-rojo",
  error: "bg-rojo",
};

/**
 * La línea del pie del configurador: dónde y cuándo se ha guardado el mazo, o por qué no. El aviso
 * de arriba (`AvisoGuardado`) es el que avisa de los fallos; esta línea no habla sola.
 */
export function LineaGuardado() {
  const t = useTranslations("crear.guardado");
  const te = useTranslations("errores");
  const locale = useLocale();
  const { guardado } = useMazo();
  const ahora = useAhora();

  let texto: string;
  switch (guardado.tipo) {
    case "guardado":
      texto = t("guardado", { cuando: haceCuantoTexto(guardado.en, ahora, locale, t("ahoraMismo")) });
      break;
    case "guardando":
      texto = t("guardando");
      break;
    case "sin-almacen":
      texto = te("almacen");
      break;
    case "sin-espacio":
      texto = t("sinEspacio");
      break;
    case "error":
      texto = t("error");
      break;
    case "conflicto":
      texto = t("conflicto");
      break;
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid="estado-guardado" data-estado={guardado.tipo}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${PUNTO[guardado.tipo]}`} />
      {texto}
    </span>
  );
}

/**
 * Aviso arriba del configurador cuando lo último no se ha guardado: no cabe, ha fallado o el mazo
 * ha cambiado en otra pestaña. Con la acción para salir de ahí.
 */
export function AvisoGuardado() {
  const t = useTranslations("crear.guardado");
  const { guardado, guardarAhora, recargar } = useMazo();
  const [ocupado, setOcupado] = useState(false);

  const hacer = async (accion: () => Promise<void>) => {
    setOcupado(true);
    try {
      await accion();
    } finally {
      setOcupado(false);
    }
  };

  if (guardado.tipo === "sin-espacio" || guardado.tipo === "error") {
    return (
      <Aviso
        tono="error"
        accion={
          <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11 max-sm:w-full" disabled={ocupado} onClick={() => void hacer(() => guardarAhora())}>
            {t("reintentar")}
          </Boton>
        }
      >
        {t(guardado.tipo === "sin-espacio" ? "avisoSinEspacio" : "avisoError")}
      </Aviso>
    );
  }

  if (guardado.tipo === "conflicto") {
    return (
      <Aviso
        tono="aviso"
        accion={
          <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11 max-sm:w-full" disabled={ocupado} onClick={() => void hacer(recargar)}>
            {t(guardado.otroMazo ? "abrirOtro" : "cargarReciente")}
          </Boton>
        }
      >
        {t(guardado.otroMazo ? "avisoOtroMazo" : "avisoConflicto")}
      </Aviso>
    );
  }

  return null;
}
