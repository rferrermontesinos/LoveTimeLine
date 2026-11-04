"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useTranslations } from "next-intl";
import { PRINT } from "@config/print";
import { CartaCanvas } from "@/components/carta/CartaCanvas";
import { Boton } from "@/components/ui/Boton";
import type { Adorno, DatosCarta } from "@/lib/carta/tipos";
import { useFoto } from "@/lib/fotos/useFoto";
import { nuevoId } from "@/lib/importar/procesar";
import { datosCarta } from "@/lib/mazo/derivados";
import type { CartaFoto, Mazo } from "@/lib/mazo/tipos";

const EMOJIS = ["❤️", "🎉", "⭐", "😂", "🥂", "🎂", "🏖️", "✈️", "🐶", "🌸", "☀️", "👶", "💍", "🏠", "🎄", "📸"];
const FUENTE_EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const ANCHO = 300;
const ALTO = Math.round((ANCHO * PRINT.carta.altoMm) / PRINT.carta.anchoMm);

/**
 * Emojis sobre la cara de la foto, con react-konva: arrastrar, escalar y girar.
 * Las posiciones se guardan relativas a la carta, así se imprimen igual a 300 ppp.
 */
export default function EditorAdornos({
  carta,
  mazo,
  icono,
  version,
  alGuardar,
  alCancelar,
}: {
  carta: CartaFoto;
  mazo: Mazo;
  icono: string | null;
  version: number;
  alGuardar: (adornos: Adorno[]) => void;
  alCancelar: () => void;
}) {
  const t = useTranslations();
  const [adornos, setAdornos] = useState<Adorno[]>(carta.adornos);
  const [elegido, setElegido] = useState<string | null>(null);
  const img = useFoto(carta.id, "copia", version);
  const tr = useRef<Konva.Transformer>(null);
  const nodos = useRef(new Map<string, Konva.Text>());

  const fondo = useMemo<DatosCarta>(
    () => ({
      ...datosCarta(carta, icono),
      adornos: [],
      foto: img ? { imagen: img.imagen, escala: img.ancho / carta.ancho, recorteAnverso: carta.recorteAnverso, recorteReverso: carta.recorteReverso } : null,
    }),
    [carta, icono, img],
  );

  useEffect(() => {
    const nodo = elegido ? nodos.current.get(elegido) : null;
    tr.current?.nodes(nodo ? [nodo] : []);
    tr.current?.getLayer()?.batchDraw();
  }, [elegido, adornos]);

  const anadir = (emoji: string) => {
    const a: Adorno = { id: nuevoId(), emoji, x: 0.5, y: 0.45, tamano: 0.2, giro: 0 };
    setAdornos((l) => [...l, a]);
    setElegido(a.id);
  };
  const cambiar = (id: string, cambios: Partial<Adorno>) => setAdornos((l) => l.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  const actual = adornos.find((a) => a.id === elegido) ?? null;

  return (
    <div className="grid gap-5 md:grid-cols-[auto_1fr]">
      <div className="relative mx-auto" style={{ width: ANCHO, height: ALTO }}>
        <CartaCanvas cara="anverso" datos={fondo} estiloId={mazo.estiloId} paletaId={mazo.paletaId} tono={mazo.tono} idiomaMazo={mazo.idiomaMazo} ancho={ANCHO} etiqueta={t("comun.anverso")} />
        <Stage
          width={ANCHO}
          height={ALTO}
          className="absolute inset-0"
          onMouseDown={(e) => e.target === e.target.getStage() && setElegido(null)}
          onTouchStart={(e) => e.target === e.target.getStage() && setElegido(null)}
        >
          <Layer>
            {adornos.map((a) => {
              const tam = a.tamano * ANCHO;
              return (
                <Text
                  key={a.id}
                  ref={(n) => {
                    if (n) nodos.current.set(a.id, n);
                    else nodos.current.delete(a.id);
                  }}
                  text={a.emoji}
                  fontFamily={FUENTE_EMOJI}
                  fontSize={tam}
                  width={tam * 1.3}
                  height={tam * 1.2}
                  align="center"
                  verticalAlign="middle"
                  offsetX={(tam * 1.3) / 2}
                  offsetY={(tam * 1.2) / 2}
                  x={a.x * ANCHO}
                  y={a.y * ALTO}
                  rotation={a.giro}
                  draggable
                  onMouseDown={() => setElegido(a.id)}
                  onTap={() => setElegido(a.id)}
                  onDragEnd={(e) => cambiar(a.id, { x: e.target.x() / ANCHO, y: e.target.y() / ALTO })}
                  onTransformEnd={(e) => {
                    const n = e.target;
                    const escala = n.scaleX();
                    n.scaleX(1);
                    n.scaleY(1);
                    cambiar(a.id, { tamano: Math.min(0.8, Math.max(0.06, a.tamano * escala)), giro: n.rotation(), x: n.x() / ANCHO, y: n.y() / ALTO });
                  }}
                />
              );
            })}
            <Transformer ref={tr} keepRatio enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]} rotateEnabled anchorSize={14} borderStroke="#2E56E6" anchorStroke="#2E56E6" />
          </Layer>
        </Stage>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-tinta-2">{t("adornos.ayuda")}</p>
        <div className="grid grid-cols-8 gap-1.5">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => anadir(e)} aria-label={t("adornos.anadir", { emoji: e })} className="grid h-11 place-items-center rounded-[10px] bg-blanco text-2xl hover:bg-papel-3">
              {e}
            </button>
          ))}
        </div>
        {actual && (
          <div className="space-y-3 rounded-[14px] bg-blanco p-4">
            <p className="font-semibold">
              {t("adornos.seleccionado")}: <span className="text-2xl">{actual.emoji}</span>
            </p>
            <label className="flex items-center gap-3 text-sm font-semibold">
              {t("adornos.tamano")}
              <input type="range" min={0.06} max={0.8} step={0.01} value={actual.tamano} onChange={(e) => cambiar(actual.id, { tamano: Number(e.target.value) })} className="flex-1 accent-[var(--color-tinta)]" />
            </label>
            <Boton
              variante="peligro"
              tamano="sm"
              onClick={() => {
                setAdornos((l) => l.filter((a) => a.id !== actual.id));
                setElegido(null);
              }}
            >
              {t("adornos.quitar")}
            </Boton>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Boton onClick={() => alGuardar(adornos)}>{t("comun.guardar")}</Boton>
          <Boton variante="secundario" onClick={alCancelar}>
            {t("comun.cancelar")}
          </Boton>
          {adornos.length > 0 && (
            <Boton variante="fantasma" onClick={() => { setAdornos([]); setElegido(null); }}>
              {t("adornos.quitarTodos")}
            </Boton>
          )}
        </div>
      </div>
    </div>
  );
}
