"use client";

import { useId, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CartaPortada } from "@/components/carta/CartaPortada";
import { VistaCarta } from "@/components/carta/VistaCarta";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Chip, Interruptor, Micro } from "@/components/ui/Piezas";
import { MAX_DEDICATORIA, MAX_TITULO } from "@/domain/mazo/validar";
import { textoEn } from "@/domain/precios/tipos";
import { IDIOMAS_MAZO } from "@/lib/carta/textos";
import { ESTILOS, TONOS, obtenerEstilo, obtenerPlantilla, obtenerTinta, type Tono } from "@/lib/estilos";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { useMazo } from "@/lib/mazo/contexto";
import { cartaPortada } from "@/lib/mazo/derivados";
import type { CampoMazo, Carta, Mazo } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";

/** Paso 3: estilo, color, portada, dedicatoria, tono, idioma y mecánicas gratis, con la vista previa al lado. */
export function PasoEstilo() {
  const t = useTranslations("estilo");
  const tc = useTranslations("comun");
  const locale = useLocale();
  const { mazo, despachar } = useMazo();
  const { catalogo, iconos, versiones } = useCrear();
  const id = useId();
  const nombreIdioma = (codigo: string) => nombreDeIdioma(codigo, locale);

  if (!mazo) return null;
  const estilo = obtenerEstilo(mazo.estiloId);
  const tinta = obtenerTinta(estilo, mazo.tintaId);
  const plantilla = obtenerPlantilla(estilo.plantilla);
  const cambiar = <C extends CampoMazo>(campo: C, valor: Mazo[C]) => despachar({ tipo: "cambiar", campo, valor });
  const portada = cartaPortada(mazo);
  const muestra = mazo.cartas.find((c) => c.fecha && c.id !== portada?.id) ?? mazo.cartas.find((c) => c.id !== portada?.id) ?? portada;
  const mecanicas = catalogo.mecanicas.filter((m) => m.activo).sort((a, b) => a.orden - b.orden);
  const versionPortada = portada ? (versiones[portada.id] ?? 0) : 0;
  const filtro = (tono: Tono) => plantilla.tonosFoto[tono].filtro;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="tipo-titular text-[clamp(2.2rem,6vw,3.4rem)] leading-[0.95]">{t("titulo")}</h1>
        <p className="mt-2 max-w-2xl text-md text-tinta-2">{t("texto")}</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* Vista previa: en el móvil va arriba, en escritorio a la derecha y fija. */}
        <aside aria-label={t("vistaPrevia")} className="order-first min-w-0 lg:order-last lg:sticky lg:top-36 lg:self-start">
          <Micro className="mb-3 text-tinta-2">{t("vistaPrevia")}</Micro>
          <div className="mesa -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-5 sm:mx-0 sm:rounded-[24px] sm:px-5 lg:grid lg:grid-cols-2 lg:overflow-visible lg:p-6">
            <Figura etiqueta={t("caja")}>
              <CartaPortada mazo={mazo} tipo="caja" cara="anverso" version={versionPortada} etiqueta={`${t("caja")}: ${mazo.titulo}`} />
            </Figura>
            <Figura etiqueta={t("portadaCarta")}>
              <CartaPortada mazo={mazo} tipo="portada" cara="reverso" version={versionPortada} etiqueta={`${t("portadaCarta")}: ${mazo.dedicatoria}`} />
            </Figura>
            {muestra && (
              <>
                <Figura etiqueta={tc("anverso")}>
                  <VistaCarta carta={muestra} mazo={mazo} cara="anverso" icono={iconos.get(muestra.id) ?? null} version={versiones[muestra.id] ?? 0} />
                </Figura>
                <Figura etiqueta={tc("reverso")}>
                  <VistaCarta carta={muestra} mazo={mazo} cara="reverso" icono={iconos.get(muestra.id) ?? null} version={versiones[muestra.id] ?? 0} />
                </Figura>
              </>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-9">
          <Bloque titulo={t("estilo")}>
            <div role="radiogroup" aria-label={t("estilo")} className="grid gap-3 sm:grid-cols-2">
              {ESTILOS.map((e) => {
                const activo = e.id === estilo.id;
                return (
                  <Opcion key={e.id} nombre={`${id}-estilo`} activo={activo} alElegir={() => cambiar("estiloId", e.id)} etiqueta={textoEn(e.nombre, locale)}>
                    <span
                      className={`relative flex h-full flex-col gap-2 overflow-hidden rounded-[16px] border-2 bg-blanco p-4 pl-[4.5rem] transition-colors ${activo ? "border-tinta" : "border-transparent hover:border-linea"}`}
                    >
                      <span aria-hidden="true" className="tipo-titular absolute left-0 top-0 flex h-[60px] w-[44px] items-start rounded-[0_0_14px_0] pl-2.5 pt-2 text-[28px] leading-[0.85]" style={{ background: obtenerTinta(e, null).fondo, color: obtenerTinta(e, null).texto }}>
                        ?
                      </span>
                      <span className="font-bold">{textoEn(e.nombre, locale)}</span>
                      <span className="text-sm text-tinta-2">{textoEn(e.descripcion, locale)}</span>
                      <span aria-hidden="true" className="mt-auto flex gap-1.5 pt-1">
                        {e.tintas.map((ti) => (
                          <span key={ti.id} className="h-4 w-4 rounded-full ring-1 ring-tinta/15" style={{ background: ti.fondo }} />
                        ))}
                      </span>
                      {activo && <Marca />}
                    </span>
                  </Opcion>
                );
              })}
            </div>
          </Bloque>

          <Bloque titulo={t("tinta")}>
            <div role="radiogroup" aria-label={t("tinta")} className="flex flex-wrap gap-4">
              {estilo.tintas.map((ti) => {
                const activo = ti.id === tinta.id;
                return (
                  <Opcion key={ti.id} nombre={`${id}-tinta`} activo={activo} alElegir={() => cambiar("tintaId", ti.id)} etiqueta={textoEn(ti.nombre, locale)}>
                    <span className="flex w-20 flex-col items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`relative block h-16 w-16 overflow-hidden rounded-full ring-offset-2 ring-offset-papel transition-shadow ${activo ? "ring-[3px] ring-tinta" : "ring-1 ring-tinta/15"}`}
                        style={{ background: ti.fondo }}
                      >
                        <span className="absolute inset-x-0 bottom-[22%] flex h-2.5 gap-[2px] px-2" style={{ background: ti.franja }} />
                        <span className="tipo-titular absolute left-3 top-2 text-xl leading-none" style={{ color: ti.texto }}>
                          19
                        </span>
                      </span>
                      <span className={`text-center text-sm ${activo ? "font-bold" : "text-tinta-2"}`}>{textoEn(ti.nombre, locale)}</span>
                    </span>
                  </Opcion>
                );
              })}
            </div>
          </Bloque>

          <Bloque titulo={t("tituloMazo")} etiquetaPara={`${id}-titulo`}>
            <input
              id={`${id}-titulo`}
              value={mazo.titulo}
              maxLength={MAX_TITULO}
              autoComplete="off"
              onFocus={() => despachar({ tipo: "puntoDeshacer" })}
              onChange={(e) => cambiar("titulo", e.target.value.replace(/\s+/g, " ").slice(0, MAX_TITULO))}
              onBlur={() => {
                if (!mazo.titulo.trim()) cambiar("titulo", t("tituloPorDefecto"));
                else if (mazo.titulo !== mazo.titulo.trim()) cambiar("titulo", mazo.titulo.trim());
              }}
              aria-describedby={`${id}-titulo-ayuda`}
              className="h-12 w-full max-w-md rounded-[12px] border-2 border-tinta bg-blanco px-3 text-base font-semibold"
            />
            <p id={`${id}-titulo-ayuda`} className="mt-2 flex max-w-md justify-between gap-3 text-sm text-tinta-2">
              <span>{t("tituloMazoAyuda")}</span>
              <span aria-hidden="true" className="shrink-0 tabular-nums">
                {[...mazo.titulo].length} / {MAX_TITULO}
              </span>
            </p>
          </Bloque>

          <Bloque titulo={t("dedicatoria")} etiquetaPara={`${id}-dedicatoria`}>
            <textarea
              id={`${id}-dedicatoria`}
              value={mazo.dedicatoria}
              maxLength={MAX_DEDICATORIA}
              rows={3}
              onFocus={() => despachar({ tipo: "puntoDeshacer" })}
              onChange={(e) => cambiar("dedicatoria", e.target.value.replace(/\n{3,}/g, "\n\n").slice(0, MAX_DEDICATORIA))}
              aria-describedby={`${id}-dedicatoria-ayuda`}
              className="w-full max-w-xl rounded-[12px] border-2 border-tinta bg-blanco px-3 py-2.5 text-base leading-relaxed"
            />
            <p id={`${id}-dedicatoria-ayuda`} className="mt-2 flex max-w-xl justify-between gap-3 text-sm text-tinta-2">
              <span>{t("dedicatoriaAyuda", { max: MAX_DEDICATORIA })}</span>
              <span aria-hidden="true" className="shrink-0 tabular-nums">
                {[...mazo.dedicatoria].length} / {MAX_DEDICATORIA}
              </span>
            </p>
          </Bloque>

          <Bloque titulo={t("portada")} ayuda={mazo.cartas.length ? t("portadaAyuda") : t("sinFotos")}>
            {mazo.cartas.length > 0 && (
              <div role="radiogroup" aria-label={t("portada")} className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-3 pt-1 sm:mx-0 sm:px-1">
                {mazo.cartas.map((c) => (
                  <MiniPortada
                    key={c.id}
                    carta={c}
                    nombre={`${id}-portada`}
                    activa={portada?.id === c.id}
                    alElegir={() => cambiar("portadaId", c.id)}
                    version={versiones[c.id] ?? 0}
                    filtro={filtro(mazo.tono)}
                  />
                ))}
              </div>
            )}
          </Bloque>

          <Bloque titulo={t("tono")}>
            <div role="radiogroup" aria-label={t("tono")} className="flex flex-wrap gap-3">
              {TONOS.map((tono) => (
                <OpcionTono
                  key={tono}
                  nombre={`${id}-tono`}
                  activo={mazo.tono === tono}
                  alElegir={() => cambiar("tono", tono)}
                  etiqueta={t(`tonos.${tono}`)}
                  carta={portada}
                  version={versionPortada}
                  filtro={filtro(tono)}
                />
              ))}
            </div>
          </Bloque>

          <Bloque titulo={t("idiomaMazo")} ayuda={t("idiomaMazoAyuda")}>
            <div role="radiogroup" aria-label={t("idiomaMazo")} className="inline-flex flex-wrap gap-1 rounded-[14px] bg-papel-2 p-1">
              {IDIOMAS_MAZO.map((idioma) => {
                const activo = mazo.idiomaMazo === idioma;
                return (
                  <Opcion key={idioma} nombre={`${id}-idioma`} activo={activo} alElegir={() => cambiar("idiomaMazo", idioma)} etiqueta={nombreIdioma(idioma)}>
                    <span lang={idioma} className={`tipo-boton grid min-h-10 place-items-center rounded-[10px] px-4 text-sm transition-colors ${activo ? "bg-tinta text-papel" : "hover:bg-papel-3"}`}>
                      {nombreIdioma(idioma)}
                    </span>
                  </Opcion>
                );
              })}
            </div>
          </Bloque>

          <Bloque titulo={t("mecanicas")} ayuda={t("mecanicasAyuda")}>
            <ul className="grid gap-3">
              {mecanicas.map((m) => {
                const activa = mazo.mecanicas.includes(m.id);
                return (
                  <li key={m.id} className="flex items-start gap-3 rounded-[14px] bg-blanco p-4">
                    <IconoMecanica id={m.id} tamano="sm" />
                    <div className="min-w-0 flex-1">
                      <Interruptor
                        id={`${id}-mec-${m.id}`}
                        alFinal
                        activo={activa}
                        alCambiar={(v) => cambiar("mecanicas", v ? [...mazo.mecanicas, m.id] : mazo.mecanicas.filter((x) => x !== m.id))}
                        etiqueta={
                          <span className="flex flex-wrap items-center gap-2">
                            {textoEn(m.nombre, locale)}
                            <Chip color="#E3F4EA" className="text-verde-texto">
                              {tc("gratis")}
                            </Chip>
                            {m.tipo === "cartas" && m.cartasFisicas ? <Chip>{t("masCartas", { n: m.cartasFisicas })}</Chip> : null}
                          </span>
                        }
                        descripcion={textoEn(m.descripcion, locale)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Bloque>
        </div>
      </div>
    </div>
  );
}

/** «Español», «English»…: el nombre del idioma en el idioma de la interfaz. */
function nombreDeIdioma(codigo: string, locale: string): string {
  try {
    const n = new Intl.DisplayNames([locale], { type: "language" }).of(codigo) ?? codigo;
    return n.charAt(0).toLocaleUpperCase(locale) + n.slice(1);
  } catch {
    return codigo.toUpperCase();
  }
}

function Bloque({ titulo, ayuda, etiquetaPara, children }: { titulo: string; ayuda?: string; etiquetaPara?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        {etiquetaPara ? (
          <label htmlFor={etiquetaPara} className="tipo-subtitular block text-lg">
            {titulo}
          </label>
        ) : (
          <h2 className="tipo-subtitular text-lg">{titulo}</h2>
        )}
        {ayuda && <p className="mt-1 text-sm text-tinta-2">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

/** Radio nativo, oculto, con el aspecto que le dé `children`: así funcionan las flechas del teclado. */
function Opcion({ nombre, activo, alElegir, etiqueta, children }: { nombre: string; activo: boolean; alElegir: () => void; etiqueta: string; children: ReactNode }) {
  return (
    <label className="relative block cursor-pointer rounded-[16px] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalto">
      <input type="radio" name={nombre} checked={activo} onChange={alElegir} aria-label={etiqueta} className="sr-only" />
      {children}
    </label>
  );
}

function Marca() {
  return (
    <span aria-hidden="true" className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-tinta text-sm font-bold text-papel">
      ✓
    </span>
  );
}

function Figura({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <figure className="w-[40vw] max-w-[190px] shrink-0 snap-start lg:w-auto lg:max-w-none">
      {children}
      <figcaption className="tipo-micro mt-2 text-micro text-tinta-2">{etiqueta}</figcaption>
    </figure>
  );
}

function MiniPortada({ carta, nombre, activa, alElegir, version, filtro }: { carta: Carta; nombre: string; activa: boolean; alElegir: () => void; version: number; filtro: string }) {
  const url = useUrlFoto(carta.id, "mini", version);
  return (
    <Opcion nombre={nombre} activo={activa} alElegir={alElegir} etiqueta={carta.descripcion || carta.nombreArchivo}>
      <span className={`relative block h-20 w-20 shrink-0 snap-start overflow-hidden rounded-[12px] bg-papel-3 transition-shadow ${activa ? "ring-[3px] ring-tinta ring-offset-2 ring-offset-papel" : ""}`}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" style={{ filter: filtro }} draggable={false} />
        )}
        {activa && <Marca />}
      </span>
    </Opcion>
  );
}

function OpcionTono({ nombre, activo, alElegir, etiqueta, carta, version, filtro }: { nombre: string; activo: boolean; alElegir: () => void; etiqueta: string; carta: Carta | null; version: number; filtro: string }) {
  const url = useUrlFoto(carta?.id ?? null, "mini", version);
  return (
    <Opcion nombre={nombre} activo={activo} alElegir={alElegir} etiqueta={etiqueta}>
      <span className="flex w-24 flex-col items-center gap-2">
        <span className={`block h-24 w-24 overflow-hidden rounded-[14px] bg-gradient-to-br from-rosa via-amarillo to-cobalto transition-shadow ${activo ? "ring-[3px] ring-tinta ring-offset-2 ring-offset-papel" : ""}`} style={url ? undefined : { filter: filtro }}>
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" style={{ filter: filtro }} draggable={false} />
          )}
        </span>
        <span className={`text-center text-sm ${activo ? "font-bold" : "text-tinta-2"}`}>{etiqueta}</span>
      </span>
    </Opcion>
  );
}
