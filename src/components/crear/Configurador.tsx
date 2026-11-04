"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DESCARGA_PDF } from "@config/prototipo";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Aviso, Franja } from "@/components/ui/Piezas";
import { packPorDefecto } from "@/domain/precios/cotizar";
import { textoEn, type Catalogo } from "@/domain/precios/tipos";
import { nuevoId } from "@/lib/importar/procesar";
import { accionCrearMazo, urlSinParametros, type Arranque } from "@/lib/mazo/arranque";
import { ProveedorMazo, useMazo } from "@/lib/mazo/contexto";
import { haceCuantoTexto } from "@/lib/mazo/guardado";
import type { Mazo, Paso } from "@/lib/mazo/tipos";
import { BarraAccion, BarraPasos } from "./Barras";
import { ProveedorCrear, useCrear } from "./contexto";
import { DialogoRecuerdo } from "./DialogoRecuerdo";
import { AvisoGuardado, LineaGuardado, useAhora } from "./EstadoGuardado";
import { PasoCartas } from "./PasoCartas";
import { PasoEstilo } from "./PasoEstilo";
import { PasoFotos } from "./PasoFotos";
import { PasoPedido } from "./PasoPedido";
import { AvisoSinConexion, usePrepararSinConexion } from "./SinConexion";
import { useArranque } from "./useArranque";

/**
 * El configurador completo. Todo vive en el navegador: el mazo y las fotos se guardan en IndexedDB.
 * Se empieza siempre en Fotos: si no hay mazo guardado, se crea uno con el pack de la URL
 * (`?pack=`, desde la portada) o con el de por defecto. Con uno guardado, se sigue donde se dejó.
 * `?pago=cancelado`: se vuelve de Stripe sin pagar.
 */
export function Configurador({ catalogo }: { catalogo: Catalogo }) {
  return (
    <ProveedorMazo>
      <ProveedorCrear catalogo={catalogo}>
        <Contenido />
      </ProveedorCrear>
    </ProveedorMazo>
  );
}

function Contenido() {
  const t = useTranslations();
  const locale = useLocale();
  const { estado, mazo, despachar, almacenOk, reiniciarTodo, alAbrir } = useMazo();
  const { catalogo, pasoActual, puedeAvanzar, recuerdo, cerrarRecuerdo, recuerdoAnadido } = useCrear();
  const [borrando, setBorrando] = useState(false);
  // `?pack=` y `?pago=` se leen en el navegador (no como props del servidor) y una sola vez, al
  // abrir: en cuanto se usan salen de la URL, y la página guardada de esa entrada del historial
  // seguiría trayéndolos al volver con «Atrás» y los aplicaría otra vez.
  const parametros = useSearchParams();
  const [alAbrirUrl] = useState(() => ({ pack: parametros.get("pack"), pagoCancelado: parametros.get("pago") === "cancelado" }));
  const pagoCancelado = alAbrirUrl.pagoCancelado;
  const arranque = useArranque(alAbrirUrl.pack);
  // Aviso del arranque (cambio de pack o pack que no cambia), hasta que se cierra o se deshace.
  const [avisoCerrado, setAvisoCerrado] = useState(false);
  usePrepararSinConexion();

  // Avisos de llegada («Seguimos donde lo dejaste», pago cancelado): hasta que se cierran o se
  // cambia de paso por primera vez.
  const [reanudarCerrado, setReanudarCerrado] = useState(false);
  const [canceladoCerrado, setCanceladoCerrado] = useState(false);
  const [pasoAlAbrir, setPasoAlAbrir] = useState<Paso | null>(null);
  const [pasoCambiado, setPasoCambiado] = useState(false);
  if (mazo && pasoAlAbrir === null) setPasoAlAbrir(pasoActual);
  else if (pasoAlAbrir !== null && !pasoCambiado && pasoActual !== pasoAlAbrir) setPasoCambiado(true);

  // Vuelta de Stripe sin pagar: el pedido pendiente se quita (uno pagado no se toca) y
  // `?pago=cancelado` sale de la URL, para que al recargar no vuelva a avisar.
  const listo = estado === "listo" && !!mazo;
  useEffect(() => {
    if (!listo || !pagoCancelado) return;
    despachar({ tipo: "cancelarPedido" });
    const limpia = urlSinParametros(window.location.href, ["pago"]);
    if (limpia) window.history.replaceState(null, "", limpia);
  }, [listo, pagoCancelado, despachar]);

  // Ctrl/Cmd + Z deshace los cambios del mazo, salvo mientras se escribe (ahí manda el deshacer del navegador).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      despachar({ tipo: "deshacer" });
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [despachar]);

  // Mientras se lee el almacén o se crea el mazo nuevo (un instante), el mismo marcador.
  if (estado === "cargando" || !mazo) {
    return (
      <main id="contenido" className="mx-auto grid min-h-[60dvh] max-w-[1200px] place-items-center px-4">
        <div className="w-56 space-y-3 text-center">
          <Franja valor={0.5} etiqueta={t("crear.abriendo")} className="animate-pulse" />
          <p className="text-sm text-tinta-2">{t("crear.abriendo")}</p>
        </div>
      </main>
    );
  }

  /** Borra el mazo y sus fotos y empieza otro en Fotos, con el pack indicado o el de por defecto. */
  const empezarOtro = async (packId?: string) => {
    // Con pedido, el aviso dice además que ese mazo ya no se podrá abrir aquí.
    if (!window.confirm(t(mazo.pedido ? "crear.empezarOtroConPedido" : "crear.empezarOtroConfirmar"))) return;
    const pack = packId ?? packPorDefecto(catalogo)?.id;
    if (!pack) return;
    setBorrando(true);
    await reiniciarTodo();
    despachar(accionCrearMazo({ id: nuevoId(), ahora: Date.now(), packId: pack, idiomaMazo: locale, titulo: t("estilo.tituloPorDefecto"), catalogo }));
    setAvisoCerrado(true);
    setReanudarCerrado(true);
    setCanceladoCerrado(true);
    setBorrando(false);
    window.scrollTo({ top: 0 });
  };

  const nombrePack = (id: string) => {
    const p = catalogo.packs.find((x) => x.id === id);
    return p ? textoEn(p.nombre, locale) : id;
  };
  const avisoArranque = avisoCerrado ? null : aviso(arranque, mazo.packId);
  const pagado = mazo.pedido?.estado === "pagado";
  // El mazo de siempre, al volver otro día (sin otro aviso de llegada que ya lo diga).
  const reanudar =
    !pasoCambiado && !reanudarCerrado && !pagoCancelado && !pagado && arranque?.tipo === "nada" && alAbrir?.id === mazo.id && alAbrir.cartas.length > 0
      ? alAbrir
      : null;
  const avisoCancelado = !pasoCambiado && !canceladoCerrado && pagoCancelado && !pagado;

  // Con cartas pendientes, la barra inferior crece con el aviso de las que faltan: más hueco abajo.
  const conAvisoAbajo = pasoActual === 2 && mazo.cartas.length > 0 && !puedeAvanzar;

  return (
    <>
      <BarraPasos />
      <main id="contenido" className={`mx-auto max-w-[1200px] space-y-6 px-4 pt-6 sm:px-6 sm:pt-8 ${conAvisoAbajo ? "pb-72 sm:pb-60" : "pb-52 sm:pb-44"}`}>
        <AvisoSinConexion />
        {!almacenOk && <Aviso tono="aviso">{t("errores.almacen")}</Aviso>}
        <AvisoGuardado />
        {avisoCancelado && (
          <Aviso tono="info" accion={<CerrarAviso etiqueta={t("crear.cerrarAviso")} alCerrar={() => setCanceladoCerrado(true)} />}>
            {t("pedido.pagoCancelado")}
          </Aviso>
        )}
        {reanudar && (
          <AvisoReanudar
            guardado={reanudar}
            mazo={mazo}
            ocupado={borrando}
            alEmpezarOtro={() => void empezarOtro()}
            alCerrar={() => setReanudarCerrado(true)}
          />
        )}
        {pagado && (
          <Aviso
            tono="exito"
            accion={
              <BotonEnlace href="/pedido/confirmado" tamano="sm" variante="secundario" className="max-sm:min-h-11 max-sm:w-full">
                {t("pedido.verPedido")}
              </BotonEnlace>
            }
          >
            {t(DESCARGA_PDF ? "pedido.yaPedido" : "pedido.yaPedidoSinDescarga")}
          </Aviso>
        )}

        {avisoArranque?.tipo === "cambiarPack" && (
          <Aviso
            tono="info"
            accion={
              <span className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
                <Boton
                  tamano="sm"
                  variante="secundario"
                  className="max-sm:min-h-11"
                  onClick={() => {
                    despachar({ tipo: "cambiar", campo: "packId", valor: avisoArranque.de });
                    setAvisoCerrado(true);
                  }}
                >
                  ↶ {t("comun.deshacer")}
                </Boton>
                <CerrarAviso etiqueta={t("crear.cerrarAviso")} alCerrar={() => setAvisoCerrado(true)} />
              </span>
            }
          >
            {t("crear.avisoPack.cambiado", { pack: nombrePack(avisoArranque.a), n: catalogo.packs.find((p) => p.id === avisoArranque.a)?.cartas ?? 0 })}
          </Aviso>
        )}
        {avisoArranque?.tipo === "mantenerPack" && (
          <Aviso
            tono="info"
            accion={
              <span className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
                <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" disabled={borrando} onClick={() => void empezarOtro(avisoArranque.pedido)}>
                  {t("crear.avisoPack.empezarOtro", { pack: nombrePack(avisoArranque.pedido) })}
                </Boton>
                <CerrarAviso etiqueta={t("crear.cerrarAviso")} alCerrar={() => setAvisoCerrado(true)} />
              </span>
            }
          >
            {t("crear.avisoPack.conPedido", { pack: nombrePack(avisoArranque.pedido) })}
          </Aviso>
        )}

        {/* Como mucho, el paso permitido: con cartas pendientes, Estilo y Pedido no se muestran. */}
        {pasoActual === 1 && <PasoFotos />}
        {pasoActual === 2 && <PasoCartas />}
        {pasoActual === 3 && <PasoEstilo />}
        {pasoActual === 4 && <PasoPedido />}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-6 text-sm text-tinta-2">
          <LineaGuardado />
          <Boton variante="fantasma" tamano="sm" onClick={() => void empezarOtro()} disabled={borrando}>
            {t("crear.empezarOtro")}
          </Boton>
        </footer>
      </main>
      <BarraAccion />
      {recuerdo && <DialogoRecuerdo key={recuerdo.clave} abierto={recuerdo.abierto} idea={recuerdo.idea} alCerrar={cerrarRecuerdo} />}
      {/* Confirma al lector de pantalla el recuerdo sin foto recién añadido, desde cualquier paso. */}
      <p role="status" className="sr-only">
        {recuerdoAnadido ? t("crear.recuerdo.anadido", { texto: recuerdoAnadido.texto }) : ""}
      </p>
    </>
  );
}

/** El aviso del arranque mientras siga teniendo sentido (el cambio de pack, si el pack no ha vuelto a cambiar). */
function aviso(a: Arranque | null, packActual: string): Extract<Arranque, { tipo: "cambiarPack" | "mantenerPack" }> | null {
  if (a?.tipo === "cambiarPack") return packActual === a.a ? a : null;
  if (a?.tipo === "mantenerPack") return a;
  return null;
}

/**
 * «Seguimos donde lo dejaste»: el mazo que había guardado en este dispositivo, cuánto tiene y
 * cuándo se guardó, con la salida para empezar otro.
 */
function AvisoReanudar({ guardado, mazo, ocupado, alEmpezarOtro, alCerrar }: { guardado: Mazo; mazo: Mazo; ocupado: boolean; alEmpezarOtro: () => void; alCerrar: () => void }) {
  const t = useTranslations("crear");
  const locale = useLocale();
  const ahora = useAhora();
  const cuando = haceCuantoTexto(guardado.actualizadoEn, ahora, locale, t("guardado.ahoraMismo"), "long");
  return (
    <Aviso
      tono="info"
      accion={
        <span className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
          <Boton tamano="sm" variante="secundario" className="max-sm:min-h-11" disabled={ocupado} onClick={alEmpezarOtro}>
            {t("empezarOtro")}
          </Boton>
          <CerrarAviso etiqueta={t("cerrarAviso")} alCerrar={alCerrar} />
        </span>
      }
    >
      <p className="font-semibold" data-testid="aviso-reanudar">
        {t("reanudar.titulo")}
      </p>
      <p className="text-tinta-2">{t("reanudar.detalle", { titulo: mazo.titulo.trim() || t("reanudar.sinTitulo"), n: mazo.cartas.length, cuando })}</p>
    </Aviso>
  );
}

function CerrarAviso({ etiqueta, alCerrar }: { etiqueta: string; alCerrar: () => void }) {
  return (
    <button type="button" onClick={alCerrar} aria-label={etiqueta} title={etiqueta} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl leading-none hover:bg-papel-2 max-sm:h-11 max-sm:w-11">
      <span aria-hidden="true">×</span>
    </button>
  );
}
