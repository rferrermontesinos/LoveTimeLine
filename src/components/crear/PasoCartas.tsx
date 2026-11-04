"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRINT } from "@config/print";
import { VistaCarta } from "@/components/carta/VistaCarta";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { Interruptor, Micro } from "@/components/ui/Piezas";
import { fechaLegible } from "@/domain/fechas/formato";
import { pendientesDeCarta, rangoHueco } from "@/domain/mazo/configuracion";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { girarFoto } from "@/lib/importar/girar";
import { useMazo } from "@/lib/mazo/contexto";
import { maxEstrellas, pppDeCarta, proporcionReversoDe, recortesIniciales } from "@/lib/mazo/derivados";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import type { CambiosCarta, Carta } from "@/lib/mazo/tipos";
import { desplazamiento, useCrear } from "./contexto";
import { DialogoEncuadre } from "./Encuadre";
import { FechaDeCarta } from "./FechaDeCarta";

const EditorAdornos = dynamic(() => import("./EditorAdornos"), { ssr: false });

export function PasoCartas() {
  const t = useTranslations();
  const locale = useLocale();
  const { mazo, despachar, puedeDeshacer } = useMazo();
  const { cartaActiva, setCartaActiva, irAPaso, irASiguientePendiente, avisoFecha, iconos, catalogo, versiones, tocarVersion, hoy, pendientes, abrirRecuerdo } = useCrear();
  const [cara, setCara] = useState<"anverso" | "reverso">("reverso");
  const [encuadre, setEncuadre] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const [girando, setGirando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const tira = useRef<HTMLDivElement>(null);
  const tiraColocada = useRef(false);
  const bloqueFecha = useRef<HTMLDivElement>(null);
  const areaTexto = useRef<HTMLTextAreaElement>(null);
  const avisoVisto = useRef(avisoFecha);
  // Carta en la que «Siguiente» ya se ha frenado una vez por estar a medias.
  const [frenada, setFrenada] = useState<string | null>(null);

  const cartas = mazo?.cartas ?? [];
  // Sin carta abierta (al llegar desde el paso 1), se empieza por la primera pendiente.
  const abierta = cartas.findIndex((c) => c.id === cartaActiva);
  const indice = abierta >= 0 ? abierta : Math.max(0, cartas.findIndex((c) => c.id === pendientes[0]));
  const carta: Carta | undefined = cartas[indice];
  const idCarta = carta?.id;

  useEffect(() => {
    if (carta && carta.id !== cartaActiva) setCartaActiva(carta.id);
  }, [carta, cartaActiva, setCartaActiva]);

  // La tira sigue a la carta abierta moviéndose solo en horizontal: la página no se mueve. (Con
  // scrollIntoView bajaba también la página hasta la tira, que quedaba bajo la barra de abajo, y
  // la fecha de la carta se salía de la vista.)
  useEffect(() => {
    const contenedor = tira.current;
    const activa = contenedor?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!contenedor || !activa) return;
    const c = contenedor.getBoundingClientRect();
    const a = activa.getBoundingClientRect();
    const left = contenedor.scrollLeft + a.left + a.width / 2 - (c.left + c.width / 2);
    contenedor.scrollTo({ left, behavior: tiraColocada.current ? desplazamiento() : "auto" });
    tiraColocada.current = true;
  }, [idCarta]);

  // «Siguiente pendiente», aquí o en la barra de abajo: si no se ven el estado y los campos de la
  // fecha (lo que le falta a la carta), se suben hasta justo debajo de las barras fijas.
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
    if (cartas.length === 0) return;
    const n = (i + cartas.length) % cartas.length;
    setFrenada(null);
    setCartaActiva(cartas[n]!.id);
  }

  /**
   * «Siguiente» con la carta a medias: la primera vez no pasa, lleva a lo que falta (la fecha en
   * blanco, sobre todo) y pide rellenarlo; la segunda, pasa: se puede dejar para luego, porque
   * Estilo no se abre hasta que estén todas. Con el teclado no se mueve el foco, para que → siga
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

  const icono = iconos.get(carta.id) ?? null;
  const foto = carta.tipo === "foto" ? carta : null;
  // Un recuerdo sin foto lleva delante su texto, no una foto.
  const etiquetaAnverso = foto ? t("comun.anverso") : t("comun.anversoTexto");
  const ppp = foto ? pppDeCarta(foto) : null;
  const justa = ppp !== null && ppp < PRINT.pppMinimo;
  const estrellas = mazo.cartas.filter((c) => c.destacada).length;
  const maxE = maxEstrellas(catalogo);
  const conEstrella = mazo.mecanicas.includes("estrella");
  const actualizar = (cambios: CambiosCarta, deshacible = true) => despachar({ tipo: "actualizarCarta", id: carta.id, cambios, deshacible });
  const version = versiones[carta.id] ?? 0;
  const listas = cartas.length - pendientes.length;
  const faltan = pendientesDeCarta(carta, hoy);
  const otraPendiente = pendientes.some((id) => id !== carta.id);
  const sinCompletar = new Set(pendientes);
  const listaDeMotivos = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  // Los textos de las cartas van en el idioma del mazo, que puede no ser el de la página.
  const lang = mazo.idiomaMazo.split("-")[0] !== locale.split("-")[0] ? mazo.idiomaMazo : undefined;
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
    <div ref={raiz} className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tipo-titular text-[clamp(2.2rem,6vw,3.4rem)] leading-[0.95]">{t("cartas.titulo")}</h1>
          <p className="mt-2 max-w-2xl text-md text-tinta-2">{t("cartas.texto")}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <p className="tipo-micro text-micro text-tinta-2" aria-live="polite">
            {t("cartas.posicion", { actual: indice + 1, total: cartas.length })}
          </p>
          <p className={`text-md font-semibold ${pendientes.length === 0 ? "text-verde-texto" : ""}`}>
            {pendientes.length === 0 && <span aria-hidden="true">✓ </span>}
            {t("cartas.configuradas", { n: listas, total: cartas.length })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,560px)_1fr]">
        {/* Vista previa */}
        <div className="space-y-3">
          <div role="tablist" aria-label={t("encuadre.titulo")} className="inline-flex gap-1 rounded-[14px] bg-papel-2 p-1 sm:hidden">
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
          <div className="mesa grid grid-cols-1 gap-4 rounded-[24px] p-5 sm:grid-cols-2 sm:p-6">
            <figure className={`${cara === "anverso" ? "" : "hidden"} space-y-2 sm:block`}>
              <VistaCarta carta={carta} mazo={mazo} cara="anverso" icono={icono} calidad="copia" version={version} className="mx-auto max-w-[260px]" />
              <figcaption className="tipo-micro text-center text-micro text-tinta-2">{etiquetaAnverso}</figcaption>
            </figure>
            <figure className={`${cara === "reverso" ? "" : "hidden"} space-y-2 sm:block`}>
              <VistaCarta carta={carta} mazo={mazo} cara="reverso" icono={icono} calidad="copia" version={version} className="mx-auto max-w-[260px]" />
              <figcaption className="tipo-micro text-center text-micro text-tinta-2">{t("comun.reverso")}</figcaption>
            </figure>
          </div>
          <div className="flex flex-wrap gap-2">
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
                const siguiente = cartas[indice + 1] ?? cartas[indice - 1] ?? null;
                despachar({ tipo: "borrarCartas", ids: [carta.id] });
                setCartaActiva(siguiente?.id ?? null);
              }}
            >
              {t("cartas.borrarCarta")}
            </Boton>
          </div>
          {foto && ppp !== null && (
          <div className="rounded-[14px] bg-blanco p-4 text-sm">
            <Micro className="text-tinta-2">{t("cartas.calidad")}</Micro>
            <p className={`mt-1 font-semibold ${justa ? "text-rojo-texto" : "text-verde-texto"}`}>{justa ? t("cartas.calidadJusta", { ppp }) : t("cartas.calidadBuena", { ppp })}</p>
            {justa && (
              <div className="mt-2">
                {foto.pppConfirmado ? (
                  <p>✓ {t("cartas.calidadConfirmada")}</p>
                ) : (
                  <Boton tamano="sm" className="max-sm:min-h-11" variante="secundario" onClick={() => actualizar({ pppConfirmado: true })}>
                    {t("cartas.calidadConfirmar")}
                  </Boton>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Datos de la carta */}
        <div className="space-y-6">
          {/* Estado de la carta y su fecha. Los márgenes de desplazamiento dejan sitio a las barras
              fijas de arriba (cabecera y pasos) y de abajo (con el aviso de las que faltan). */}
          <div ref={bloqueFecha} className="scroll-mt-36 scroll-mb-40 space-y-6">
            {/* Estado de la carta: lista o lo que le falta */}
            <p
              aria-live="polite"
              className={`inline-flex max-w-full items-start gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold ${faltan.length === 0 ? "bg-[#E3F4EA] text-verde-texto" : "bg-[#FFF4D6] text-tinta"}`}
            >
              <span aria-hidden="true">{faltan.length === 0 ? "✓" : "?"}</span>
              <span>
                {faltan.length === 0
                  ? t("cartas.estado.lista")
                  : t(frenada === carta.id ? "cartas.estado.pendienteOtraVez" : "cartas.estado.pendiente", {
                      motivos: listaDeMotivos.format(faltan.map((m) => t(`cartas.pendiente.${m}`, { max: MAX_DESCRIPCION }))),
                    })}
              </span>
            </p>

            <FechaDeCarta carta={carta} hoy={hoy} />
          </div>

          <section className="space-y-3 rounded-[var(--radius-carta)] bg-blanco p-5">
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
              <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" onClick={irAlHueco}>
                {/* Solo el hueco va en el idioma del mazo; el verbo, en el de la interfaz. */}
                {t.rich("cartas.completarHueco", {
                  hueco: carta.descripcion.slice(hueco.inicio, hueco.fin),
                  h: (c) => <span lang={lang}>{c}</span>,
                })}
              </Boton>
            )}
            {foto && (
              <Interruptor
                id={`en-anverso-${carta.id}`}
                activo={foto.descripcionEnAnverso}
                alCambiar={(v) => actualizar({ descripcionEnAnverso: v })}
                etiqueta={t("cartas.descripcionEnAnverso")}
                deshabilitado={!carta.descripcion.trim()}
              />
            )}
            {conEstrella && (
              <Interruptor
                id={`estrella-${carta.id}`}
                activo={carta.destacada}
                alCambiar={(v) => actualizar({ destacada: v })}
                etiqueta={`★ ${t("cartas.estrella")}`}
                descripcion={!carta.destacada && estrellas >= maxE ? t("cartas.estrellaMax", { max: maxE }) : t("cartas.estrellaAyuda", { max: maxE })}
                deshabilitado={!carta.destacada && estrellas >= maxE}
              />
            )}
          </section>

          <nav aria-label={t("cartas.posicion", { actual: indice + 1, total: cartas.length })} className="flex flex-wrap items-center gap-2">
            <Boton variante="secundario" onClick={() => ir(indice - 1)}>
              ← {t("comun.anterior")}
            </Boton>
            <Boton onClick={() => siguiente()}>
              {t("comun.siguiente")} →
            </Boton>
            <Boton variante="fantasma" disabled={!otraPendiente} onClick={() => irASiguientePendiente(carta.id)}>
              {t("cartas.siguientePendiente")}
            </Boton>
            <Boton variante="fantasma" disabled={!puedeDeshacer} onClick={() => despachar({ tipo: "deshacer" })}>
              ↶ {t("comun.deshacer")}
            </Boton>
          </nav>
          <p className="hidden text-sm text-tinta-2 lg:block">{t("cartas.atajos")}</p>
        </div>
      </div>

      {/* Tira de cartas */}
      <div ref={tira} className="-mx-4 overflow-x-auto px-4 pb-2 pt-1">
        <ul className="flex gap-2" aria-label={t("cartas.tiraEtiqueta")}>
          {cartas.map((c, i) => (
            <TiraItem
              key={c.id}
              carta={c}
              activa={i === indice}
              lista={!sinCompletar.has(c.id)}
              version={versiones[c.id] ?? 0}
              alPulsar={() => setCartaActiva(c.id)}
              locale={locale}
            />
          ))}
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => abrirRecuerdo()}
              aria-label={t("crear.recuerdo.boton")}
              title={t("crear.recuerdo.boton")}
              className="grid h-[74px] w-[53px] place-items-center rounded-[8px] border-2 border-dashed border-tinta/50 text-2xl leading-none text-tinta-2 transition-colors hover:border-tinta hover:text-tinta"
            >
              <span aria-hidden="true">+</span>
            </button>
          </li>
        </ul>
      </div>

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

/** Carta del carrusel: ✓ si está lista, «?» si le falta algo; el estado también va en su nombre accesible. */
function TiraItem({ carta, activa, lista, alPulsar, version, locale }: { carta: Carta; activa: boolean; lista: boolean; alPulsar: () => void; version: number; locale: string }) {
  const t = useTranslations("cartas");
  const url = useUrlFoto(carta.tipo === "foto" ? carta.id : null, "mini", version);
  const nombre = carta.tipo === "foto" ? carta.nombreArchivo : carta.descripcion.trim() || t("cartaSinFoto");
  const fecha = carta.fecha ? fechaLegible(carta.fecha, locale) : t("sinFechaCorta");
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={alPulsar}
        aria-current={activa ? "true" : undefined}
        aria-label={t("tiraItem", { nombre, fecha, estado: lista ? "lista" : "pendiente" })}
        className={`relative block h-[74px] w-[53px] overflow-hidden rounded-[8px] bg-papel-3 ${activa ? "outline outline-[3px] outline-offset-2 outline-tinta" : "opacity-80 hover:opacity-100"}`}
      >
        {carta.tipo === "texto" && <span className="absolute inset-0 grid place-items-center p-1 text-center text-[9px] font-semibold leading-tight">{carta.descripcion}</span>}
        {url && carta.tipo === "foto" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
        )}
        <span
          aria-hidden="true"
          className={`absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full text-[11px] font-bold leading-none shadow-[0_0_0_2px_var(--color-blanco)] ${
            lista ? "bg-verde-texto text-blanco" : "bg-amarillo text-tinta"
          }`}
        >
          {lista ? "✓" : "?"}
        </span>
      </button>
    </li>
  );
}
