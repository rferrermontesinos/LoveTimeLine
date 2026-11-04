"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BRAND_NAME } from "@config/brand";
import { PRINT } from "@config/print";
import { VistaCaja } from "@/components/carta/VistaCaja";
import { Boton } from "@/components/ui/Boton";
import { Aviso, Interruptor } from "@/components/ui/Piezas";
import { baseMazo, formatearImporte, precioDeExtra } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { guardarFoto } from "@/lib/almacen/idb";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { esImagenCompatible, procesarArchivo } from "@/lib/importar/procesar";
import { useMazo } from "@/lib/mazo/contexto";
import { cajaPropia, cartaPortada, esCajaPersonalizada, extraCajaPersonalizada, fotoCaja, pppFotoCaja, proporcionCaja } from "@/lib/mazo/derivados";
import { esFoto, type FotoCaja } from "@/lib/mazo/tipos";
import { desplazamiento, useCrear } from "./contexto";

type Propia = Extract<FotoCaja, { origen: "propia" }>;

/**
 * La caja, en el paso Estilo: la de siempre va incluida; con el interruptor se pide la
 * personalizada (el extra del catálogo con efecto «caja-personalizada»), que lleva la foto de la
 * portada salvo que se elija otra del mazo o se suba una aparte (que no es carta). Quitar el
 * extra no borra la foto elegida, por si se vuelve a poner.
 */
export function BloqueCaja() {
  const t = useTranslations("estilo");
  const tf = useTranslations("fotos");
  const locale = useLocale();
  const { mazo, despachar } = useMazo();
  const { catalogo, cotizacion, versiones, hoy, ancla } = useCrear();
  const id = useId();
  const raiz = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"libre" | "subiendo" | "error">("libre");
  // La última foto propia de esta visita: sigue elegible aunque se pruebe con otra del mazo.
  const [ultimaPropia, setUltimaPropia] = useState<Propia | null>(mazo?.caja?.origen === "propia" ? mazo.caja : null);

  // Desde Pedido («Cambiar foto») se llega directamente aquí, con el foco en el bloque.
  useEffect(() => {
    if (ancla !== "caja") return;
    raiz.current?.scrollIntoView({ block: "start", behavior: desplazamiento() });
    titulo.current?.focus({ preventScroll: true });
  }, [ancla]);

  if (!mazo || !cotizacion) return null;
  const extra = extraCajaPersonalizada(catalogo);
  const personalizada = esCajaPersonalizada(mazo, catalogo);
  const propia = mazo.caja?.origen === "propia" ? mazo.caja : ultimaPropia;
  const portada = cartaPortada(mazo);
  const foto = fotoCaja(mazo);
  const ppp = foto ? pppFotoCaja(foto, proporcionCaja(mazo)) : null;
  const consentido = !!mazo.consentimientoFotos;
  const ponerCaja = (caja: FotoCaja | null) => despachar({ tipo: "ponerCaja", caja });

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!esImagenCompatible(archivo)) {
      setEstado("error");
      return;
    }
    setEstado("subiendo");
    try {
      const f = await procesarArchivo(archivo, hoy);
      await guardarFoto(f.id, f.copia, f.mini);
      const caja = cajaPropia(f, proporcionCaja(mazo));
      setUltimaPropia(caja);
      ponerCaja(caja);
      setEstado("libre");
    } catch (e) {
      console.warn("No se pudo preparar la foto de la caja", e);
      setEstado("error");
    }
  };

  return (
    <section ref={raiz} aria-labelledby={`${id}-titulo`} className="scroll-mt-36 space-y-3" data-testid="bloque-caja">
      <div>
        <h2 ref={titulo} id={`${id}-titulo`} tabIndex={-1} className="tipo-subtitular text-lg outline-none">
          {t("caja")}
        </h2>
        <p className="mt-1 text-sm text-tinta-2">{t("cajaAyuda")}</p>
      </div>

      <div className="space-y-4 rounded-[16px] bg-blanco p-4">
        <div className="flex items-start gap-4">
          <div className="w-24 shrink-0 sm:w-28">
            <VistaCaja
              mazo={mazo}
              catalogo={catalogo}
              cara="anverso"
              version={foto ? (versiones[foto.id] ?? 0) : 0}
              etiquetas={{ personalizada: `${t("caja")}: ${mazo.titulo}`, generica: `${t("caja")}: ${BRAND_NAME}` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            {extra ? (
              <Interruptor
                id={`${id}-extra`}
                alFinal
                activo={personalizada}
                alCambiar={(v) => despachar({ tipo: "cambiar", campo: "extras", valor: v ? [...mazo.extras, extra.id] : mazo.extras.filter((x) => x !== extra.id) })}
                etiqueta={
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>{textoEn(extra.nombre, locale)}</span>
                    <span className="tabular-nums text-tinta-2">+{formatearImporte(precioDeExtra(extra, baseMazo(cotizacion)), cotizacion.moneda, locale)}</span>
                  </span>
                }
                descripcion={textoEn(extra.descripcion, locale)}
              />
            ) : null}
          </div>
        </div>

        {personalizada && (
          <div className="space-y-3 border-t border-linea pt-4">
            <div>
              <h3 id={`${id}-foto`} className="font-semibold">
                {t("cajaFoto")}
              </h3>
              <p className="text-sm text-tinta-2">{t("cajaFotoAyuda")}</p>
            </div>
            <div role="radiogroup" aria-labelledby={`${id}-foto`} className="-mx-1 flex snap-x items-start gap-2.5 overflow-x-auto px-1 pb-2 pt-1">
              <OpcionFoto nombre={`${id}-foto`} etiqueta={t("cajaPortada")} rotulo={t("cajaPortada")} activa={!mazo.caja} alElegir={() => ponerCaja(null)} fotoId={portada?.id ?? null} version={portada ? (versiones[portada.id] ?? 0) : 0} />
              {propia && (
                <OpcionFoto nombre={`${id}-foto`} etiqueta={t("cajaPropia")} rotulo={t("cajaPropia")} activa={mazo.caja?.origen === "propia" && mazo.caja.id === propia.id} alElegir={() => ponerCaja(propia)} fotoId={propia.id} version={0} />
              )}
              {mazo.cartas.filter(esFoto).map((c) => (
                <OpcionFoto
                  key={c.id}
                  nombre={`${id}-foto`}
                  etiqueta={c.descripcion || c.nombreArchivo}
                  activa={mazo.caja?.origen === "carta" && mazo.caja.cartaId === c.id}
                  alElegir={() => ponerCaja({ origen: "carta", cartaId: c.id })}
                  fotoId={c.id}
                  version={versiones[c.id] ?? 0}
                />
              ))}
            </div>

            {!consentido && (
              <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-papel-2 p-3">
                <input
                  type="checkbox"
                  checked={consentido}
                  onChange={(e) => e.target.checked && despachar({ tipo: "consentir", ahora: Date.now() })}
                  className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-tinta)]"
                />
                <span className="text-sm leading-relaxed">{tf("consentimiento")}</span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" disabled={!consentido || estado === "subiendo"} onClick={() => entrada.current?.click()}>
                {t("cajaSubir")}
              </Boton>
              <p className="text-sm text-tinta-2" aria-live="polite">
                {estado === "subiendo" ? t("cajaSubiendo") : ""}
              </p>
            </div>
            <input
              ref={entrada}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="entrada-foto-caja"
              onChange={(e) => {
                void subir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {estado === "error" && <Aviso tono="error">{t("cajaError")}</Aviso>}
            {ppp !== null && ppp < PRINT.pppMinimo && <Aviso tono="aviso">{t("cajaBaja", { ppp })}</Aviso>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Una foto para la caja: radio nativo oculto (las flechas del teclado funcionan) y su miniatura. */
function OpcionFoto({
  nombre,
  etiqueta,
  rotulo,
  activa,
  alElegir,
  fotoId,
  version,
}: {
  nombre: string;
  etiqueta: string;
  /** Texto visible bajo la miniatura, para las opciones que no son una carta concreta. */
  rotulo?: string;
  activa: boolean;
  alElegir: () => void;
  fotoId: string | null;
  version: number;
}) {
  const url = useUrlFoto(fotoId, "mini", version);
  return (
    <label className="relative flex w-20 shrink-0 cursor-pointer snap-start flex-col items-center gap-1.5 rounded-[12px] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalto">
      <input type="radio" name={nombre} checked={activa} onChange={alElegir} aria-label={etiqueta} className="sr-only" />
      <span className={`relative block h-20 w-20 overflow-hidden rounded-[12px] bg-papel-3 transition-shadow ${activa ? "ring-[3px] ring-tinta ring-offset-2 ring-offset-blanco" : ""}`}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
        )}
        {activa && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-tinta text-sm font-bold text-papel">
            ✓
          </span>
        )}
      </span>
      {rotulo && (
        <span aria-hidden="true" className={`line-clamp-2 text-center text-xs leading-tight ${activa ? "font-bold" : "text-tinta-2"}`}>
          {rotulo}
        </span>
      )}
    </label>
  );
}
