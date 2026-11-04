"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRINT } from "@config/print";
import { VistaCarta } from "@/components/carta/VistaCarta";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { Aviso, Interruptor, Micro } from "@/components/ui/Piezas";
import { siguienteSinFecha } from "@/domain/mazo/ordenar";
import { MAX_DESCRIPCION } from "@/domain/mazo/validar";
import { girarFoto } from "@/lib/importar/girar";
import { useMazo } from "@/lib/mazo/contexto";
import { maxEstrellas, pppDeCarta, proporcionReversoDe, recortesIniciales } from "@/lib/mazo/derivados";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import type { CambiosCarta, Carta } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";
import { DialogoEncuadre } from "./Encuadre";
import { SelectorFecha } from "./SelectorFecha";

const EditorAdornos = dynamic(() => import("./EditorAdornos"), { ssr: false });

export function PasoCartas() {
  const t = useTranslations();
  const locale = useLocale();
  const { mazo, despachar, puedeDeshacer } = useMazo();
  const { cartaActiva, setCartaActiva, irAPaso, iconos, catalogo, versiones, tocarVersion } = useCrear();
  const [cara, setCara] = useState<"anverso" | "reverso">("reverso");
  const [encuadre, setEncuadre] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const [girando, setGirando] = useState(false);
  const hoy = useMemo(() => new Date(), []);
  const raiz = useRef<HTMLDivElement>(null);

  const cartas = mazo?.cartas ?? [];
  const indice = Math.max(0, cartas.findIndex((c) => c.id === cartaActiva));
  const carta: Carta | undefined = cartas[indice];

  useEffect(() => {
    if (carta && carta.id !== cartaActiva) setCartaActiva(carta.id);
  }, [carta, cartaActiva, setCartaActiva]);

  // ← y → para moverse entre cartas, salvo mientras se escribe.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || encuadre || emojis) return;
      if (e.key === "ArrowRight") ir(indice + 1);
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
        <Boton onClick={() => irAPaso(1)}>{t("cartas.irAFotos")}</Boton>
      </div>
    );
  }

  function ir(i: number) {
    if (cartas.length === 0) return;
    const n = (i + cartas.length) % cartas.length;
    setCartaActiva(cartas[n]!.id);
  }

  const icono = iconos.get(carta.id) ?? null;
  const foto = carta.tipo === "foto" ? carta : null;
  const ppp = foto ? pppDeCarta(foto) : null;
  const justa = ppp !== null && ppp < PRINT.pppMinimo;
  const estrellas = mazo.cartas.filter((c) => c.destacada).length;
  const maxE = maxEstrellas(catalogo);
  const conEstrella = mazo.mecanicas.includes("estrella");
  const actualizar = (cambios: CambiosCarta, deshacible = true) => despachar({ tipo: "actualizarCarta", id: carta.id, cambios, deshacible });
  const version = versiones[carta.id] ?? 0;

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
        <p className="tipo-micro text-micro text-tinta-2" aria-live="polite">
          {t("cartas.posicion", { actual: indice + 1, total: cartas.length })}
        </p>
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
                {c === "anverso" ? t("comun.anverso") : t("comun.reverso")}
              </button>
            ))}
          </div>
          <div className="mesa grid grid-cols-1 gap-4 rounded-[24px] p-5 sm:grid-cols-2 sm:p-6">
            <figure className={`${cara === "anverso" ? "" : "hidden"} space-y-2 sm:block`}>
              <VistaCarta carta={carta} mazo={mazo} cara="anverso" icono={icono} calidad="copia" version={version} className="mx-auto max-w-[260px]" />
              <figcaption className="tipo-micro text-center text-micro text-tinta-2">{t("comun.anverso")}</figcaption>
            </figure>
            <figure className={`${cara === "reverso" ? "" : "hidden"} space-y-2 sm:block`}>
              <VistaCarta carta={carta} mazo={mazo} cara="reverso" icono={icono} calidad="copia" version={version} className="mx-auto max-w-[260px]" />
              <figcaption className="tipo-micro text-center text-micro text-tinta-2">{t("comun.reverso")}</figcaption>
            </figure>
          </div>
          <div className="flex flex-wrap gap-2">
            {foto && (
              <>
            <Boton variante="secundario" tamano="sm" onClick={() => setEncuadre(true)}>
              ⤧ {t("cartas.encuadrar")}
            </Boton>
            <Boton variante="secundario" tamano="sm" onClick={girar} disabled={girando}>
              ↻ {t("cartas.girar")}
            </Boton>
            <Boton variante="secundario" tamano="sm" onClick={() => setEmojis(true)}>
              ☺ {t("cartas.adornos")}
            </Boton>
              </>
            )}
            <Boton
              variante="peligro"
              tamano="sm"
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
                  <Boton tamano="sm" variante="secundario" onClick={() => actualizar({ pppConfirmado: true })}>
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
          <section className="space-y-3 rounded-[var(--radius-carta)] bg-blanco p-5">
            <h2 className="tipo-subtitular text-lg">{t("fechas.titulo")}</h2>
            <SelectorFecha
              key={carta.id}
              idBase={`fecha-${carta.id}`}
              valor={carta.fecha}
              hoy={hoy}
              alCambiar={(f) => f && actualizar({ fecha: f, fuente: "manual", confianza: "alta", revisar: false, motivo: undefined })}
            />
            {carta.fuente && <p className="text-sm text-tinta-2">{t(`fechas.fuente.${carta.fuente}`)}</p>}
            {carta.revisar && (
              <Aviso
                tono="aviso"
                accion={
                  <Boton tamano="sm" variante="secundario" onClick={() => despachar({ tipo: "confirmarFecha", id: carta.id })}>
                    {t("fechas.confirmar")}
                  </Boton>
                }
              >
                {carta.motivo ? t(`fechas.motivo.${carta.motivo}`) : t("fechas.fuente.archivo")}
              </Aviso>
            )}
          </section>

          <section className="space-y-3 rounded-[var(--radius-carta)] bg-blanco p-5">
            <label htmlFor={`desc-${carta.id}`} className="tipo-subtitular block text-lg">
              {t("cartas.descripcion")}
            </label>
            <textarea
              id={`desc-${carta.id}`}
              value={carta.descripcion}
              maxLength={MAX_DESCRIPCION + 20}
              rows={2}
              onFocus={() => despachar({ tipo: "puntoDeshacer" })}
              onChange={(e) => actualizar({ descripcion: e.target.value.replace(/\n/g, " ") }, false)}
              aria-describedby={`desc-ayuda-${carta.id}`}
              className="w-full rounded-[12px] border-2 border-tinta bg-blanco px-3 py-2.5 text-base"
            />
            <div className="flex justify-between gap-3 text-sm">
              <span id={`desc-ayuda-${carta.id}`} className="text-tinta-2">
                {t("cartas.descripcionAyuda", { max: MAX_DESCRIPCION })}
              </span>
              <span className={[...carta.descripcion].length > MAX_DESCRIPCION ? "font-bold text-rojo-texto" : "text-tinta-2"}>
                {t("cartas.descripcionContador", { n: [...carta.descripcion].length, max: MAX_DESCRIPCION })}
              </span>
            </div>
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
            <Boton onClick={() => ir(indice + 1)}>
              {t("comun.siguiente")} →
            </Boton>
            <Boton
              variante="fantasma"
              disabled={!mazo.cartas.some((c) => !c.fecha)}
              onClick={() => {
                const i = siguienteSinFecha(cartas, indice);
                if (i >= 0) ir(i);
              }}
            >
              {t("fotos.siguienteSinFecha")}
            </Boton>
            <Boton variante="fantasma" disabled={!puedeDeshacer} onClick={() => despachar({ tipo: "deshacer" })}>
              ↶ {t("comun.deshacer")}
            </Boton>
          </nav>
          <p className="hidden text-sm text-tinta-2 lg:block">{t("cartas.atajos")}</p>
        </div>
      </div>

      {/* Tira de cartas */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <ul className="flex gap-2">
          {cartas.map((c, i) => (
            <TiraItem key={c.id} carta={c} activa={i === indice} version={versiones[c.id] ?? 0} alPulsar={() => setCartaActiva(c.id)} locale={locale} />
          ))}
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

function TiraItem({ carta, activa, alPulsar, version, locale }: { carta: Carta; activa: boolean; alPulsar: () => void; version: number; locale: string }) {
  const url = useUrlFoto(carta.id, "mini", version);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activa) ref.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activa]);
  return (
    <li className="shrink-0">
      <button
        ref={ref}
        type="button"
        onClick={alPulsar}
        aria-current={activa ? "true" : undefined}
        aria-label={`${carta.tipo === "foto" ? carta.nombreArchivo : carta.descripcion}${carta.fecha ? `, ${carta.fecha.anio}` : ""}`}
        lang={locale}
        className={`relative block h-[74px] w-[53px] overflow-hidden rounded-[8px] bg-papel-3 ${activa ? "outline outline-[3px] outline-offset-2 outline-tinta" : "opacity-80 hover:opacity-100"}`}
      >
        {carta.tipo === "texto" && <span className="absolute inset-0 grid place-items-center p-1 text-center text-[9px] font-semibold leading-tight">{carta.descripcion}</span>}
        {url && carta.tipo === "foto" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
        )}
        {!carta.fecha && <span className="absolute inset-x-0 bottom-0 bg-amarillo text-[10px] font-bold">?</span>}
      </button>
    </li>
  );
}
