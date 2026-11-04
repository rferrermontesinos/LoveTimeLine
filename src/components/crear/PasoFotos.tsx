"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { Aviso, Chip, Franja, Micro, Pestana } from "@/components/ui/Piezas";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { fechaCorta, fechaLegible } from "@/domain/fechas/formato";
import { aceptableEnLote, sesionDeEscaneo } from "@/domain/fechas/sesion";
import { esErrorDeEspacio, guardarFoto } from "@/lib/almacen/idb";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { archivosDeArrastre, concurrenciaRecomendada, enCola, esImagenCompatible, procesarArchivo } from "@/lib/importar/procesar";
import { useMazo } from "@/lib/mazo/contexto";
import { cartaDesdeFoto, proporcionReversoDe } from "@/lib/mazo/derivados";
import { ideasParaProponer } from "@/lib/mazo/recuerdos";
import { esFoto, type Carta, type CartaFoto, type CartaTexto, type Mazo } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";
import { SelectorFecha } from "./SelectorFecha";

interface Resumen {
  anadidas: number;
  repetidas: number;
  errores: number;
  /** Fotos que no se han podido guardar porque no queda espacio en el dispositivo. */
  sinEspacio: number;
}

/** Fechas sugeridas puestas de una vez: se puede deshacer mientras el mazo no cambie otra vez. */
interface LoteSugeridas {
  n: number;
  antes: Mazo;
  despues: Mazo | null;
}

/** Cartas sin fecha que tienen al menos una fecha sugerida. */
const conSugerencia = (c: Carta) => !c.fecha && (c.sugerencias?.length ?? 0) > 0;

export function PasoFotos() {
  const t = useTranslations();
  const locale = useLocale();
  const { mazo, despachar, puedeDeshacer } = useMazo();
  const { cotizacion, irAPaso, irASiguientePendiente, pendientes, versiones, hoy, abrirRecuerdo, recuerdoAnadido } = useCrear();
  const id = useId();
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [dialogoFecha, setDialogoFecha] = useState(false);
  const [fechaLote, setFechaLote] = useState<FechaCarta | null>(null);
  const [loteSugeridas, setLoteSugeridas] = useState<LoteSugeridas | null>(null);
  const inputFotos = useRef<HTMLInputElement>(null);
  const inputCarpeta = useRef<HTMLInputElement>(null);
  // Solo se confirma aquí lo añadido durante esta visita al paso, no un recuerdo de antes.
  const [anadidoAlEntrar] = useState(recuerdoAnadido);

  const hashes = useMemo(() => new Set(mazo?.cartas.filter(esFoto).map((c) => c.hash)), [mazo?.cartas]);
  const consentido = !!mazo?.consentimientoFotos;

  const importar = useCallback(
    async (archivos: File[]) => {
      if (!mazo || archivos.length === 0) return;
      const imagenes = archivos.filter(esImagenCompatible);
      const vistos = new Set(hashes);
      const res: Resumen = { anadidas: 0, repetidas: 0, errores: archivos.length - imagenes.length, sinEspacio: 0 };
      setResumen(null);
      setLoteSugeridas(null);
      setProgreso({ hechas: 0, total: imagenes.length });
      const propReverso = proporcionReversoDe(mazo);
      let hechas = 0;
      await enCola(
        imagenes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        concurrenciaRecomendada(),
        async (archivo) => {
          const foto = await procesarArchivo(archivo, hoy);
          if (vistos.has(foto.hash)) return null;
          vistos.add(foto.hash);
          await guardarFoto(foto.id, foto.copia, foto.mini);
          return cartaDesdeFoto(foto, propReverso, Date.now());
        },
        (r) => {
          hechas++;
          if (r.ok && r.valor) {
            res.anadidas++;
            // Cada carta entra en el mazo en cuanto su foto está guardada: si la subida se corta
            // (se cierra la pestaña, se va la batería), lo subido hasta ahí ya está en el mazo.
            despachar({ tipo: "anadirCartas", cartas: [r.valor] });
          } else if (r.ok) res.repetidas++;
          else if (esErrorDeEspacio(r.error)) res.sinEspacio++;
          else {
            res.errores++;
            console.warn("No se pudo leer", r.entrada.name, r.error);
          }
          setProgreso({ hechas, total: imagenes.length });
        },
      );
      setProgreso(null);
      setResumen(res);
    },
    [mazo, hashes, despachar, hoy],
  );

  // El mazo justo después de poner las sugeridas: el «Deshacer» del aviso vale mientras siga igual.
  if (loteSugeridas && !loteSugeridas.despues && mazo && mazo !== loteSugeridas.antes) setLoteSugeridas({ ...loteSugeridas, despues: mazo });

  if (!mazo) return null;
  // Los recuentos y la cuadrícula cuentan todas las cartas: fotos y recuerdos sin foto.
  const cartas = mazo.cartas;
  const conFecha = cartas.filter((c) => c.fecha).length;
  const sugeridas = cartas.filter(conSugerencia).length;
  const sinFecha = cartas.length - conFecha - sugeridas;
  // Solo en mazos guardados antes de que las fechas dudosas dejaran de rellenarse solas.
  const porRevisar = cartas.filter((c) => c.fecha && c.revisar).length;
  // Las ideas y los textos de las cartas van en el idioma del mazo, que puede no ser el de la página.
  const lang = mazo.idiomaMazo.split("-")[0] !== locale.split("-")[0] ? mazo.idiomaMazo : undefined;
  const ideas = resumen && resumen.anadidas > 0 ? ideasParaProponer(mazo.idiomaMazo, cartas) : [];
  const anadido = recuerdoAnadido && recuerdoAnadido !== anadidoAlEntrar && cartas.some((c) => c.id === recuerdoAnadido.id) ? recuerdoAnadido : null;
  const sesion = sesionDeEscaneo(mazo.cartas);
  // De una vez solo las que no son recientes: esas pueden ser la fecha de una copia, un escaneo o un reenvío.
  const idsSugeridas = mazo.cartas.filter((c) => aceptableEnLote(c, hoy)).map((c) => c.id);
  const recientes = sugeridas - idsSugeridas.length;
  const seleccionSugeridas = mazo.cartas.filter((c) => seleccion.has(c.id) && aceptableEnLote(c, hoy)).map((c) => c.id);
  const loteVigente = loteSugeridas && loteSugeridas.despues === mazo ? loteSugeridas : null;

  /** Acepta la primera sugerencia de cada carta, en un solo paso de deshacer. */
  const usarSugeridas = (ids: string[]) => {
    if (ids.length === 0) return;
    setLoteSugeridas({ n: ids.length, antes: mazo, despues: null });
    despachar({ tipo: "aceptarSugerencia", ids });
  };
  const alternar = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="tipo-titular text-[clamp(2.2rem,6vw,3.4rem)] leading-[0.95]">{t("fotos.titulo")}</h1>
        <p className="max-w-2xl text-md text-tinta-2">{t("fotos.texto", { minimo: cotizacion?.minimo ?? 0 })}</p>
      </header>

      {/* Permiso explícito antes de añadir fotos (RGPD) */}
      <label className="flex max-w-3xl cursor-pointer items-start gap-3 rounded-[14px] bg-blanco p-4">
        <input
          type="checkbox"
          checked={consentido}
          onChange={(e) => e.target.checked && despachar({ tipo: "consentir", ahora: Date.now() })}
          disabled={consentido}
          className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-tinta)]"
        />
        <span className="text-sm leading-relaxed">{t("fotos.consentimiento")}</span>
      </label>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
      {/* Zona para soltar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (consentido) setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setArrastrando(false);
          if (!consentido) return;
          void importar(await archivosDeArrastre(e.dataTransfer));
        }}
        className={`relative overflow-hidden rounded-[var(--radius-carta)] border-[2.5px] border-dashed p-6 pl-16 pt-8 transition-colors sm:p-10 sm:pl-20 ${
          arrastrando ? "border-cobalto bg-[#E8EDFD]" : consentido ? "border-tinta/60 bg-blanco" : "border-tinta/30 bg-blanco"
        }`}
      >
        <Pestana color={consentido ? "var(--color-rosa)" : "var(--color-papel-3)"}>1</Pestana>
        <p className={`tipo-subtitular text-lg ${consentido ? "" : "text-tinta-2"}`}>{arrastrando ? t("fotos.soltarActivo") : t("fotos.soltar")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton onClick={() => inputFotos.current?.click()} disabled={!consentido || !!progreso}>
            {t("fotos.elegirFotos")}
          </Boton>
          <Boton variante="secundario" onClick={() => inputCarpeta.current?.click()} disabled={!consentido || !!progreso} className="hidden sm:inline-flex">
            {t("fotos.elegirCarpeta")}
          </Boton>
        </div>
        <input
          ref={inputFotos}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="entrada-fotos"
          onChange={(e) => {
            void importar([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <input
          ref={inputCarpeta}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            void importar([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <p className={`mt-4 text-sm ${consentido ? "text-tinta-2" : "font-semibold text-tinta"}`}>{consentido ? t("fotos.privacidad") : t("fotos.consentimientoFalta")}</p>
      </div>

      {/* Recuerdos sin foto: no necesitan el permiso de las fotos */}
      <section aria-labelledby={`${id}-sin-foto`} className="flex flex-col gap-3 rounded-[var(--radius-carta)] bg-blanco p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-12 w-9 shrink-0 place-items-center rounded-[6px] border-2 border-tinta bg-papel text-[0.7rem] font-bold">
            Aa
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={`${id}-sin-foto`} className="tipo-subtitular text-lg">
              {t("fotos.sinFoto.titulo")}
            </h2>
            <p className="text-sm text-tinta-2">{t("fotos.sinFoto.texto")}</p>
          </div>
        </div>
        <Boton variante="secundario" tamano="sm" className="mt-auto self-start max-sm:min-h-11" onClick={() => abrirRecuerdo()}>
          + {t("crear.recuerdo.boton")}
        </Boton>
        {anadido && (
          <p className="text-sm font-semibold text-verde-texto">
            ✓ <span lang={lang}>{t("crear.recuerdo.anadido", { texto: anadido.texto })}</span>
          </p>
        )}
      </section>
      </div>

      {progreso && (
        <div className="space-y-2" aria-live="polite">
          <Franja valor={progreso.total ? progreso.hechas / progreso.total : 0} etiqueta={t("fotos.procesando", progreso)} />
          <p className="text-sm font-semibold">{t("fotos.procesando", progreso)}</p>
        </div>
      )}
      {resumen && (
        <Aviso tono={resumen.sinEspacio ? "error" : resumen.errores ? "aviso" : "exito"}>
          <span className="font-semibold">{t("fotos.procesadas", { n: resumen.anadidas })}</span>
          {resumen.repetidas > 0 && <> · {t("fotos.repetidas", { n: resumen.repetidas })}</>}
          {resumen.errores > 0 && <> · {t("fotos.errores", { n: resumen.errores })}</>}
          {resumen.sinEspacio > 0 && <> · {t("fotos.sinEspacio", { n: resumen.sinEspacio })}</>}
        </Aviso>
      )}
      {ideas.length > 0 && (
        <section aria-labelledby={`${id}-pregunta`} className="space-y-2 rounded-[14px] bg-papel-2 p-4" data-testid="ideas-tras-subir">
          <h2 id={`${id}-pregunta`} className="font-semibold">
            {t("fotos.sinFoto.pregunta")}
          </h2>
          <p className="text-sm text-tinta-2">{t("fotos.sinFoto.preguntaAyuda")}</p>
          <ul className="flex flex-wrap gap-2">
            {ideas.map((i) => (
              <li key={i}>
                <button type="button" lang={lang} onClick={() => abrirRecuerdo(i)} className={CLASES_IDEA}>
                  {i}
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => abrirRecuerdo()} className={CLASES_IDEA}>
                + {t("fotos.sinFoto.otro")}
              </button>
            </li>
          </ul>
        </section>
      )}

      {/* Herramientas: cuántas tienen fecha, sugerencias y acciones */}
      {cartas.length > 0 && (
        <div className="space-y-3">
          <ul className="flex flex-wrap items-center gap-2" aria-label={t("fotos.resumenFechas")}>
            <li>
              <Chip>
                <Punto estado="fecha" />
                {t("fotos.conFechaCuenta", { n: conFecha })}
              </Chip>
            </li>
            {sugeridas > 0 && (
              <li>
                <Chip color="#FFF4D6">
                  <Punto estado="sugerida" />
                  {t("fotos.sugeridasCuenta", { n: sugeridas })}
                </Chip>
              </li>
            )}
            <li>
              <Chip color={sinFecha ? "var(--color-amarillo)" : undefined}>{t("fotos.sinFechaCuenta", { n: sinFecha })}</Chip>
            </li>
            {porRevisar > 0 && (
              <li>
                <Chip color="#FBE7E4">{t("fotos.revisarCuenta", { n: porRevisar })}</Chip>
              </li>
            )}
          </ul>

          {sesion && <Aviso tono="aviso">{t("fotos.sesionEscaneo", { n: sesion.fotos, fecha: fechaLegible(sesion.dia, locale) })}</Aviso>}

          {loteVigente ? (
            <Aviso
              tono="exito"
              accion={
                <Boton
                  variante="secundario"
                  tamano="sm"
                  className="max-sm:min-h-11"
                  onClick={() => {
                    despachar({ tipo: "deshacer" });
                    setLoteSugeridas(null);
                  }}
                >
                  ↶ {t("comun.deshacer")}
                </Boton>
              }
            >
              <span className="font-semibold">{t("fotos.sugeridasUsadas", { n: loteVigente.n })}</span>
            </Aviso>
          ) : (
            sugeridas > 0 && (
              <Aviso
                tono="info"
                accion={
                  idsSugeridas.length > 0 ? (
                    <Boton tamano="sm" className="max-sm:min-h-11 max-sm:w-full" onClick={() => usarSugeridas(idsSugeridas)}>
                      {t("fotos.usarSugeridas", { n: idsSugeridas.length })}
                    </Boton>
                  ) : undefined
                }
              >
                {idsSugeridas.length > 0 ? t("fotos.sugeridasAyuda") : t("fotos.soloSeguras")}
                {recientes > 0 && <> {t("fotos.recientesAparte", { n: recientes })}</>}
              </Aviso>
            )
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="fantasma" tamano="sm" className="max-sm:min-h-11" onClick={() => despachar({ tipo: "ordenarPorFecha" })}>
              {t("fotos.ordenar")}
            </Boton>
            <Boton variante="fantasma" tamano="sm" className="max-sm:min-h-11" disabled={pendientes.length === 0} onClick={() => irASiguientePendiente()}>
              {t("fotos.irAPendientes")}
            </Boton>
            <Boton
              variante={modoSeleccion ? "primario" : "secundario"}
              tamano="sm"
              className="max-sm:min-h-11"
              aria-pressed={modoSeleccion}
              onClick={() => {
                setModoSeleccion((m) => !m);
                setSeleccion(new Set());
              }}
            >
              {t("fotos.seleccionar")}
            </Boton>
            <Boton variante="fantasma" tamano="sm" className="max-sm:min-h-11" disabled={!puedeDeshacer} onClick={() => despachar({ tipo: "deshacer" })}>
              ↶ {t("comun.deshacer")}
            </Boton>
          </div>
        </div>
      )}

      {mazo.cartas.length === 0 && !progreso ? (
        <p className="rounded-[14px] bg-papel-2 p-6 text-center text-tinta-2">{t("fotos.vacio")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8" aria-label={t("fotos.tusCartas")}>
          {cartas.map((c) =>
            esFoto(c) ? (
              <Miniatura
                key={c.id}
                carta={c}
                locale={locale}
                version={versiones[c.id] ?? 0}
                seleccionable={modoSeleccion}
                seleccionada={seleccion.has(c.id)}
                alPulsar={() => (modoSeleccion ? alternar(c.id) : irAPaso(2, c.id))}
              />
            ) : (
              <MiniaturaTexto
                key={c.id}
                carta={c}
                locale={locale}
                lang={lang}
                seleccionable={modoSeleccion}
                seleccionada={seleccion.has(c.id)}
                alPulsar={() => (modoSeleccion ? alternar(c.id) : irAPaso(2, c.id))}
              />
            ),
          )}
        </ul>
      )}

      {/* Acciones en lote */}
      {modoSeleccion && seleccion.size > 0 && (
        <div className="sticky bottom-24 z-20 flex flex-wrap items-center gap-2 rounded-[16px] bg-tinta p-3 text-papel shadow-[var(--shadow-carta)]">
          <span className="px-2 text-sm font-semibold">{t("fotos.seleccionadas", { n: seleccion.size })}</span>
          <span className="flex-1" />
          <Boton variante="acento" color="var(--color-amarillo)" tamano="sm" className="max-sm:min-h-11" onClick={() => setDialogoFecha(true)}>
            {t("fotos.ponerFecha")}
          </Boton>
          {seleccionSugeridas.length > 0 && (
            <Boton
              variante="acento"
              color="var(--color-papel)"
              tamano="sm"
              className="max-sm:min-h-11"
              onClick={() => {
                usarSugeridas(seleccionSugeridas);
                setSeleccion(new Set());
                setModoSeleccion(false);
              }}
            >
              {t("fotos.usarSugeridas", { n: seleccionSugeridas.length })}
            </Boton>
          )}
          <Boton
            variante="acento"
            color="var(--color-papel)"
            tamano="sm"
            className="max-sm:min-h-11"
            onClick={() => {
              despachar({ tipo: "borrarCartas", ids: [...seleccion] });
              setSeleccion(new Set());
            }}
          >
            {t("fotos.borrarSeleccion")}
          </Boton>
          {/* Sobre la barra oscura: el color del texto de la variante fantasma se fuerza a papel. */}
          <Boton variante="fantasma" tamano="sm" className="max-sm:min-h-11 !text-papel hover:!bg-tinta-hover" onClick={() => setSeleccion(new Set())}>
            {t("fotos.quitarSeleccion")}
          </Boton>
        </div>
      )}

      <Dialogo
        abierto={dialogoFecha}
        alCerrar={() => setDialogoFecha(false)}
        titulo={t("fechas.dialogoTitulo")}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setDialogoFecha(false)}>
              {t("comun.cancelar")}
            </Boton>
            <Boton
              disabled={!fechaLote}
              onClick={() => {
                if (!fechaLote) return;
                despachar({ tipo: "ponerFecha", ids: [...seleccion], fecha: fechaLote });
                setDialogoFecha(false);
                setSeleccion(new Set());
                setModoSeleccion(false);
              }}
            >
              {t("fechas.aplicarA", { n: seleccion.size })}
            </Boton>
          </>
        }
      >
        <SelectorFecha valor={fechaLote} alCambiar={setFechaLote} hoy={hoy} idBase="fecha-lote" />
      </Dialogo>
    </div>
  );
}

/** Las ideas de recuerdo como chips: mismo aspecto que en el diálogo, con 44 px de alto en el móvil. */
const CLASES_IDEA = "min-h-10 rounded-full border-2 border-linea bg-blanco px-3.5 text-left text-sm font-semibold transition-colors hover:border-tinta max-sm:min-h-11";

/** Punto de la miniatura y de los contadores: lleno con fecha, en anillo si solo hay sugerencia. */
function Punto({ estado, color = "var(--color-verde)" }: { estado: "fecha" | "sugerida"; color?: string }) {
  return estado === "fecha" ? (
    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, boxShadow: "0 0 0 1.5px rgba(20,20,20,.6)" }} />
  ) : (
    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-current" />
  );
}

function Miniatura({
  carta,
  locale,
  version,
  seleccionable,
  seleccionada,
  alPulsar,
}: {
  carta: CartaFoto;
  locale: string;
  version: number;
  seleccionable: boolean;
  seleccionada: boolean;
  alPulsar: () => void;
}) {
  const t = useTranslations("fotos");
  const tf = useTranslations("fechas");
  const url = useUrlFoto(carta.id, "mini", version);
  const sugerencia = !carta.fecha ? (carta.sugerencias?.[0] ?? null) : null;
  const confianza = carta.fecha ? (carta.revisar ? "baja" : carta.confianza === "alta" ? "alta" : "media") : sugerencia ? "sugerida" : null;
  const color = confianza === "alta" ? "var(--color-verde)" : confianza === "media" ? "var(--color-amarillo)" : "var(--color-rojo)";
  const estadoFecha = carta.fecha
    ? fechaLegible(carta.fecha, locale)
    : sugerencia
      ? t("sugerida", { fecha: fechaLegible(sugerencia.fecha, locale) })
      : t("sinFecha");
  return (
    <li>
      <button
        type="button"
        onClick={alPulsar}
        aria-pressed={seleccionable ? seleccionada : undefined}
        aria-label={`${t("editar", { nombre: carta.nombreArchivo })}. ${estadoFecha}`}
        className={`group relative block w-full overflow-hidden rounded-[12px] bg-papel-3 text-left outline-offset-2 ${seleccionada ? "outline outline-4 outline-cobalto" : ""}`}
      >
        <span className="block aspect-[63/88] w-full">
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" draggable={false} />
          )}
        </span>
        {carta.destacada && (
          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-tinta text-[13px] text-rosa" title={t("estrella")}>
            ★
          </span>
        )}
        {seleccionable && (
          <span className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md border-2 border-papel text-sm font-bold ${seleccionada ? "bg-cobalto text-papel" : "bg-tinta/40"}`}>
            {seleccionada ? "✓" : ""}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-tinta/85 to-transparent px-2 pb-1.5 pt-5 text-[0.75rem] font-semibold text-papel">
          {carta.fecha ? <Punto estado="fecha" color={color} /> : sugerencia ? <Punto estado="sugerida" /> : null}
          <span className="truncate">
            {carta.fecha ? fechaCorta(carta.fecha, locale) : sugerencia ? t("sugeridaCorta", { fecha: fechaCorta(sugerencia.fecha, locale) }) : t("sinFecha")}
          </span>
        </span>
      </button>
      {confianza && (
        <Micro as="span" className="sr-only">
          {/* Con fecha, de dónde sale (una sugerida aceptada dice la suya, no «de la foto»). */}
          {carta.fecha && !carta.revisar && carta.fuente ? tf(`fuente.${carta.fuente}`) : t(`confianza.${confianza}`)}
        </Micro>
      )}
    </li>
  );
}

/** Recuerdo sin foto en la cuadrícula: su texto sobre papel y, abajo, la fecha como en las fotos. */
function MiniaturaTexto({
  carta,
  locale,
  lang,
  seleccionable,
  seleccionada,
  alPulsar,
}: {
  carta: CartaTexto;
  locale: string;
  lang: string | undefined;
  seleccionable: boolean;
  seleccionada: boolean;
  alPulsar: () => void;
}) {
  const t = useTranslations("fotos");
  const estadoFecha = carta.fecha ? fechaLegible(carta.fecha, locale) : t("sinFecha");
  return (
    <li>
      <button
        type="button"
        onClick={alPulsar}
        aria-pressed={seleccionable ? seleccionada : undefined}
        aria-label={`${t("recuerdoSinFoto", { texto: carta.descripcion })}. ${estadoFecha}`}
        className={`group relative block w-full overflow-hidden rounded-[12px] bg-blanco text-left shadow-[inset_0_0_0_2px_var(--color-linea)] outline-offset-2 transition-shadow hover:shadow-[inset_0_0_0_2px_var(--color-tinta)] ${seleccionada ? "outline outline-4 outline-cobalto" : ""}`}
      >
        <span className="flex aspect-[63/88] w-full items-center justify-center px-2.5 pb-8 pt-3">
          <span lang={lang} className="line-clamp-5 break-words text-center text-[0.8rem] font-semibold leading-snug">
            {carta.descripcion}
          </span>
        </span>
        {carta.destacada && (
          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-tinta text-[13px] text-rosa" title={t("estrella")}>
            ★
          </span>
        )}
        {seleccionable && (
          <span className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md border-2 border-papel text-sm font-bold ${seleccionada ? "bg-cobalto text-papel" : "bg-tinta/40"}`}>
            {seleccionada ? "✓" : ""}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 rounded-b-[12px] bg-papel-2 px-2 py-1.5 text-[0.75rem] font-semibold">
          {carta.fecha && <Punto estado="fecha" />}
          <span className="truncate">{carta.fecha ? fechaCorta(carta.fecha, locale) : t("sinFecha")}</span>
        </span>
      </button>
    </li>
  );
}
