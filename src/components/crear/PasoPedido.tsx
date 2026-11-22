"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRINT } from "@config/print";
import { VistaCaja } from "@/components/carta/VistaCaja";
import { Boton } from "@/components/ui/Boton";
import { Aviso, Interruptor } from "@/components/ui/Piezas";
import { GRAVEDAD, validarMazo, type Aviso as AvisoMazo } from "@/domain/mazo/validar";
import { baseMazo, formatearImporte, precioDeExtra, type LineaCotizacion } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { useRouter } from "@/i18n/navigation";
import { useMazo } from "@/lib/mazo/contexto";
import { claveFotoCaja, esCajaPersonalizada, extraCajaPersonalizada, fotoCaja, paraValidar, pppFotoCaja, proporcionCaja } from "@/lib/mazo/derivados";
import { esFoto, esTexto } from "@/lib/mazo/tipos";
import type { Pedido } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";
import { useImportacion } from "./importacion";
import { LineaDelMazo } from "./LineaDelMazo";
import { OfertasPedido } from "./Ofertas";
import { OpcionesPack } from "./SelectorPack";
import { useSinConexion } from "./SinConexion";

interface RespuestaCheckout {
  modo: "simulado" | "stripe";
  pedidoId: string;
  totalCents: number;
  moneda: string;
  cartasFisicas: number;
  url?: string;
  sessionId?: string;
}

/** Paso 4: la línea del tiempo ordenada, las comprobaciones, el pack y sus ofertas, los extras y el pago. */
export function PasoPedido() {
  const t = useTranslations("pedido");
  const tc = useTranslations("comun");
  const tr = useTranslations("crear.recuerdo");
  const tg = useTranslations("crear.guardado");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const { mazo, despachar, guardarAhora, guardado } = useMazo();
  const { catalogo, cotizacion, irAPaso, versiones, abrirRecuerdo, pendientes, todasListas } = useCrear();
  const hoy = useMemo(() => new Date(), []);
  const [revisado, setRevisado] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinConexion = useSinConexion();
  // Mientras entran fotos, el mazo cambia: se paga el que queda cuando acaban (el que se guarda e imprime).
  const { importando } = useImportacion();

  const validacion = useMemo(() => {
    if (!mazo || !cotizacion) return null;
    // La foto de la caja personalizada, si la lleva: con poca resolución se pide confirmación, como en las cartas.
    const deCaja = esCajaPersonalizada(mazo, catalogo) ? fotoCaja(mazo) : null;
    return validarMazo({
      cartas: mazo.cartas.map(paraValidar),
      minimo: cotizacion.minimo,
      maximo: catalogo.ampliacion.maxCartas,
      hoy,
      pppMinimo: PRINT.pppMinimo,
      cajaSinFoto: esCajaPersonalizada(mazo, catalogo) && !deCaja,
      pppCajaSinConfirmar: deCaja && mazo.cajaBajaConfirmada !== claveFotoCaja(deCaja) ? pppFotoCaja(deCaja, proporcionCaja(mazo)) : null,
    });
  }, [mazo, cotizacion, catalogo, hoy]);
  const sinCompletar = useMemo(() => new Set(pendientes), [pendientes]);

  if (!mazo || !cotizacion || !validacion) return null;

  const dinero = (cents: number) => formatearImporte(cents, cotizacion.moneda, locale);
  const bloqueantes = validacion.avisos.filter((a) => GRAVEDAD[a.tipo] === "bloquea");
  // Se puede llegar aquí con cartas por completar, pero no pagar.
  const puedePagar = validacion.puedePagar && cotizacion.sePuedePagar && todasListas;
  // Sin conexión no se llega a Stripe; con el mazo cambiado en otra pestaña, esta no puede guardar el pedido.
  const enConflicto = guardado.tipo === "conflicto";
  // Un mazo ya pagado no se vuelve a pagar: el pedido nuevo taparía el pagado (y, si se cancelara
  // en Stripe, se perdería el aviso de que este mazo ya está pedido).
  const yaPagado = mazo.pedido?.estado === "pagado";
  const extras = catalogo.extras.filter((x) => x.activo).sort((a, b) => a.orden - b.orden);
  const base = baseMazo(cotizacion);
  const idCaja = extraCajaPersonalizada(catalogo)?.id ?? null;
  const caja = fotoCaja(mazo);

  const etiquetaLinea = (l: LineaCotizacion): string => {
    switch (l.tipo) {
      case "pack":
        return t("linea.pack", { pack: textoEn(cotizacion.packAplicado.nombre, locale), n: cotizacion.packAplicado.cartas });
      case "cartas-extra":
        return t("linea.cartasExtra", { n: l.cantidad, precio: dinero(cotizacion.precioCartaExtraCents) });
      case "caja":
        return t("linea.caja", { n: l.cantidad });
      case "envio":
        return t("linea.envio");
      case "mecanica": {
        const m = catalogo.mecanicas.find((x) => x.id === l.id);
        return m ? textoEn(m.nombre, locale) : l.id;
      }
      case "extra": {
        const x = catalogo.extras.find((e) => e.id === l.id);
        return x ? textoEn(x.nombre, locale) : l.id;
      }
    }
  };

  const textoAviso = (a: AvisoMazo): string => {
    switch (a.tipo) {
      case "faltan-cartas":
        return t("avisos.faltan-cartas", { n: a.faltan, minimo: a.minimo });
      case "excede-maximo":
        return t("avisos.excede-maximo", { max: a.maximo });
      case "fechas-duplicadas":
        return t("avisos.fechas-duplicadas", { n: a.grupos.length });
      case "fotos-duplicadas":
        return t("avisos.fotos-duplicadas", { n: a.grupos.reduce((s, g) => s + g.length - 1, 0) });
      case "caja-sin-foto":
        return t("avisos.caja-sin-foto");
      case "caja-baja-resolucion":
        return t("avisos.caja-baja-resolucion", { ppp: a.ppp });
      default:
        return t(`avisos.${a.tipo}`, { n: a.cartas.length });
    }
  };

  const primeraCarta = (a: AvisoMazo): string | null => {
    if ("cartas" in a) return a.cartas[0] ?? null;
    if (a.tipo === "fechas-duplicadas") return a.grupos[0]?.cartas[0] ?? null;
    if (a.tipo === "fotos-duplicadas") return a.grupos[0]?.[1] ?? null;
    return null;
  };

  const accionAviso = (a: AvisoMazo) => {
    if (a.tipo === "faltan-cartas")
      return (
        <div className="flex flex-wrap gap-2">
          <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => irAPaso(1)}>
            {t("anadirFotos")}
          </Boton>
          <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => abrirRecuerdo()}>
            {tr("boton")}
          </Boton>
        </div>
      );
    if (a.tipo === "caja-sin-foto")
      return (
        <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => irAPaso(3, undefined, "caja")}>
          {t("elegirFotoCaja")}
        </Boton>
      );
    if (a.tipo === "caja-baja-resolucion")
      return (
        <div className="flex flex-wrap gap-2">
          <Boton
            tamano="sm"
            variante="secundario"
            className="max-sm:min-h-11"
            onClick={() => {
              const deCaja = fotoCaja(mazo);
              if (deCaja) despachar({ tipo: "confirmarCajaBaja", clave: claveFotoCaja(deCaja) });
            }}
          >
            {t("confirmarBaja")}
          </Boton>
          <Boton tamano="sm" variante="fantasma" className="max-sm:min-h-11" onClick={() => irAPaso(3, undefined, "caja")}>
            {t("cambiarFotoCaja")}
          </Boton>
        </div>
      );
    const carta = primeraCarta(a);
    return (
      <div className="flex flex-wrap gap-2">
        {a.tipo === "baja-resolucion" && (
          <Boton tamano="sm" variante="secundario" onClick={() => despachar({ tipo: "actualizarCartas", ids: a.cartas, cambios: { pppConfirmado: true } })}>
            {t("confirmarBaja")}
          </Boton>
        )}
        {carta && (
          <Boton tamano="sm" variante="fantasma" onClick={() => irAPaso(2, carta)}>
            {t("irACarta")}
          </Boton>
        )}
      </div>
    );
  };

  const pagar = async () => {
    if (mazo.pedido?.estado === "pagado" || importando) return;
    setPagando(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mazoId: mazo.id,
          packId: mazo.packId,
          cartasFoto: mazo.cartas.filter(esFoto).length,
          cartasTexto: mazo.cartas.filter(esTexto).length,
          extras: mazo.extras,
          mecanicas: mazo.mecanicas,
          idioma: locale,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as RespuestaCheckout;
      const pedido: Pedido = {
        id: r.pedidoId,
        modo: r.modo,
        estado: "pendiente",
        totalCents: r.totalCents,
        moneda: r.moneda,
        cartasFisicas: r.cartasFisicas,
        fecha: Date.now(),
        stripeSessionId: r.sessionId,
      };
      // El simulado ya está pagado, pero solo cuenta como pagado aquí si queda guardado.
      const simulado = r.modo === "simulado";
      despachar({ tipo: "registrarPedido", pedido });
      // Sin el pedido en el dispositivo (sin espacio, otra pestaña), al volver del pago no se
      // sabría qué mazo es: no se sigue, el mazo se queda sin pedido y el aviso del guardado dice por qué.
      if (!(await guardarAhora({ ...mazo, pedido: simulado ? { ...pedido, estado: "pagado" } : pedido, actualizadoEn: Date.now() }))) {
        despachar({ tipo: "cancelarPedido" });
        throw new Error("Pedido sin guardar");
      }
      if (simulado) despachar({ tipo: "pedidoPagado" });
      if (r.modo === "stripe" && r.url) {
        window.location.assign(r.url);
        return;
      }
      router.push("/pedido/confirmado");
    } catch {
      setError(t("errorPago"));
      setPagando(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="tipo-titular text-[clamp(2.2rem,6vw,3.4rem)] leading-[0.95]">{t("titulo")}</h1>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-10">
          {/* Línea del tiempo */}
          <section aria-labelledby={`${id}-linea`} className="space-y-3">
            <div>
              <h2 id={`${id}-linea`} className="tipo-subtitular text-xl">
                {t("lineaTemporal")}
              </h2>
              <p className="mt-1 text-sm text-tinta-2">{t("lineaTemporalAyuda")}</p>
            </div>
            <LineaDelMazo mazo={mazo} pendientes={sinCompletar} alPulsar={(cartaId) => irAPaso(2, cartaId)} />
          </section>

          {/* Comprobaciones */}
          <section aria-labelledby={`${id}-comprobaciones`} className="space-y-3">
            <h2 id={`${id}-comprobaciones`} className="tipo-subtitular text-xl">
              {t("comprobaciones")}
            </h2>
            {validacion.avisos.length === 0 ? (
              <Aviso tono="exito">✓ {t("todoBien")}</Aviso>
            ) : (
              <ul className="space-y-2">
                {validacion.avisos.map((a) => {
                  const g = GRAVEDAD[a.tipo];
                  return (
                    <li key={a.tipo}>
                      <Aviso tono={g === "bloquea" ? "error" : g === "confirmar" ? "aviso" : "info"} accion={accionAviso(a)}>
                        {textoAviso(a)}
                      </Aviso>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* El pack, para cambiarlo aquí mismo, y sus ofertas */}
          <section aria-labelledby={`${id}-pack`} className="space-y-3">
            <div>
              <h2 id={`${id}-pack`} className="tipo-subtitular text-xl">
                {t("pack.titulo")}
              </h2>
              <p className="mt-1 text-sm text-tinta-2">{t("pack.ayuda")}</p>
            </div>
            <OpcionesPack />
            <OfertasPedido />
          </section>

          {/* Extras de pago */}
          <section aria-labelledby={`${id}-extras`} className="space-y-3">
            <h2 id={`${id}-extras`} className="tipo-subtitular text-xl">
              {t("extras")}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {extras.map((x) => {
                const activo = mazo.extras.includes(x.id);
                return (
                  <li key={x.id} className={`rounded-[14px] border-2 bg-blanco p-4 transition-colors ${activo ? "border-tinta" : "border-transparent"}`}>
                    <Interruptor
                      id={`${id}-extra-${x.id}`}
                      alFinal
                      activo={activo}
                      alCambiar={(v) => despachar({ tipo: "cambiar", campo: "extras", valor: v ? [...mazo.extras, x.id] : mazo.extras.filter((e) => e !== x.id) })}
                      etiqueta={
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span>{textoEn(x.nombre, locale)}</span>
                          <span className="tabular-nums text-tinta-2">+{dinero(precioDeExtra(x, base))}</span>
                        </span>
                      }
                      descripcion={textoEn(x.descripcion, locale)}
                    />
                    {activo && x.id === idCaja && (
                      <div className="mt-3 flex items-center gap-3 border-t border-linea pt-3">
                        <VistaCaja mazo={mazo} catalogo={catalogo} cara="anverso" variante="personalizada" etiquetas={null} version={caja ? (versiones[caja.id] ?? 0) : 0} ancho={52} className="shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-sm">
                            <span className="font-semibold">{t("fotoCaja")}</span>
                            {!caja && <span className="block text-tinta-2">{t("sinFotoCaja")}</span>}
                          </p>
                          <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={() => irAPaso(3, undefined, "caja")}>
                            {caja ? t("cambiarFotoCaja") : t("elegirFotoCaja")}
                          </Boton>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Resumen y pago */}
        <aside aria-labelledby={`${id}-resumen`} className="lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-[var(--radius-carta)] bg-blanco p-6 shadow-[var(--shadow-carta)]">
            <h2 id={`${id}-resumen`} className="tipo-subtitular text-xl">
              {t("resumen")}
            </h2>
            <dl className="mt-4 divide-y divide-linea text-sm">
              {cotizacion.lineas.map((l) => (
                <div key={`${l.tipo}-${l.id}`} className="flex items-baseline justify-between gap-3 py-2">
                  <dt>{etiquetaLinea(l)}</dt>
                  <dd className={`shrink-0 tabular-nums ${l.importeCents === 0 ? "font-semibold text-verde-texto" : ""}`}>
                    {l.importeCents === 0 ? (l.tipo === "envio" ? tc("incluido") : tc("gratis")) : dinero(l.importeCents)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 flex items-baseline justify-between border-t-2 border-tinta pt-3">
              <span className="font-bold">{t("total")}</span>
              <span className="tipo-titular text-3xl leading-none">{dinero(cotizacion.totalCents)}</span>
            </div>
            <p className="mt-3 text-sm text-tinta-2">{t("cartasImpresas", { n: cotizacion.cartasFisicas })}</p>

            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-semibold">
              <input type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-tinta)]" />
              {t("confirmacion")}
            </label>

            <Boton
              tamano="lg"
              className="mt-5 w-full"
              disabled={!puedePagar || !revisado || pagando || sinConexion || enConflicto || yaPagado || importando}
              onClick={() => void pagar()}
              aria-describedby={`${id}-estado-pago`}
            >
              {pagando ? t("pagando") : t("pagarPrueba", { total: dinero(cotizacion.totalCents) })}
            </Boton>
            <p id={`${id}-estado-pago`} className="mt-2 min-h-5 text-sm" aria-live="polite">
              {yaPagado ? (
                <span className="text-tinta-2">{t("yaPedidoSinDescarga")}</span>
              ) : importando ? (
                <span className="text-tinta-2" data-testid="motivo-importando">
                  {t("importando")}
                </span>
              ) : !todasListas ? (
                <span className="text-rojo-texto">{t("faltanCartas", { n: pendientes.length })}</span>
              ) : !puedePagar && bloqueantes.length > 0 ? (
                <span className="text-rojo-texto">{t("bloquea")}</span>
              ) : sinConexion ? (
                <span className="text-tinta-2" data-testid="motivo-sin-conexion">
                  {t("sinConexionPagar")}
                </span>
              ) : enConflicto ? (
                <span className="text-tinta-2">{tg("conflicto")}</span>
              ) : !revisado ? (
                <span className="text-tinta-2">{t("faltaConfirmar")}</span>
              ) : null}
            </p>
            {error && (
              <Aviso tono="error" className="mt-3">
                {error}
              </Aviso>
            )}
            <p className="mt-4 text-xs leading-relaxed text-tinta-2">{t("modoPrueba")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
