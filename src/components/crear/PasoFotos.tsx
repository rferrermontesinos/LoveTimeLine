"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PROPORCION_CARTA } from "@config/print";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { Aviso, Pestana } from "@/components/ui/Piezas";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { fechaCorta, fechaLegible } from "@/domain/fechas/formato";
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { useMazo } from "@/lib/mazo/contexto";
import { esAproximada } from "@/lib/mazo/derivados";
import type { Carta, Mazo } from "@/lib/mazo/tipos";
import { desplazamiento, useCrear } from "./contexto";
import { EstadoImportacion, useElegirFotos, useImportacion } from "./importacion";
import { PanelColaboracion } from "./PanelColaboracion";
import { SelectorFecha } from "./SelectorFecha";

/** Cartas borradas de una vez: se puede deshacer mientras el mazo no cambie otra vez. */
interface Borrado {
  n: number;
  antes: Mazo;
  despues: Mazo | null;
}

/**
 * Paso 1: el permiso, elegir o soltar fotos y la cuadrícula del mazo ordenada por fecha, con las
 * que no tienen fecha al final. Solo una herramienta: seleccionar, para poner la misma fecha a
 * varias o borrarlas. La fecha de cada carta se completa en el paso 2.
 *
 * Con cartas en el mazo, lo primero que se ve son ellas (22-11-2026): sin la zona grande de soltar
 * ni la casilla ya marcada, y «Añadir fotos» junto al título de la cuadrícula.
 */
export function PasoFotos() {
  const t = useTranslations();
  const locale = useLocale();
  const { mazo, despachar } = useMazo();
  const { cotizacion, irAPaso, versiones, hoy } = useCrear();
  const { consentir, enEspera, intentosSinPermiso, tomarIntento, progreso } = useImportacion();
  const { entradas, elegirFotos, elegirCarpeta } = useElegirFotos();
  const id = useId();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [dialogoFecha, setDialogoFecha] = useState(false);
  const [fechaLote, setFechaLote] = useState<FechaCarta | null>(null);
  const [borrado, setBorrado] = useState<Borrado | null>(null);
  const permiso = useRef<HTMLLabelElement>(null);
  const casilla = useRef<HTMLInputElement>(null);
  const botonSeleccionar = useRef<HTMLButtonElement>(null);
  // Tras borrar con la selección, el foco va al «Deshacer» del aviso (la barra de la selección,
  // con el botón que tenía el foco, desaparece).
  const enfocarDeshacer = useRef(false);
  const consentido = !!mazo?.consentimientoFotos;
  const cartas = mazo?.cartas;
  const ordenadas = useMemo(() => ordenarPorFecha(cartas ?? []), [cartas]);

  // Un intento de añadir fotos sin el permiso, aquí o desde Cartas: la casilla se trae a la vista,
  // se enfoca y se sacude un poco, y dice qué falta.
  useEffect(() => {
    if (!tomarIntento() || consentido) return;
    const etiqueta = permiso.current;
    if (!etiqueta) return;
    const movimiento = desplazamiento();
    etiqueta.scrollIntoView({ block: "center", behavior: movimiento });
    casilla.current?.focus({ preventScroll: true });
    if (movimiento === "smooth" && typeof etiqueta.animate === "function") {
      etiqueta.animate([{ transform: "none" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "none" }], {
        duration: 420,
        easing: "ease-out",
      });
    }
  }, [intentosSinPermiso, tomarIntento, consentido]);

  // El mazo justo después de borrar: el «Deshacer» del aviso vale mientras siga igual.
  if (borrado && !borrado.despues && mazo && mazo !== borrado.antes) setBorrado({ ...borrado, despues: mazo });

  if (!mazo) return null;
  const conFecha = ordenadas.filter((c) => c.fecha);
  const sinFecha = ordenadas.filter((c) => !c.fecha);
  const resaltar = !consentido && (intentosSinPermiso > 0 || enEspera > 0);
  const borradoVigente = borrado && borrado.despues === mazo ? borrado : null;
  // Los textos de las cartas van en el idioma del mazo, que puede no ser el de la página.
  const lang = mazo.idiomaMazo.split("-")[0] !== locale.split("-")[0] ? mazo.idiomaMazo : undefined;

  const alternar = (cartaId: string) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(cartaId)) n.delete(cartaId);
      else n.add(cartaId);
      return n;
    });
  const salirDeSeleccion = () => {
    setModoSeleccion(false);
    setSeleccion(new Set());
  };
  const borrar = () => {
    const ids = [...seleccion];
    setBorrado({ n: ids.length, antes: mazo, despues: null });
    despachar({ tipo: "borrarCartas", ids });
    salirDeSeleccion();
    enfocarDeshacer.current = true;
  };
  /** Tras una acción de la selección, el foco no se pierde: vuelve a «Seleccionar». */
  const focoASeleccionar = () => requestAnimationFrame(() => botonSeleccionar.current?.focus());
  // También con todas borradas: si no, no habría forma de deshacerlo en el móvil.
  const avisoBorrado = borradoVigente && (
    <Aviso
      tono="exito"
      accion={
        <Boton
          ref={(el) => {
            if (el && enfocarDeshacer.current) {
              enfocarDeshacer.current = false;
              el.focus();
            }
          }}
          variante="secundario"
          tamano="sm"
          className="max-sm:min-h-11"
          onClick={() => {
            despachar({ tipo: "deshacer" });
            setBorrado(null);
            focoASeleccionar();
          }}
        >
          ↶ {t("comun.deshacer")}
        </Boton>
      }
    >
      <span className="font-semibold">{t("fotos.borradas", { n: borradoVigente.n })}</span>
    </Aviso>
  );
  const cuadricula = (lista: Carta[]) => (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
      {lista.map((c) => (
        <Miniatura
          key={c.id}
          carta={c}
          locale={locale}
          lang={lang}
          version={versiones[c.id] ?? 0}
          seleccionable={modoSeleccion}
          seleccionada={seleccion.has(c.id)}
          alPulsar={() => (modoSeleccion ? alternar(c.id) : irAPaso(2, c.id))}
        />
      ))}
    </ul>
  );

  const hayCartas = mazo.cartas.length > 0;

  return (
    <div className="space-y-6">
      {/* Las entradas de archivo ocultas, una sola vez: las abren los botones de cualquier estado. */}
      {entradas}
      <header className="space-y-2">
        <h1 className="tipo-titular text-[clamp(2.2rem,6vw,3.4rem)] leading-[0.95]">{t("fotos.titulo")}</h1>
        {/* Con cartas, cuántas faltan ya lo dice la barra de abajo. */}
        {!hayCartas && <p className="max-w-2xl text-md text-tinta-2">{t("fotos.texto", { minimo: cotizacion?.minimo ?? 0 })}</p>}
        {/* Quitar presión: vale un buen recuerdo aunque la foto no sea perfecta. La guía se abre en
            otra pestaña para no cortar una subida en marcha. En el móvil, con cartas ya, se queda en
            la pantalla vacía (allí se vio al empezar), para que las cartas quepan en la primera. */}
        <p data-testid="sin-presion" className={`max-w-2xl text-tinta-2 ${hayCartas ? "max-sm:hidden" : ""}`}>
          {t("fotos.sinPresion")}{" "}
          <a href={`/${locale}/guia-fotos`} target="_blank" rel="noopener" className="enlace whitespace-nowrap font-semibold">
            {t("fotos.guiaEnlace")}
            <span className="sr-only"> {t("comun.nuevaPestana")}</span>
          </a>
        </p>
      </header>

      {/* Permiso explícito antes de añadir fotos (RGPD). Si se intenta añadir sin él, se resalta y
          dice qué falta; lo que se haya soltado espera y se añade al marcarlo. Ya dado y con cartas,
          no ocupa sitio. */}
      {(!consentido || !hayCartas) && (
        <label
          ref={permiso}
          data-testid="permiso-fotos"
          className={`flex max-w-3xl cursor-pointer items-start gap-3 rounded-[14px] p-4 transition-[background-color,box-shadow] ${
            resaltar ? "bg-[#FFF4D6] shadow-[inset_0_0_0_3px_var(--color-amarillo)]" : "bg-blanco"
          }`}
        >
          <input
            ref={casilla}
            type="checkbox"
            checked={consentido}
            onChange={(e) => e.target.checked && consentir()}
            disabled={consentido}
            className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-tinta)]"
          />
          <span className="min-w-0">
            <span className="block text-sm leading-relaxed">{t("fotos.consentimiento")}</span>
            {resaltar && <span className="mt-1.5 block font-semibold">{enEspera > 0 ? t("fotos.enEspera", { n: enEspera }) : t("fotos.consentimientoFalta")}</span>}
          </span>
        </label>
      )}

      {/* Sin cartas: elegir fotos o una carpeta, en grande. Soltarlas funciona en toda la página
          (SoltarFotos), también con cartas. */}
      {!hayCartas && (
        <div className="relative overflow-hidden rounded-[var(--radius-carta)] border-[2.5px] border-dashed border-tinta/60 bg-blanco p-6 pl-16 pt-8 sm:p-8 sm:pl-20">
          <Pestana>1</Pestana>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex flex-wrap gap-2">
              <Boton onClick={elegirFotos}>{t("fotos.elegirFotos")}</Boton>
              {/* En el móvil no se elige una carpeta: allí se eligen las fotos de la galería. */}
              <Boton variante="secundario" onClick={elegirCarpeta} className="max-sm:hidden">
                {t("fotos.elegirCarpeta")}
              </Boton>
            </div>
            <p className="tipo-subtitular hidden text-lg sm:block">{t("fotos.arrastrar")}</p>
          </div>
          <p className="mt-4 text-sm text-tinta-2">{t("fotos.privacidad")}</p>
        </div>
      )}

      {/* Con cartas, su cabecera: «Tus cartas», añadir y seleccionar (en el móvil, solo los botones:
          cuántas hay ya lo dice la barra de abajo). Justo debajo, pedir fotos a otros con un enlace
          (si el servicio está configurado), en una línea discreta: va siempre en este mismo sitio
          del árbol, para que no se pliegue ni se recargue al llegar las primeras cartas; con otro
          mazo, empieza de cero. */}
      <div className="space-y-2">
        {hayCartas && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 id={`${id}-cartas`} className="tipo-subtitular text-xl max-sm:sr-only">
              {t("fotos.tusCartas")} <span className="text-tinta-2">· {mazo.cartas.length}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <Boton tamano="sm" className="max-sm:min-h-11" onClick={elegirFotos}>
                {t("fotos.anadirFotos")}
              </Boton>
              <Boton variante="secundario" tamano="sm" className="max-sm:hidden" onClick={elegirCarpeta}>
                {t("fotos.anadirCarpeta")}
              </Boton>
              <Boton
                ref={botonSeleccionar}
                variante={modoSeleccion ? "primario" : "secundario"}
                tamano="sm"
                className="max-sm:min-h-11"
                aria-pressed={modoSeleccion}
                onClick={() => (modoSeleccion ? salirDeSeleccion() : setModoSeleccion(true))}
              >
                {t("fotos.seleccionar")}
              </Boton>
            </div>
          </div>
        )}
        <PanelColaboracion key={mazo.id} mazoId={mazo.id} />
      </div>

      {!hayCartas ? (
        <>
          <EstadoImportacion />
          {avisoBorrado}
          {!progreso && enEspera === 0 && !borradoVigente && <p className="rounded-[14px] bg-papel-2 p-6 text-center text-tinta-2">{t("fotos.vacio")}</p>}
        </>
      ) : (
        <section aria-labelledby={`${id}-cartas`} className="space-y-4">
          <EstadoImportacion />
          {modoSeleccion && seleccion.size === 0 && <p className="text-sm text-tinta-2">{t("fotos.seleccionAyuda")}</p>}
          {avisoBorrado}

          {conFecha.length > 0 && cuadricula(conFecha)}
          {sinFecha.length > 0 && (
            <div className="space-y-3" data-testid="fotos-sin-fecha">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 border-amarillo pt-3">
                <h3 className="font-semibold">{t("fotos.sinFechaTitulo", { n: sinFecha.length })}</h3>
                <p className="text-sm text-tinta-2">{t("fotos.sinFechaAyuda")}</p>
              </div>
              {cuadricula(sinFecha)}
            </div>
          )}
        </section>
      )}

      {/* Acciones con la selección: encima de la barra de abajo, que dice su alto en --reserva-abajo. */}
      {modoSeleccion && seleccion.size > 0 && (
        <div
          className="sticky z-20 flex flex-wrap items-center gap-2 rounded-[16px] bg-tinta p-3 text-papel shadow-[var(--shadow-carta)]"
          style={{ bottom: "calc(var(--reserva-abajo, 0px) + 0.75rem)" }}
        >
          <span className="px-2 text-sm font-semibold">{t("fotos.seleccionadas", { n: seleccion.size })}</span>
          <span className="flex-1" />
          <Boton variante="acento" color="var(--color-amarillo)" tamano="sm" className="max-sm:min-h-11" onClick={() => setDialogoFecha(true)}>
            {t("fotos.ponerFecha")}
          </Boton>
          <Boton variante="acento" color="var(--color-papel)" tamano="sm" className="max-sm:min-h-11" onClick={borrar}>
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
                salirDeSeleccion();
                focoASeleccionar();
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

/**
 * Una carta de la cuadrícula: la foto (o el texto, en un recuerdo sin foto) con la fecha abajo.
 * Las fechas aproximadas, que solo quedan en mazos guardados antes del 20-11-2026, llevan «≈».
 */
function Miniatura({
  carta,
  locale,
  lang,
  version,
  seleccionable,
  seleccionada,
  alPulsar,
}: {
  carta: Carta;
  locale: string;
  lang: string | undefined;
  version: number;
  seleccionable: boolean;
  seleccionada: boolean;
  alPulsar: () => void;
}) {
  const t = useTranslations("fotos");
  const foto = carta.tipo === "foto" ? carta : null;
  const url = useUrlFoto(foto?.id ?? null, "mini", version);
  const aproximada = esAproximada(carta);
  const estadoFecha = carta.fecha ? (aproximada ? t("aproximada", { fecha: fechaLegible(carta.fecha, locale) }) : fechaLegible(carta.fecha, locale)) : t("sinFecha");
  const nombre = foto ? t("editar", { nombre: foto.nombreArchivo }) : t("recuerdoSinFoto", { texto: carta.descripcion });
  return (
    <li>
      <button
        type="button"
        onClick={alPulsar}
        aria-pressed={seleccionable ? seleccionada : undefined}
        aria-label={`${nombre}. ${estadoFecha}`}
        className={`group relative block w-full overflow-hidden rounded-[12px] text-left outline-offset-2 ${
          foto ? "bg-papel-3" : "bg-blanco shadow-[inset_0_0_0_2px_var(--color-linea)] transition-shadow hover:shadow-[inset_0_0_0_2px_var(--color-tinta)]"
        } ${seleccionada ? "outline outline-4 outline-cobalto" : ""}`}
      >
        {foto ? (
          <span className="block w-full" style={{ aspectRatio: PROPORCION_CARTA }}>
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" draggable={false} />
            )}
          </span>
        ) : (
          <span className="flex w-full items-center justify-center px-2.5 pb-8 pt-3" style={{ aspectRatio: PROPORCION_CARTA }}>
            <span lang={lang} className="line-clamp-5 break-words text-center text-[0.8rem] font-semibold leading-snug">
              {carta.descripcion}
            </span>
          </span>
        )}
        {seleccionable && (
          <span className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md border-2 border-papel text-sm font-bold ${seleccionada ? "bg-cobalto text-papel" : "bg-tinta/40"}`}>
            {seleccionada ? "✓" : ""}
          </span>
        )}
        <span
          className={`absolute inset-x-0 bottom-0 flex items-center px-2 text-[0.75rem] font-semibold ${
            !carta.fecha ? "bg-amarillo py-1.5 text-tinta" : foto ? "bg-gradient-to-t from-tinta/85 to-transparent pb-1.5 pt-5 text-papel" : "bg-papel-2 py-1.5"
          }`}
        >
          <span className="truncate">{carta.fecha ? `${aproximada ? "≈ " : ""}${fechaCorta(carta.fecha, locale)}` : t("sinFecha")}</span>
        </span>
      </button>
    </li>
  );
}
