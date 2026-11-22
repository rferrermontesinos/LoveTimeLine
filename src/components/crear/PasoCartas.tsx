"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRINT } from "@config/print";
import { FRASE_EN_ANVERSO } from "@config/prototipo";
import { VistaCarta } from "@/components/carta/VistaCarta";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { Franja, Interruptor } from "@/components/ui/Piezas";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { fechaLegible } from "@/domain/fechas/formato";
import { pendientesDeCarta, rangoHueco } from "@/domain/mazo/configuracion";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { girarFoto } from "@/lib/importar/girar";
import { useMazo } from "@/lib/mazo/contexto";
import { pppDeCarta, proporcionReversoDe, recortesIniciales } from "@/lib/mazo/derivados";
import { ideasParaProponer } from "@/lib/mazo/recuerdos";
import type { CambiosCarta, Carta, SugerenciaFecha } from "@/lib/mazo/tipos";
import { desplazamiento, useCrear } from "./contexto";
import { DialogoEncuadre } from "./Encuadre";
import { FechaDeCarta } from "./FechaDeCarta";
import { EstadoImportacion, useElegirFotos } from "./importacion";
import { LineaDelMazo } from "./LineaDelMazo";

const EditorAdornos = dynamic(() => import("./EditorAdornos"), { ssr: false });

/** Con estas pendientes o menos (y alguna lista), el aviso anima: «¡Ya casi!». */
const CASI = 3;

/**
 * Orden para pasar de una carta a otra: por fecha, con las que no tienen fecha al final. Se fija
 * al entrar y al añadir o borrar cartas, no al cambiar una fecha: al poner la fecha a una carta
 * sin fecha, «Siguiente» lleva a la siguiente sin fecha y no al año que se acaba de poner.
 */
function useOrdenDeRecorrido(cartas: readonly Carta[]): string[] {
  const clave = cartas
    .map((c) => c.id)
    .sort()
    .join("|");
  const [orden, setOrden] = useState(() => ({ clave, ids: ordenarPorFecha(cartas).map((c) => c.id) }));
  if (orden.clave === clave) return orden.ids;
  const nuevo = { clave, ids: ordenarPorFecha(cartas).map((c) => c.id) };
  setOrden(nuevo);
  return nuevo.ids;
}

/**
 * Paso 2: cuántas faltan (o el aviso de que el mazo está listo), la carta abierta con sus dos
 * caras a un lado y su fecha y su frase al otro, y debajo el mazo entero ordenado por fecha, con
 * las que no tienen fecha al final. Se pueden añadir más fotos (o soltarlas) y recuerdos sin foto.
 */
export function PasoCartas() {
  const t = useTranslations();
  const locale = useLocale();
  const id = useId();
  const { mazo, despachar, puedeDeshacer } = useMazo();
  const { cartaActiva, setCartaActiva, irAPaso, irASiguientePendiente, avisoFecha, iconos, versiones, tocarVersion, hoy, pendientes, abrirRecuerdo, cotizacion } = useCrear();
  const { entradas, elegirFotos } = useElegirFotos();
  const [cara, setCara] = useState<"anverso" | "reverso">("reverso");
  const [encuadre, setEncuadre] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const [girando, setGirando] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const bloqueFecha = useRef<HTMLDivElement>(null);
  const areaTexto = useRef<HTMLTextAreaElement>(null);
  const avisoVisto = useRef(avisoFecha);
  // Carta en la que «Siguiente» ya se ha frenado una vez por estar a medias.
  const [frenada, setFrenada] = useState<string | null>(null);
  // Tras usar una fecha sugerida: a dónde va el foco cuando se pinta la carta siguiente (o el aviso
  // de que el mazo está listo), para que quien usa el teclado o un lector de pantalla siga el paso.
  const focoTrasSugerencia = useRef<"fecha" | "listo" | null>(null);
  // Lo que se dice en la carta a la que se pasa sola: que la anterior ya tiene fecha y cuántas quedan.
  const [hecho, setHecho] = useState<{ cartaId: string; fecha: FechaCarta; quedan: number } | null>(null);

  const cartas = useMemo(() => mazo?.cartas ?? [], [mazo?.cartas]);
  const orden = useOrdenDeRecorrido(cartas);
  const porId = useMemo(() => new Map(cartas.map((c) => [c.id, c])), [cartas]);
  const sinCompletar = useMemo(() => new Set(pendientes), [pendientes]);
  // Sin carta abierta (al llegar desde el paso 1), se empieza por la primera pendiente.
  const abierta = cartaActiva && porId.has(cartaActiva) ? cartaActiva : (pendientes[0] ?? orden[0] ?? null);
  const carta: Carta | undefined = abierta ? porId.get(abierta) : undefined;
  const indice = carta ? orden.indexOf(carta.id) : -1;
  // Miniatura de la foto para las sugerencias de fecha en el móvil, donde la carta queda más arriba.
  const miniatura = useUrlFoto(carta?.tipo === "foto" ? carta.id : null, "mini", carta ? (versiones[carta.id] ?? 0) : 0);

  useEffect(() => {
    if (carta && carta.id !== cartaActiva) setCartaActiva(carta.id);
  }, [carta, cartaActiva, setCartaActiva]);

  // «Completar la siguiente», aquí o en la barra de abajo: si no se ven el estado y los campos de
  // la fecha (lo que le falta a la carta), se suben hasta justo debajo de las barras fijas.
  useEffect(() => {
    if (avisoFecha === avisoVisto.current) return;
    avisoVisto.current = avisoFecha;
    const bloque = bloqueFecha.current;
    if (!bloque) return;
    const estilo = getComputedStyle(bloque);
    const arriba = parseFloat(estilo.scrollMarginTop) || 0;
    const abajo = parseFloat(estilo.scrollMarginBottom) || 0;
    const campos = bloque.querySelector("fieldset") ?? bloque;
    const tapado = bloque.getBoundingClientRect().top < arriba || campos.getBoundingClientRect().bottom > window.innerHeight - abajo;
    if (tapado) bloque.scrollIntoView({ block: "start", behavior: desplazamiento() });
  }, [avisoFecha]);

  // Sin dependencias: se mira después de cada pintado, y el de después de usar la sugerencia ya
  // tiene la carta siguiente (o el aviso) en la página.
  useEffect(() => {
    const destinoPedido = focoTrasSugerencia.current;
    if (!destinoPedido) return;
    focoTrasSugerencia.current = null;
    if (destinoPedido === "listo") {
      const boton = document.querySelector<HTMLElement>('[data-testid="mazo-listo"] button');
      boton?.scrollIntoView({ block: "center", behavior: desplazamiento() });
      boton?.focus({ preventScroll: true });
      return;
    }
    // La carta siguiente: el foco en su sugerencia (o en su fecha) y, si no se ve entera, la zona
    // con lo hecho y lo siguiente por decidir, justo entre las barras fijas.
    const bloque = bloqueFecha.current;
    const zona = bloque?.querySelector<HTMLElement>("[data-zona-sugerencias]") ?? bloque;
    const destino = zona?.querySelector<HTMLElement>("[data-sugerencia] button") ?? bloque?.querySelector<HTMLElement>("fieldset input, fieldset select");
    destino?.focus({ preventScroll: true });
    if (!zona) return;
    const estilo = getComputedStyle(zona);
    const caja = zona.getBoundingClientRect();
    const tapada = caja.top < (parseFloat(estilo.scrollMarginTop) || 0) || caja.bottom > window.innerHeight - (parseFloat(estilo.scrollMarginBottom) || 0);
    if (tapada) zona.scrollIntoView({ block: "nearest", behavior: desplazamiento() });
  });

  // ← y → para moverse entre cartas, salvo mientras se escribe, en un control que ya usa las
  // flechas (grupos de opciones, pestañas) o con un diálogo abierto encima.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || encuadre || emojis) return;
      if (document.querySelector("dialog[open]") || el.closest('[role="radiogroup"], [role="tablist"], [role="slider"], [role="listbox"], [role="menu"]')) return;
      if (e.key === "ArrowRight") siguiente(false);
      if (e.key === "ArrowLeft") ir(indice - 1);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  if (!mazo) return null;
  if (!carta) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-md">{t("cartas.sinCartas")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Boton onClick={() => irAPaso(1)}>{t("cartas.irAFotos")}</Boton>
          <Boton variante="secundario" onClick={() => abrirRecuerdo()}>
            + {t("crear.recuerdo.boton")}
          </Boton>
        </div>
      </div>
    );
  }

  function ir(i: number) {
    if (orden.length === 0) return;
    const n = (i + orden.length) % orden.length;
    setFrenada(null);
    setCartaActiva(orden[n]!);
  }

  /**
   * «Siguiente» con la carta a medias: la primera vez no pasa, lleva a lo que falta (la fecha en
   * blanco, sobre todo) y pide rellenarlo; la segunda, pasa: se puede dejar para luego, porque
   * no se puede pagar hasta que estén todas. Con el teclado no se mueve el foco, para que → siga
   * funcionando.
   */
  function siguiente(enfocar = true) {
    const pendiente = carta ? pendientesDeCarta(carta, hoy) : [];
    if (!carta || pendiente.length === 0 || frenada === carta.id) return ir(indice + 1);
    setFrenada(carta.id);
    const bloque = bloqueFecha.current;
    const deFecha = pendiente.some((m) => m === "sin-fecha" || m.startsWith("fecha-"));
    bloque?.scrollIntoView({ block: "start", behavior: desplazamiento() });
    if (!enfocar) return;
    if (deFecha) bloque?.querySelector<HTMLElement>("fieldset input, fieldset select")?.focus({ preventScroll: true });
    else if (rangoHueco(carta.descripcion)) irAlHueco();
    else areaTexto.current?.focus({ preventScroll: true });
  }

  /**
   * Con una fecha sugerida, completar el mazo es ir tocando: si la carta queda lista, se pasa sola
   * a la siguiente sin completar; con la última, al aviso de que el mazo está listo. Si a la carta
   * aún le falta algo (el texto, por ejemplo), se queda en ella.
   */
  const alUsarSugerencia = (s: SugerenciaFecha) => {
    if (!carta) return;
    const lista = pendientesDeCarta({ ...carta, fecha: s.fecha, revisar: false }, hoy).length === 0;
    if (!lista) return;
    if (pendientes.every((p) => p === carta.id)) {
      focoTrasSugerencia.current = "listo";
      return;
    }
    setFrenada(null);
    const siguienteId = irASiguientePendiente(carta.id, { desplazar: false });
    if (!siguienteId) return;
    setHecho({ cartaId: siguienteId, fecha: s.fecha, quedan: pendientes.length - 1 });
    focoTrasSugerencia.current = "fecha";
  };

  /** Desde el mazo de abajo: abre la carta y sube a ella. */
  const abrirDesdeMazo = (cartaId: string) => {
    setFrenada(null);
    setCartaActiva(cartaId);
    editor.current?.scrollIntoView({ block: "start", behavior: desplazamiento() });
  };

  const icono = iconos.get(carta.id) ?? null;
  const foto = carta.tipo === "foto" ? carta : null;
  // Un recuerdo sin foto lleva delante su texto, no una foto.
  const etiquetaAnverso = foto ? t("comun.anverso") : t("comun.anversoTexto");
  const ppp = foto ? pppDeCarta(foto) : null;
  const justa = ppp !== null && ppp < PRINT.pppMinimo;
  const actualizar = (cambios: CambiosCarta, deshacible = true) => despachar({ tipo: "actualizarCarta", id: carta.id, cambios, deshacible });
  const version = versiones[carta.id] ?? 0;
  const total = cartas.length;
  const listas = total - pendientes.length;
  // Pendientes a las que solo les falta la fecha y tienen una sugerida: se completan con un toque.
  const deUnToque = pendientes.filter((pid) => {
    const c = porId.get(pid);
    return !!c?.sugerencias?.length && pendientesDeCarta(c, hoy).every((m) => m === "sin-fecha");
  }).length;
  const faltanMinimo = Math.max(0, (cotizacion?.minimo ?? 0) - total);
  const faltan = pendientesDeCarta(carta, hoy);
  const listaDeMotivos = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  // Los textos de las cartas van en el idioma del mazo, que puede no ser el de la página.
  const lang = mazo.idiomaMazo.split("-")[0] !== locale.split("-")[0] ? mazo.idiomaMazo : undefined;
  const ideas = ideasParaProponer(mazo.idiomaMazo, cartas, 4);
  // En un recuerdo sin foto, el primer hueco por rellenar («[nombre]»), si queda alguno.
  const hueco = foto ? null : rangoHueco(carta.descripcion);
  const irAlHueco = () => {
    const el = areaTexto.current;
    if (!el || !hueco) return;
    el.focus();
    el.setSelectionRange(hueco.inicio, hueco.fin);
  };

  const girar = async () => {
    if (!foto) return;
    setGirando(true);
    const nuevo = await girarFoto(carta.id, 1);
    if (nuevo) {
      actualizar({ ancho: nuevo.ancho, alto: nuevo.alto, ...recortesIniciales(nuevo.ancho, nuevo.alto, proporcionReversoDe(mazo)), reversoPersonalizado: false, adornos: foto.adornos, pppConfirmado: false });
      tocarVersion(carta.id);
    }
    setGirando(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="tipo-titular text-[clamp(2.2rem,6vw,3.4rem)] leading-[0.95]">{t("cartas.titulo")}</h1>
        <p className="mt-2 max-w-2xl text-md text-tinta-2">{t("cartas.texto")}</p>
      </header>

      {/* Cuántas faltan, en grande; o, con todas listas, el aviso de que el mazo está preparado. */}
      {pendientes.length === 0 ? (
        <section aria-live="polite" data-testid="mazo-listo" className="flex flex-wrap items-center gap-4 rounded-[var(--radius-carta)] bg-[#E3F4EA] p-5 sm:gap-5 sm:p-6">
          <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-verde-texto text-3xl font-bold text-blanco">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="tipo-titular text-[clamp(1.7rem,4vw,2.4rem)] leading-none">{faltanMinimo > 0 ? t("cartas.listo.tituloFaltan") : t("cartas.listo.titulo")}</p>
            <p className="mt-2">{faltanMinimo > 0 ? t("cartas.listo.faltanMinimo", { n: faltanMinimo }) : t("cartas.listo.texto", { n: total })}</p>
          </div>
          {faltanMinimo > 0 ? (
            <Boton variante="secundario" className="max-sm:w-full" onClick={elegirFotos}>
              + {t("cartas.mazo.anadirFotos")}
            </Boton>
          ) : (
            <Boton className="max-sm:w-full" onClick={() => irAPaso(3)}>
              {t("crear.barra.siguienteEstilo")} →
            </Boton>
          )}
        </section>
      ) : (
        <section aria-live="polite" data-testid="mazo-pendientes" className="space-y-3 rounded-[var(--radius-carta)] bg-blanco p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="tipo-titular text-[clamp(1.7rem,4vw,2.4rem)] leading-none">
                {t(pendientes.length <= CASI && listas > 0 ? "cartas.progreso.casi" : "cartas.progreso.faltan", { n: pendientes.length })}
              </p>
              <p className="mt-2 text-tinta-2">
                {t("cartas.progreso.listas", { n: listas, total })}
                {deUnToque > 0 && <> · {t("cartas.progreso.unToque", { n: deUnToque })}</>}
              </p>
            </div>
            <Boton variante="secundario" className="max-sm:w-full" onClick={() => irASiguientePendiente(carta.id)}>
              {t("cartas.progreso.siguiente")} →
            </Boton>
          </div>
          <Franja valor={total ? listas / total : 0} color="var(--color-verde-texto)" etiqueta={t("cartas.progreso.listas", { n: listas, total })} />
        </section>
      )}

      {/* La carta abierta: a un lado sus dos caras y lo que se le hace a la foto; al otro, su
          fecha y su frase. Las dos columnas miden lo mismo. */}
      <div ref={editor} className="grid scroll-mt-36 grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-label={t("cartas.vistaPrevia")} className="mesa flex min-w-0 flex-col gap-4 rounded-[24px] p-4 sm:p-6">
          <div role="tablist" aria-label={t("encuadre.titulo")} className="inline-flex gap-1 self-start rounded-[14px] bg-papel p-1 sm:hidden">
            {(["anverso", "reverso"] as const).map((c) => (
              <button
                key={c}
                role="tab"
                type="button"
                aria-selected={cara === c}
                onClick={() => setCara(c)}
                className={`tipo-boton min-h-10 rounded-[10px] px-3 text-sm ${cara === c ? "bg-tinta text-papel" : ""}`}
              >
                {c === "anverso" ? etiquetaAnverso : t("comun.reverso")}
              </button>
            ))}
          </div>
          {/* Las dos caras y lo que se hace con la foto, juntos y centrados en el alto de la columna. */}
          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <figure className={`${cara === "anverso" ? "" : "hidden"} space-y-2 sm:block`}>
                <VistaCarta carta={carta} mazo={mazo} cara="anverso" icono={icono} calidad="copia" version={version} className="mx-auto max-w-[260px]" />
                <figcaption className="tipo-micro text-center text-micro text-tinta-2">{etiquetaAnverso}</figcaption>
              </figure>
              <figure className={`${cara === "reverso" ? "" : "hidden"} space-y-2 sm:block`}>
                <VistaCarta carta={carta} mazo={mazo} cara="reverso" icono={icono} calidad="copia" version={version} className="mx-auto max-w-[260px]" />
                <figcaption className="tipo-micro text-center text-micro text-tinta-2">{t("comun.reverso")}</figcaption>
              </figure>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {foto && (
                <>
                  <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" onClick={() => setEncuadre(true)}>
                    ⤧ {t("cartas.encuadrar")}
                  </Boton>
                  <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" onClick={girar} disabled={girando}>
                    ↻ {t("cartas.girar")}
                  </Boton>
                  <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" onClick={() => setEmojis(true)}>
                    ☺ {t("cartas.adornos")}
                  </Boton>
                </>
              )}
              <Boton
                variante="peligro"
                tamano="sm"
                className="max-sm:min-h-11"
                onClick={() => {
                  const otra = orden[indice + 1] ?? orden[indice - 1] ?? null;
                  despachar({ tipo: "borrarCartas", ids: [carta.id] });
                  setCartaActiva(otra);
                }}
              >
                {t("cartas.borrarCarta")}
              </Boton>
            </div>
            {/* Calidad de impresión: solo si la foto se queda corta, en una línea y sin alarmar (no es un
                error: un buen recuerdo vale aunque la foto no sea perfecta). */}
            {foto && justa && (
              <p className="text-center text-sm">
                <span className="text-tinta-2">{t("cartas.calidadJusta", { ppp })}</span>{" "}
                {foto.pppConfirmado ? (
                  <span className="whitespace-nowrap text-tinta-2">✓ {t("cartas.calidadConfirmada")}</span>
                ) : (
                  <button type="button" className="enlace whitespace-nowrap font-semibold" onClick={() => actualizar({ pppConfirmado: true })}>
                    {t("cartas.calidadConfirmar")}
                  </button>
                )}
              </p>
            )}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Estado de la carta y su fecha. Los márgenes de desplazamiento dejan sitio a las barras
              fijas de arriba (cabecera y pasos) y de abajo. */}
          <div ref={bloqueFecha} className="scroll-mt-36 scroll-mb-40 space-y-4">
            <p
              aria-live="polite"
              className={`inline-flex max-w-full items-start gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold ${faltan.length === 0 ? "bg-[#E3F4EA] text-verde-texto" : "bg-[#FFF4D6] text-tinta"}`}
            >
              <span aria-hidden="true">{faltan.length === 0 ? "✓" : "•"}</span>
              <span>
                {faltan.length === 0
                  ? t("cartas.estado.lista")
                  : t(frenada === carta.id ? "cartas.estado.pendienteOtraVez" : "cartas.estado.pendiente", {
                      motivos: listaDeMotivos.format(faltan.map((m) => t(`cartas.pendiente.${m}`, { max: MAX_DESCRIPCION }))),
                    })}
              </span>
            </p>
            <FechaDeCarta
              carta={carta}
              hoy={hoy}
              alUsarSugerencia={alUsarSugerencia}
              miniatura={miniatura}
              hecho={hecho?.cartaId === carta.id ? t("cartas.hecho", { fecha: fechaLegible(hecho.fecha, locale), n: hecho.quedan }) : null}
            />
          </div>

          <section className="flex flex-1 flex-col gap-3 rounded-[var(--radius-carta)] bg-blanco p-5">
            <label htmlFor={`desc-${carta.id}`} className="tipo-subtitular block text-lg">
              {foto ? t("cartas.descripcion") : t("cartas.textoRecuerdo")}
            </label>
            <textarea
              ref={areaTexto}
              id={`desc-${carta.id}`}
              value={carta.descripcion}
              lang={lang}
              maxLength={MAX_DESCRIPCION + 20}
              rows={2}
              onFocus={() => despachar({ tipo: "puntoDeshacer" })}
              onChange={(e) => actualizar({ descripcion: e.target.value.replace(/\n/g, " ") }, false)}
              aria-describedby={`desc-ayuda-${carta.id}`}
              className="w-full rounded-[12px] border-2 border-tinta bg-blanco px-3 py-2.5 text-base"
            />
            <div className="flex justify-between gap-3 text-sm">
              <span id={`desc-ayuda-${carta.id}`} className="text-tinta-2">
                {foto ? t("cartas.descripcionAyuda", { max: MAX_DESCRIPCION }) : t("cartas.textoRecuerdoAyuda", { max: MAX_DESCRIPCION })}
              </span>
              <span className={`shrink-0 whitespace-nowrap ${[...carta.descripcion].length > MAX_DESCRIPCION ? "font-bold text-rojo-texto" : "text-tinta-2"}`}>
                {t("cartas.descripcionContador", { n: [...carta.descripcion].length, max: MAX_DESCRIPCION })}
              </span>
            </div>
            {hueco && (
              <Boton tamano="sm" variante="secundario" className="self-start max-sm:min-h-11" onClick={irAlHueco}>
                {/* Solo el hueco va en el idioma del mazo; el verbo, en el de la interfaz. */}
                {t.rich("cartas.completarHueco", {
                  hueco: carta.descripcion.slice(hueco.inicio, hueco.fin),
                  h: (c) => <span lang={lang}>{c}</span>,
                })}
              </Boton>
            )}
            {/* «Solo cartas y fechas» (22-11-2026): de momento, la frase no va también en la cara de la foto. */}
            {foto && FRASE_EN_ANVERSO && (
              <Interruptor
                id={`en-anverso-${carta.id}`}
                activo={foto.descripcionEnAnverso}
                alCambiar={(v) => actualizar({ descripcionEnAnverso: v })}
                etiqueta={t("cartas.descripcionEnAnverso")}
                deshabilitado={!carta.descripcion.trim()}
              />
            )}
          </section>

          <nav aria-label={t("cartas.posicion", { actual: indice + 1, total })} className="flex flex-wrap items-center gap-2">
            <Boton variante="secundario" onClick={() => ir(indice - 1)}>
              ← {t("comun.anterior")}
            </Boton>
            <Boton onClick={() => siguiente()}>
              {t("comun.siguiente")} →
            </Boton>
            <Boton variante="fantasma" disabled={!puedeDeshacer} onClick={() => despachar({ tipo: "deshacer" })}>
              ↶ {t("comun.deshacer")}
            </Boton>
            <span className="tipo-micro ml-auto text-micro text-tinta-2" aria-live="polite">
              {t("cartas.posicion", { actual: indice + 1, total })}
            </span>
          </nav>
          <p className="hidden text-sm text-tinta-2 lg:block">{t("cartas.atajos")}</p>
        </div>
      </div>

      {/* El mazo entero, como en Pedido: por fecha y, al final, las que no tienen. */}
      <section aria-labelledby={`${id}-mazo`} className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${id}-mazo`} className="tipo-subtitular text-xl">
              {t("cartas.mazo.titulo")} <span className="text-tinta-2">· {total}</span>
            </h2>
            <p className="mt-1 text-sm text-tinta-2">{t("cartas.mazo.ayuda")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" onClick={elegirFotos}>
              + {t("cartas.mazo.anadirFotos")}
            </Boton>
            <span className="hidden text-sm text-tinta-2 sm:inline">{t("cartas.mazo.arrastrar")}</span>
          </div>
          {entradas}
        </div>
        <EstadoImportacion />
        <LineaDelMazo mazo={mazo} activa={carta.id} pendientes={sinCompletar} alPulsar={abrirDesdeMazo} />

        {/* Recuerdos sin foto: una línea discreta con ideas, al final. */}
        <div className="flex flex-wrap items-center gap-2" data-testid="ideas-recuerdo">
          <span className="mr-1 text-sm font-semibold">{t("cartas.sinFoto.titulo")}</span>
          {ideas.map((i) => (
            <button key={i} type="button" lang={lang} onClick={() => abrirRecuerdo(i)} className={CLASES_IDEA}>
              {i}
            </button>
          ))}
          <button type="button" onClick={() => abrirRecuerdo()} className={CLASES_IDEA}>
            + {t("cartas.sinFoto.otro")}
          </button>
        </div>
      </section>

      {foto && <DialogoEncuadre key={`${carta.id}-${version}-${encuadre}`} carta={foto} abierto={encuadre} alCerrar={() => setEncuadre(false)} icono={icono} version={version} />}
      <Dialogo abierto={emojis} alCerrar={() => setEmojis(false)} titulo={t("adornos.titulo")} ancho="max-w-3xl">
        {emojis && foto && (
          <EditorAdornos
            carta={foto}
            mazo={mazo}
            icono={icono}
            version={version}
            alGuardar={(adornos) => {
              actualizar({ adornos });
              setEmojis(false);
            }}
            alCancelar={() => setEmojis(false)}
          />
        )}
      </Dialogo>
    </div>
  );
}

/** Las ideas de recuerdo como chips pequeños, con 44 px de alto en el móvil. */
const CLASES_IDEA = "min-h-9 rounded-full border-2 border-linea bg-blanco px-3 text-left text-sm transition-colors hover:border-tinta max-sm:min-h-11";
