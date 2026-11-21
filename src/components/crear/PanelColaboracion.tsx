"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton, clasesBoton } from "@/components/ui/Boton";
import { Aviso, Pestana } from "@/components/ui/Piezas";
import { ErrorServicio, type AportacionEnEspera, type ClienteColaboracion } from "@/lib/colaboracion/api";
import { cerrarEnlace, clienteConfigurado, crearEnlace, ErrorLlave, leerEnlace, olvidarEnlace, type EnlaceDueno } from "@/lib/colaboracion/dueno";
import { urlParaCompartir } from "@/lib/colaboracion/enlace";
import { abrirAportacion, esInservible } from "@/lib/colaboracion/recibir";
import { useImportacion, type EntradaImportacion } from "./importacion";

/** Cada cuánto se mira si han llegado fotos, mientras la página se ve. */
const CADA_MS = 30_000;

type Estado =
  | { tipo: "cargando" }
  /** `inactivo`: había un enlace y ya no está (caducó o se cerró en otra pestaña). */
  | { tipo: "sin-enlace"; mazoId: string; inactivo?: boolean }
  /** `espera`: lo que ha llegado (null: aún no se ha mirado). `caducado`: ya no admite fotos nuevas. */
  | { tipo: "activo"; mazoId: string; enlace: EnlaceDueno; espera: AportacionEnEspera[] | null; caducaEn: number; caducado: boolean };

type ErrorPanel = "red" | "ocupado" | "llave";

/** Una sola pestaña recoge a la vez, si el navegador sabe de cerrojos. Las demás no hacen nada. */
async function conCerrojo(nombre: string, f: () => Promise<void>): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.locks) return f();
  await navigator.locks.request(nombre, { ifAvailable: true }, async (cerrojo) => {
    if (cerrojo) await f();
  });
}

/** Las fotos que han llegado, como entradas de la importación: se descifran y comprueban aquí. */
function entradasDe(cliente: ClienteColaboracion, enlace: EnlaceDueno, espera: AportacionEnEspera[]): EntradaImportacion[] {
  return [...espera]
    .sort((a, b) => a.recibidaEn - b.recibidaEn || a.id.localeCompare(b.id))
    .map((a) => ({
      hoy: new Date(a.recibidaEn),
      leer: async () => {
        let paquete: Uint8Array;
        try {
          paquete = await cliente.descargar(enlace.id, a.id, enlace.token);
        } catch (e) {
          // Ya no está: la ha recogido otra pestaña.
          if (e instanceof ErrorServicio && e.estado === 404) return null;
          throw e;
        }
        try {
          const r = await abrirAportacion(paquete, enlace.llaves, enlace.id);
          return { foto: r.foto, grupo: `lote:${r.lote}`, autor: r.autor };
        } catch (e) {
          // Un paquete que nunca se podrá abrir no se guarda más.
          if (esInservible(e)) await cliente.quitar(enlace.id, a.id, enlace.token).catch(() => undefined);
          throw e;
        }
      },
      // Ya en el mazo guardado: fuera del servicio.
      alGuardar: () => cliente.quitar(enlace.id, a.id, enlace.token),
    }));
}

/**
 * Pedir fotos con un enlace (subida colaborativa): crearlo, compartirlo, ver lo que llega y
 * añadirlo al mazo. Solo se muestra si la web tiene el servicio configurado. Pendiente de Marc.
 */
export function PanelColaboracion({ mazoId }: { mazoId: string }) {
  const t = useTranslations("colaboracion.panel");
  const locale = useLocale();
  const id = useId();
  const cliente = useMemo(() => clienteConfigurado(), []);
  const { importarEntradas, puedeElegir, progreso } = useImportacion();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [ocupado, setOcupado] = useState<"creando" | "recibiendo" | "cerrando" | null>(null);
  const [error, setError] = useState<ErrorPanel | null>(null);
  const [sinRed, setSinRed] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // El estado de otro mazo (tras empezar otro) no vale: se lee el del nuevo.
  const actual = estado.tipo !== "cargando" && estado.mazoId === mazoId ? estado : null;

  useEffect(() => {
    let vivo = true;
    void leerEnlace(mazoId).then((enlace) => {
      if (!vivo) return;
      setEstado(
        enlace
          ? { tipo: "activo", mazoId, enlace, espera: null, caducaEn: enlace.caducaEn, caducado: enlace.caducaEn <= Date.now() }
          : { tipo: "sin-enlace", mazoId },
      );
    });
    return () => {
      vivo = false;
    };
  }, [mazoId]);

  /** Mira qué ha llegado. Si el enlace caducó y no queda nada por recoger, se cierra del todo. */
  const actualizar = useCallback(
    async (enlace: EnlaceDueno) => {
      if (!cliente) return;
      // Solo si sigue siendo el enlace que se ve (no uno cerrado o cambiado mientras tanto).
      const siSigue = (siguiente: (e: Extract<Estado, { tipo: "activo" }>) => Estado) =>
        setEstado((e) => (e.tipo === "activo" && e.enlace === enlace ? siguiente(e) : e));
      const inactivo: Estado = { tipo: "sin-enlace", mazoId: enlace.mazoId, inactivo: true };
      try {
        const { caducaEn, aportaciones } = await cliente.listar(enlace.id, enlace.token);
        setSinRed(false);
        const caducado = caducaEn <= Date.now();
        if (caducado && aportaciones.length === 0) {
          await cerrarEnlace(cliente, enlace).catch(() => undefined);
          siSigue(() => inactivo);
          return;
        }
        siSigue((e) => ({ ...e, espera: aportaciones, caducaEn, caducado }));
      } catch (e) {
        if (e instanceof ErrorServicio && (e.estado === 404 || e.estado === 403)) {
          await olvidarEnlace(enlace.mazoId);
          siSigue(() => inactivo);
        } else setSinRed(true);
      }
    },
    [cliente],
  );

  // Mientras la página se ve, se mira cada poco; al volver a ella, enseguida.
  const enlace = actual?.tipo === "activo" ? actual.enlace : null;
  useEffect(() => {
    if (!enlace) return;
    let temporizador: number | undefined;
    const mirar = () => {
      window.clearTimeout(temporizador);
      if (document.visibilityState === "visible") void actualizar(enlace);
      temporizador = window.setTimeout(mirar, CADA_MS);
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") mirar();
    };
    mirar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [enlace, actualizar]);

  if (!cliente || !actual) return null;

  const crear = async () => {
    setOcupado("creando");
    setError(null);
    try {
      const nuevo = await crearEnlace(cliente, mazoId, Date.now());
      setEstado({ tipo: "activo", mazoId, enlace: nuevo, espera: [], caducaEn: nuevo.caducaEn, caducado: false });
    } catch (e) {
      setError(e instanceof ErrorLlave ? "llave" : e instanceof ErrorServicio && e.estado === 503 ? "ocupado" : "red");
    } finally {
      setOcupado(null);
    }
  };

  const recibir = async () => {
    if (actual.tipo !== "activo" || !actual.espera?.length || !puedeElegir()) return;
    const { enlace: e, espera } = actual;
    setOcupado("recibiendo");
    try {
      await conCerrojo(`colaboracion:${mazoId}`, () => importarEntradas(entradasDe(cliente, e, espera)));
    } finally {
      setOcupado(null);
      await actualizar(e);
    }
  };

  const cerrar = async () => {
    if (actual.tipo !== "activo") return;
    const n = actual.espera?.length ?? 0;
    if (!window.confirm(n ? t("cerrarConFotos", { n }) : t("cerrarConfirmar"))) return;
    setOcupado("cerrando");
    setError(null);
    try {
      await cerrarEnlace(cliente, actual.enlace);
      setEstado({ tipo: "sin-enlace", mazoId });
    } catch {
      setError("red");
    } finally {
      setOcupado(null);
    }
  };

  const textoError = error && (
    <Aviso tono="error" className="mt-4">
      {t(error === "llave" ? "errorLlave" : error === "ocupado" ? "errorOcupado" : "errorRed")}
    </Aviso>
  );

  let cuerpo;
  if (actual.tipo === "sin-enlace") {
    cuerpo = (
      <>
        {actual.inactivo && <p className="mt-3 font-semibold">{t("inactivo")}</p>}
        <Boton className="mt-4" onClick={() => void crear()} disabled={ocupado === "creando"} data-testid="crear-enlace">
          {ocupado === "creando" ? t("creando") : t("crear")}
        </Boton>
        {textoError}
      </>
    );
  } else {
    const url = urlParaCompartir(typeof window === "undefined" ? "" : window.location.origin, locale, actual.enlace);
    const mensaje = `${t("mensaje")} ${url}`;
    const n = actual.espera?.length ?? 0;
    const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.share === "function";
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 2500);
      } catch {
        // Sin portapapeles: se selecciona para copiarlo a mano.
        campo.current?.select();
      }
    };
    cuerpo = (
      <>
        {/* Lo que ha llegado: lo primero que se ve al volver. */}
        {n > 0 ? (
          <div data-testid="fotos-llegadas" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#FFF4D6] px-4 py-3 shadow-[inset_4px_0_0_var(--color-amarillo)]">
            <p className="font-semibold">{t("llegadas", { n })}</p>
            <Boton onClick={() => void recibir()} disabled={ocupado === "recibiendo" || !!progreso} data-testid="anadir-llegadas">
              {ocupado === "recibiendo" ? t("anadiendo") : t("anadir")}
            </Boton>
          </div>
        ) : (
          <p className="mt-3 text-sm text-tinta-2" aria-live="polite">
            {actual.espera === null ? (
              t("mirando")
            ) : (
              <>
                {t("ninguna")}{" "}
                <button type="button" className="enlace font-semibold" onClick={() => void actualizar(actual.enlace)}>
                  {t("mirarAhora")}
                </button>
              </>
            )}
          </p>
        )}
        {sinRed && (
          <Aviso tono="aviso" className="mt-3">
            {t("sinRed")}
          </Aviso>
        )}

        {actual.caducado ? (
          <p className="mt-4 text-sm font-semibold">{t("yaNoAdmite")}</p>
        ) : (
          <div className="mt-5 space-y-3">
            <label htmlFor={`${id}-url`} className="block text-sm font-semibold">
              {t("etiquetaEnlace")}
            </label>
            <input
              ref={campo}
              id={`${id}-url`}
              data-testid="enlace-colaboracion"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-[var(--radius-control)] border-2 border-linea bg-papel px-3 py-2.5 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className={clasesBoton("primario", "sm")}>
                {t("whatsapp")}
              </a>
              <Boton variante="secundario" tamano="sm" onClick={() => void copiar()} aria-live="polite">
                {copiado ? `✓ ${t("copiado")}` : t("copiar")}
              </Boton>
              {puedeCompartir && (
                <Boton variante="fantasma" tamano="sm" onClick={() => void navigator.share({ title: t("compartirTitulo"), text: t("mensaje"), url }).catch(() => undefined)}>
                  {t("compartir")}
                </Boton>
              )}
            </div>
            <p className="text-sm text-tinta-2">
              {t("valeHasta", { fecha: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(actual.caducaEn) })}{" "}
              <button type="button" className="enlace font-semibold" onClick={() => void cerrar()} disabled={ocupado === "cerrando"}>
                {ocupado === "cerrando" ? t("cerrando") : t("cerrar")}
              </button>
            </p>
          </div>
        )}
        {textoError}
      </>
    );
  }

  return (
    <section aria-labelledby={`${id}-titulo`} data-testid="panel-colaboracion" className="relative overflow-hidden rounded-[var(--radius-carta)] bg-blanco p-6 pl-16 pt-8 sm:p-8 sm:pl-20">
      <Pestana color="var(--color-verde)">+</Pestana>
      <h2 id={`${id}-titulo`} className="tipo-subtitular text-xl">
        {t("titulo")}
      </h2>
      <p className="mt-1 max-w-2xl text-tinta-2">{t("texto")}</p>
      {cuerpo}
      <p className="mt-4 text-sm text-tinta-2">{t("privacidad")}</p>
    </section>
  );
}
