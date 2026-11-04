"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CartaPortada } from "@/components/carta/CartaPortada";
import { VistaCarta } from "@/components/carta/VistaCarta";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Aviso, Franja, Micro } from "@/components/ui/Piezas";
import { ordenarPorFecha } from "@/domain/mazo/ordenar";
import { formatearImporte } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { textosRetos } from "@/lib/carta/textos";
import { decodificarFoto } from "@/lib/fotos/cache";
import { ProveedorMazo, useMazo } from "@/lib/mazo/contexto";
import { iconosDelMazo } from "@/lib/mazo/derivados";
import { descargar, generarPdfMazo, nombreArchivoPdf } from "@/lib/pdf/imprimir";
import { cartasImpresas, planImpresion } from "@/lib/pdf/plan";

export function PedidoConfirmado({ catalogo, sessionId }: { catalogo: Catalogo; sessionId: string | null }) {
  return (
    <ProveedorMazo>
      <Contenido catalogo={catalogo} sessionId={sessionId} />
    </ProveedorMazo>
  );
}


function Contenido({ catalogo, sessionId }: { catalogo: Catalogo; sessionId: string | null }) {
  const t = useTranslations("confirmado");
  const locale = useLocale();
  const { estado, mazo, despachar } = useMazo();
  const [verificacion, setVerificacion] = useState<"pagado" | "pendiente" | null>(null);
  const [progreso, setProgreso] = useState<{ hecha: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<"listo" | "error" | null>(null);
  const iconos = useMemo(() => (mazo ? iconosDelMazo(mazo, catalogo) : new Map<string, string>()), [mazo, catalogo]);
  const pedido = mazo?.pedido ?? null;

  // Vuelta de Stripe: comprobamos el pago en el servidor antes de darlo por hecho.
  const debeComprobar = !!sessionId && !!pedido && pedido.modo === "stripe" && pedido.estado !== "pagado";
  useEffect(() => {
    if (!sessionId || !pedido || pedido.modo !== "stripe" || pedido.estado === "pagado") return;
    let vivo = true;
    void fetch(`/api/checkout/estado?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ pagado: boolean; pedidoId: string | null }>) : null))
      .then((r) => {
        if (!vivo) return;
        if (r?.pagado && r.pedidoId === pedido.id) {
          despachar({ tipo: "pedidoPagado" });
          setVerificacion("pagado");
        } else setVerificacion("pendiente");
      })
      .catch(() => {
        if (vivo) setVerificacion("pendiente");
      });
    return () => {
      vivo = false;
    };
  }, [sessionId, pedido, despachar]);

  if (estado === "cargando") {
    return (
      <div className="mx-auto grid min-h-[50dvh] max-w-[1200px] place-items-center px-4">
        <Franja valor={0.5} className="w-56 animate-pulse" etiqueta="…" />
      </div>
    );
  }

  if (!mazo || !pedido) {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-20 text-center">
        <p className="text-md">{t("sinMazo")}</p>
        <BotonEnlace href="/crear">{t("volver")}</BotonEnlace>
      </div>
    );
  }

  const simulado = pedido.modo === "simulado";
  const muestra = ordenarPorFecha(mazo.cartas).find((c) => c.fecha) ?? mazo.cartas[0] ?? null;
  const pais = catalogo.paises.find((p) => p.activo);

  const generar = async () => {
    setResultado(null);
    const plan = planImpresion({ mazo, catalogo, iconos, retos: textosRetos(mazo.idiomaMazo) });
    setProgreso({ hecha: 0, total: plan.length * 2 });
    try {
      const bytes = await generarPdfMazo({
        plan,
        estiloId: mazo.estiloId,
        paletaId: mazo.paletaId,
        tono: mazo.tono,
        idiomaMazo: mazo.idiomaMazo,
        titulo: mazo.titulo,
        obtenerFoto: async (id) => {
          const d = await decodificarFoto(id, "copia");
          return d ? { imagen: d.imagen, ancho: d.ancho, cerrar: () => d.imagen.close() } : null;
        },
        alProgresar: (hecha, total) => setProgreso({ hecha, total }),
      });
      descargar(bytes, nombreArchivoPdf(mazo.titulo, cartasImpresas(plan)));
      setResultado("listo");
    } catch (e) {
      console.error(e);
      setResultado("error");
    } finally {
      setProgreso(null);
    }
  };

  return (
    <div className="pb-24">
      {/* Abanico de celebración */}
      <section className="mesa border-b border-linea">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_minmax(0,440px)] md:py-14">
          <div className="space-y-4">
            <Micro className="text-tinta-2">{t("referencia", { id: pedido.id })}</Micro>
            <h1 className="tipo-titular text-[clamp(2.6rem,8vw,4.6rem)] leading-[0.9]">{simulado ? t("tituloSimulado") : t("titulo")}</h1>
            <p className="text-md">
              {t("resumen", { cartas: pedido.cartasFisicas, total: formatearImporte(pedido.totalCents, pedido.moneda, locale) })}
            </p>
            <p className="max-w-xl text-tinta-2">{t("texto", { min: pais?.diasEntrega.min ?? 5, max: pais?.diasEntrega.max ?? 8 })}</p>
            {debeComprobar && verificacion === null && <Aviso tono="info">{t("comprobando")}</Aviso>}
            {verificacion === "pendiente" && <Aviso tono="aviso">{t("pendiente")}</Aviso>}
          </div>
          <div aria-hidden="true" className="relative mx-auto aspect-[1.2/1] w-full max-w-[440px]">
            <div className="absolute left-1/2 top-1/2 w-[40%] -translate-x-[115%] -translate-y-[46%] -rotate-[9deg] [animation:repartir_700ms_var(--ease-salida)_both]">
              <CartaPortada mazo={mazo} tipo="portada" cara="reverso" etiqueta="" />
            </div>
            {muestra && (
              <div className="absolute left-1/2 top-1/2 w-[40%] translate-x-[15%] -translate-y-[44%] rotate-[9deg] [animation:repartir_700ms_var(--ease-salida)_120ms_both]">
                <VistaCarta carta={muestra} mazo={mazo} cara="reverso" icono={iconos.get(muestra.id) ?? null} />
              </div>
            )}
            <div className="absolute left-1/2 top-1/2 z-10 w-[42%] -translate-x-1/2 -translate-y-1/2 [animation:repartir_700ms_var(--ease-salida)_240ms_both]">
              <CartaPortada mazo={mazo} tipo="caja" cara="anverso" etiqueta="" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 pt-10 sm:px-6 lg:grid-cols-2">
        <section className="relative space-y-4 overflow-hidden rounded-[var(--radius-carta)] bg-blanco p-6 shadow-[var(--shadow-carta)]">
          <h2 className="tipo-subtitular text-xl">{t("descargarPdf")}</h2>
          <p className="text-sm text-tinta-2">{t("textoPrototipo")}</p>
          <Boton tamano="lg" onClick={() => void generar()} disabled={!!progreso}>
            {progreso ? t("generando", { hecha: progreso.hecha, total: progreso.total }) : t("descargarPdf")}
          </Boton>
          {progreso && <Franja valor={progreso.total ? progreso.hecha / progreso.total : 0} etiqueta={t("generando", { hecha: progreso.hecha, total: progreso.total })} />}
          <p aria-live="polite" className="min-h-5 text-sm">
            {resultado === "listo" && <span className="text-verde-texto">✓ {t("pdfListo")}</span>}
            {resultado === "error" && <span className="text-rojo-texto">{t("pdfError")}</span>}
          </p>
          <BotonEnlace href="/instrucciones" variante="secundario">
            {t("descargarInstrucciones")}
          </BotonEnlace>
        </section>

        <section className="space-y-4 rounded-[var(--radius-carta)] bg-papel-2 p-6">
          <h2 className="tipo-subtitular text-xl">{t("siguientes")}</h2>
          <ol className="space-y-3">
            {(["paso1", "paso2", "paso3"] as const).map((k, i) => (
              <li key={k} className="flex gap-3">
                <span aria-hidden="true" className="tipo-titular grid h-8 w-8 shrink-0 place-items-center rounded-[0_0_10px_0] bg-rosa text-lg">
                  {i + 1}
                </span>
                <span className="pt-1">{t(k)}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <BotonEnlace href="/como-jugar">{t("comoJugar")}</BotonEnlace>
            <BotonEnlace href="/crear" variante="fantasma">
              {t("volver")}
            </BotonEnlace>
          </div>
        </section>
      </div>
    </div>
  );
}
