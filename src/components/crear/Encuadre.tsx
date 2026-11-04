"use client";

import { useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import { CartaCanvas } from "@/components/carta/CartaCanvas";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import { recorteCentrado, recorteReversoDesdeAnverso, type Rect } from "@/domain/imagen/recorte";
import { PROPORCION_ANVERSO } from "@/lib/carta/dibujar";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { useFoto } from "@/lib/fotos/useFoto";
import { useUrlFoto } from "@/lib/fotos/useUrlFoto";
import { useMazo } from "@/lib/mazo/contexto";
import { datosCarta, proporcionReversoDe } from "@/lib/mazo/derivados";
import type { CartaFoto } from "@/lib/mazo/tipos";

interface Pendiente {
  anverso: Rect;
  reverso: Rect;
  reversoPersonalizado: boolean;
}

const aRect = (a: Area): Rect => ({ x: a.x, y: a.y, ancho: a.width, alto: a.height });
const aArea = (r: Rect): Area => ({ x: r.x, y: r.y, width: r.ancho, height: r.alto });

export function DialogoEncuadre({ carta, abierto, alCerrar, icono, version }: { carta: CartaFoto; abierto: boolean; alCerrar: () => void; icono: string | null; version: number }) {
  const t = useTranslations();
  const { mazo, despachar } = useMazo();
  const url = useUrlFoto(abierto ? carta.id : null, "copia", version);
  const img = useFoto(abierto ? carta.id : null, "copia", version);
  const [cara, setCara] = useState<Cara>("anverso");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [reinicio, setReinicio] = useState(0);
  const [pendiente, setPendiente] = useState<Pendiente>({
    anverso: carta.recorteAnverso,
    reverso: carta.recorteReverso,
    reversoPersonalizado: carta.reversoPersonalizado,
  });
  const [tocado, setTocado] = useState(false);
  const propReverso = mazo ? proporcionReversoDe(mazo) : 69 / 58;
  const aspecto = cara === "anverso" ? PROPORCION_ANVERSO : propReverso;

  const datos = useMemo<DatosCarta>(
    () => ({
      ...datosCarta(carta, icono),
      foto: img ? { imagen: img.imagen, escala: img.ancho / carta.ancho, recorteAnverso: pendiente.anverso, recorteReverso: pendiente.reverso } : null,
    }),
    [carta, icono, img, pendiente],
  );

  if (!mazo) return null;

  const alCompletar = (_: Area, px: Area) => {
    const r = aRect(px);
    setPendiente((p) => {
      if (cara === "anverso") {
        return {
          ...p,
          anverso: r,
          reverso: p.reversoPersonalizado ? p.reverso : recorteReversoDesdeAnverso(r, propReverso, carta.ancho, carta.alto),
        };
      }
      return tocado ? { ...p, reverso: r, reversoPersonalizado: true } : p;
    });
  };

  const restablecer = () => {
    const anverso = recorteCentrado(carta.ancho, carta.alto, PROPORCION_ANVERSO);
    setPendiente({ anverso, reverso: recorteReversoDesdeAnverso(anverso, propReverso, carta.ancho, carta.alto), reversoPersonalizado: false });
    setTocado(false);
    setZoom(1);
    setReinicio((n) => n + 1);
  };

  const guardar = () => {
    despachar({
      tipo: "actualizarCarta",
      id: carta.id,
      cambios: { recorteAnverso: pendiente.anverso, recorteReverso: pendiente.reverso, reversoPersonalizado: pendiente.reversoPersonalizado, pppConfirmado: false },
    });
    alCerrar();
  };

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={t("encuadre.titulo")}
      ancho="max-w-4xl"
      pie={
        <>
          <Boton variante="fantasma" onClick={restablecer}>
            {t("encuadre.restablecer")}
          </Boton>
          <Boton variante="secundario" onClick={alCerrar}>
            {t("comun.cancelar")}
          </Boton>
          <Boton onClick={guardar}>{t("comun.guardar")}</Boton>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <div role="tablist" aria-label={t("encuadre.titulo")} className="inline-flex gap-1 rounded-[14px] bg-papel-2 p-1">
            {(["anverso", "reverso"] as const).map((c) => (
              <button
                key={c}
                role="tab"
                type="button"
                aria-selected={cara === c}
                onClick={() => {
                  setCara(c);
                  setTocado(false);
                  setZoom(1);
                }}
                className={`tipo-boton min-h-10 rounded-[10px] px-3 text-sm ${cara === c ? "bg-tinta text-papel" : "hover:bg-papel-3"}`}
              >
                {c === "anverso" ? t("encuadre.caraFoto") : t("encuadre.caraFecha")}
              </button>
            ))}
          </div>
          <div className="relative h-[min(56dvh,460px)] overflow-hidden rounded-[14px] bg-tinta">
            {url && (
              <Cropper
                key={`${cara}-${reinicio}`}
                image={url}
                crop={crop}
                zoom={zoom}
                aspect={aspecto}
                minZoom={1}
                maxZoom={4}
                onCropChange={setCrop}
                onZoomChange={(z) => {
                  setZoom(z);
                  setTocado(true);
                }}
                onInteractionStart={() => setTocado(true)}
                onCropComplete={alCompletar}
                initialCroppedAreaPixels={aArea(cara === "anverso" ? pendiente.anverso : pendiente.reverso)}
                objectFit="contain"
                showGrid={false}
              />
            )}
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            {t("encuadre.zoom")}
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                setZoom(Number(e.target.value));
                setTocado(true);
              }}
              className="flex-1 accent-[var(--color-tinta)]"
            />
          </label>
          <p className="text-sm text-tinta-2">{t("encuadre.ayuda")}</p>
          {cara === "reverso" && !pendiente.reversoPersonalizado && <p className="text-sm text-tinta-2">{t("encuadre.reversoAuto")}</p>}
        </div>
        <div className="mx-auto w-[180px] md:w-full">
          <CartaCanvas
            cara={cara}
            datos={datos}
            estiloId={mazo.estiloId}
            paletaId={mazo.paletaId}
            tono={mazo.tono}
            idiomaMazo={mazo.idiomaMazo}
            etiqueta={cara === "anverso" ? t("comun.anverso") : t("comun.reverso")}
          />
        </div>
      </div>
    </Dialogo>
  );
}
