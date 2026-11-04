"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Aviso, Franja } from "@/components/ui/Piezas";
import type { Catalogo } from "@/domain/precios/tipos";
import { ProveedorMazo, useMazo } from "@/lib/mazo/contexto";
import { BarraAccion, BarraPasos } from "./Barras";
import { ProveedorCrear } from "./contexto";
import { ElegirPack } from "./ElegirPack";
import { PasoCartas } from "./PasoCartas";
import { PasoEstilo } from "./PasoEstilo";
import { PasoFotos } from "./PasoFotos";
import { PasoPedido } from "./PasoPedido";

/** El configurador completo. Todo vive en el navegador: el mazo y las fotos se guardan en IndexedDB. */
export function Configurador({ catalogo, packInicial, pagoCancelado }: { catalogo: Catalogo; packInicial?: string | null; pagoCancelado?: boolean }) {
  return (
    <ProveedorMazo>
      <ProveedorCrear catalogo={catalogo}>
        <Contenido packInicial={packInicial ?? null} pagoCancelado={!!pagoCancelado} />
      </ProveedorCrear>
    </ProveedorMazo>
  );
}

function Contenido({ packInicial, pagoCancelado }: { packInicial: string | null; pagoCancelado: boolean }) {
  const t = useTranslations();
  const { estado, mazo, despachar, almacenOk, reiniciarTodo } = useMazo();
  const [borrando, setBorrando] = useState(false);

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

  if (estado === "cargando") {
    return (
      <main id="contenido" className="mx-auto grid min-h-[60dvh] max-w-[1200px] place-items-center px-4">
        <div className="w-56 space-y-3 text-center">
          <Franja valor={0.5} etiqueta={t("crear.abriendo")} className="animate-pulse" />
          <p className="text-sm text-tinta-2">{t("crear.abriendo")}</p>
        </div>
      </main>
    );
  }

  if (!mazo) {
    return (
      <main id="contenido">
        {!almacenOk && (
          <div className="mx-auto max-w-[1000px] px-4 pt-6 sm:px-6">
            <Aviso tono="aviso">{t("errores.almacen")}</Aviso>
          </div>
        )}
        <ElegirPack packInicial={packInicial} />
      </main>
    );
  }

  const empezarOtro = async () => {
    if (!window.confirm(t("crear.empezarOtroConfirmar"))) return;
    setBorrando(true);
    await reiniciarTodo();
    setBorrando(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <BarraPasos />
      <main id="contenido" className="mx-auto max-w-[1200px] space-y-6 px-4 pb-40 pt-6 sm:px-6 sm:pt-8">
        {!almacenOk && <Aviso tono="aviso">{t("errores.almacen")}</Aviso>}
        {pagoCancelado && !mazo.pedido && <Aviso tono="info">{t("pedido.pagoCancelado")}</Aviso>}
        {mazo.pedido?.estado === "pagado" && (
          <Aviso
            tono="exito"
            accion={
              <BotonEnlace href="/pedido/confirmado" tamano="sm" variante="secundario">
                {t("pedido.verPedido")}
              </BotonEnlace>
            }
          >
            {t("pedido.yaPedido")}
          </Aviso>
        )}

        {mazo.paso === 1 && <PasoFotos />}
        {mazo.paso === 2 && <PasoCartas />}
        {mazo.paso === 3 && <PasoEstilo />}
        {mazo.paso === 4 && <PasoPedido />}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-6 text-sm text-tinta-2">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-verde" />
            {almacenOk ? t("comun.guardadoLocal") : t("errores.almacen")}
          </span>
          <Boton variante="fantasma" tamano="sm" onClick={() => void empezarOtro()} disabled={borrando}>
            {t("crear.empezarOtro")}
          </Boton>
        </footer>
      </main>
      <BarraAccion />
    </>
  );
}
