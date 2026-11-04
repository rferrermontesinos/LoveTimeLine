"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { Aviso, Chip, Franja, Micro, Pestana } from "@/components/ui/Piezas";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { fechaCorta, fechaLegible } from "@/domain/fechas/formato";
import { siguienteSinFecha } from "@/domain/mazo/ordenar";
import { guardarFoto } from "@/lib/almacen/idb";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { archivosDeArrastre, concurrenciaRecomendada, enCola, esImagenCompatible, procesarArchivo } from "@/lib/importar/procesar";
import { useMazo } from "@/lib/mazo/contexto";
import { cartaDesdeFoto, proporcionReversoDe } from "@/lib/mazo/derivados";
import type { Carta } from "@/lib/mazo/tipos";
import { useCrear } from "./contexto";
import { SelectorFecha } from "./SelectorFecha";

interface Resumen {
  anadidas: number;
  repetidas: number;
  errores: number;
}

export function PasoFotos() {
  const t = useTranslations();
  const locale = useLocale();
  const { mazo, despachar, puedeDeshacer } = useMazo();
  const { cotizacion, irAPaso, versiones } = useCrear();
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [dialogoFecha, setDialogoFecha] = useState(false);
  const [fechaLote, setFechaLote] = useState<FechaCarta | null>(null);
  const inputFotos = useRef<HTMLInputElement>(null);
  const inputCarpeta = useRef<HTMLInputElement>(null);
  const hoy = useMemo(() => new Date(), []);

  const hashes = useMemo(() => new Set(mazo?.cartas.map((c) => c.hash)), [mazo?.cartas]);
  const consentido = !!mazo?.consentimientoFotos;

  const importar = useCallback(
    async (archivos: File[]) => {
      if (!mazo || archivos.length === 0) return;
      const imagenes = archivos.filter(esImagenCompatible);
      const vistos = new Set(hashes);
      const res: Resumen = { anadidas: 0, repetidas: 0, errores: archivos.length - imagenes.length };
      setResumen(null);
      setProgreso({ hechas: 0, total: imagenes.length });
      const propReverso = proporcionReversoDe(mazo);
      let lote: Carta[] = [];
      const volcar = () => {
        if (lote.length) despachar({ tipo: "anadirCartas", cartas: lote });
        lote = [];
      };
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
            lote.push(r.valor);
            if (lote.length >= 6) volcar();
          } else if (r.ok) res.repetidas++;
          else {
            res.errores++;
            console.warn("No se pudo leer", r.entrada.name, r.error);
          }
          setProgreso({ hechas, total: imagenes.length });
        },
      );
      volcar();
      setProgreso(null);
      setResumen(res);
    },
    [mazo, hashes, despachar, hoy],
  );

  if (!mazo) return null;
  const sinFecha = mazo.cartas.filter((c) => !c.fecha).length;
  const porRevisar = mazo.cartas.filter((c) => c.fecha && c.revisar).length;
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

      {progreso && (
        <div className="space-y-2" aria-live="polite">
          <Franja valor={progreso.total ? progreso.hechas / progreso.total : 0} etiqueta={t("fotos.procesando", progreso)} />
          <p className="text-sm font-semibold">{t("fotos.procesando", progreso)}</p>
        </div>
      )}
      {resumen && (
        <Aviso tono={resumen.errores ? "aviso" : "exito"}>
          <span className="font-semibold">{t("fotos.procesadas", { n: resumen.anadidas })}</span>
          {resumen.repetidas > 0 && <> · {t("fotos.repetidas", { n: resumen.repetidas })}</>}
          {resumen.errores > 0 && <> · {t("fotos.errores", { n: resumen.errores })}</>}
        </Aviso>
      )}

      {/* Herramientas */}
      {mazo.cartas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={sinFecha ? "var(--color-amarillo)" : undefined}>{t("fotos.sinFechaCuenta", { n: sinFecha })}</Chip>
          <Chip color={porRevisar ? "#FBE7E4" : undefined}>{t("fotos.revisarCuenta", { n: porRevisar })}</Chip>
          <span className="flex-1" />
          <Boton variante="fantasma" tamano="sm" onClick={() => despachar({ tipo: "ordenarPorFecha" })}>
            {t("fotos.ordenar")}
          </Boton>
          <Boton
            variante="fantasma"
            tamano="sm"
            disabled={sinFecha === 0}
            onClick={() => {
              const i = siguienteSinFecha(mazo.cartas, -1);
              if (i >= 0) irAPaso(2, mazo.cartas[i]!.id);
            }}
          >
            {t("fotos.siguienteSinFecha")}
          </Boton>
          <Boton variante={modoSeleccion ? "primario" : "secundario"} tamano="sm" aria-pressed={modoSeleccion} onClick={() => { setModoSeleccion((m) => !m); setSeleccion(new Set()); }}>
            {t("fotos.seleccionar")}
          </Boton>
          <Boton variante="fantasma" tamano="sm" disabled={!puedeDeshacer} onClick={() => despachar({ tipo: "deshacer" })}>
            ↶ {t("comun.deshacer")}
          </Boton>
        </div>
      )}

      {mazo.cartas.length === 0 && !progreso ? (
        <p className="rounded-[14px] bg-papel-2 p-6 text-center text-tinta-2">{t("fotos.vacio")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8" aria-label={t("fotos.titulo")}>
          {mazo.cartas.map((c) => (
            <Miniatura
              key={c.id}
              carta={c}
              locale={locale}
              version={versiones[c.id] ?? 0}
              seleccionable={modoSeleccion}
              seleccionada={seleccion.has(c.id)}
              alPulsar={() => (modoSeleccion ? alternar(c.id) : irAPaso(2, c.id))}
            />
          ))}
        </ul>
      )}

      {/* Acciones en lote */}
      {modoSeleccion && seleccion.size > 0 && (
        <div className="sticky bottom-24 z-20 flex flex-wrap items-center gap-2 rounded-[16px] bg-tinta p-3 text-papel shadow-[var(--shadow-carta)]">
          <span className="px-2 text-sm font-semibold">{t("fotos.seleccionadas", { n: seleccion.size })}</span>
          <span className="flex-1" />
          <Boton variante="acento" color="var(--color-amarillo)" tamano="sm" onClick={() => setDialogoFecha(true)}>
            {t("fotos.ponerFecha")}
          </Boton>
          <Boton
            variante="acento"
            color="var(--color-papel)"
            tamano="sm"
            onClick={() => {
              despachar({ tipo: "borrarCartas", ids: [...seleccion] });
              setSeleccion(new Set());
            }}
          >
            {t("fotos.borrarSeleccion")}
          </Boton>
          <Boton variante="fantasma" tamano="sm" className="text-papel hover:bg-tinta-hover" onClick={() => setSeleccion(new Set())}>
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

function Miniatura({
  carta,
  locale,
  version,
  seleccionable,
  seleccionada,
  alPulsar,
}: {
  carta: Carta;
  locale: string;
  version: number;
  seleccionable: boolean;
  seleccionada: boolean;
  alPulsar: () => void;
}) {
  const t = useTranslations("fotos");
  const url = useUrlFoto(carta.id, "mini", version);
  const confianza = !carta.fecha ? null : carta.revisar ? "baja" : carta.confianza === "alta" ? "alta" : "media";
  const color = confianza === "alta" ? "var(--color-verde)" : confianza === "media" ? "var(--color-amarillo)" : "var(--color-rojo)";
  return (
    <li>
      <button
        type="button"
        onClick={alPulsar}
        aria-pressed={seleccionable ? seleccionada : undefined}
        aria-label={`${t("editar", { nombre: carta.nombreArchivo })}. ${carta.fecha ? fechaLegible(carta.fecha, locale) : t("sinFecha")}`}
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
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: confianza ? color : "var(--color-papel)", boxShadow: "0 0 0 1.5px rgba(20,20,20,.6)" }} />
          <span className="truncate">{carta.fecha ? fechaCorta(carta.fecha, locale) : t("sinFecha")}</span>
        </span>
      </button>
      {confianza && (
        <Micro as="span" className="sr-only">
          {t(`confianza.${confianza}`)}
        </Micro>
      )}
    </li>
  );
}
