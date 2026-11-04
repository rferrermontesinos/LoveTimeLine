"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Dialogo } from "@/components/ui/Dialogo";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { rangoHueco } from "@/domain/mazo/configuracion";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { nuevoId } from "@/lib/importar/procesar";
import { useMazo } from "@/lib/mazo/contexto";
import { nuevaCartaTexto } from "@/lib/mazo/derivados";
import { ideasDeRecuerdo } from "@/lib/mazo/recuerdos";
import { useCrear } from "./contexto";
import { SelectorFecha } from "./SelectorFecha";

/** Dónde dejar el cursor: seleccionando el hueco («[nombre]») si lo hay; si no, al final. */
function seleccionPara(texto: string, vez: number) {
  const hueco = rangoHueco(texto);
  return { inicio: hueco?.inicio ?? texto.length, fin: hueco?.fin ?? texto.length, vez };
}

/**
 * Añadir un recuerdo sin foto: el texto (con ideas en el idioma del mazo) y la fecha, en blanco
 * por defecto. No necesita el permiso de las fotos. La carta nueva queda abierta en el paso 2 y
 * no cuenta como lista hasta tener fecha y un texto sin huecos por rellenar.
 */
export function DialogoRecuerdo({
  abierto,
  idea,
  alCerrar,
}: {
  abierto: boolean;
  idea: string;
  alCerrar: (anadido?: { id: string; texto: string }) => void;
}) {
  const t = useTranslations("crear.recuerdo");
  const tc = useTranslations("comun");
  const locale = useLocale();
  const { mazo, despachar } = useMazo();
  const { hoy, setCartaActiva } = useCrear();
  const id = useId();
  const [texto, setTexto] = useState(idea);
  const [fecha, setFecha] = useState<FechaCarta | null>(null);
  // Al abrir, y al elegir una idea, el cursor va al texto (seleccionando el hueco si lo hay).
  const [seleccion, setSeleccion] = useState(() => seleccionPara(idea, 0));
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!abierto) return;
    // En el siguiente fotograma: al abrirse, el diálogo nativo aún no está abierto en este efecto.
    const fotograma = requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(seleccion.inicio, seleccion.fin);
    });
    return () => cancelAnimationFrame(fotograma);
  }, [seleccion, abierto]);

  if (!mazo) return null;
  const ideas = ideasDeRecuerdo(mazo.idiomaMazo);
  // Las ideas y el texto están en el idioma del mazo, que puede no ser el de la página.
  const lang = mazo.idiomaMazo.split("-")[0] !== locale.split("-")[0] ? mazo.idiomaMazo : undefined;
  const largo = [...texto].length;
  const pasa = largo > MAX_DESCRIPCION;
  const limpio = texto.replace(/\s+/g, " ").trim();
  const valido = limpio.length > 0 && !pasa;

  const elegir = (i: string) => {
    setTexto(i);
    setSeleccion((s) => seleccionPara(i, s.vez + 1));
  };

  const anadir = () => {
    if (!valido) return;
    const carta = nuevaCartaTexto(nuevoId(), limpio, fecha, Date.now());
    despachar({ tipo: "anadirCartas", cartas: [carta], deshacible: true });
    setCartaActiva(carta.id);
    alCerrar({ id: carta.id, texto: limpio });
  };

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={() => alCerrar()}
      titulo={t("titulo")}
      ancho="max-w-2xl"
      pie={
        <>
          <Boton variante="secundario" onClick={() => alCerrar()}>
            {tc("cancelar")}
          </Boton>
          <Boton onClick={anadir} disabled={!valido}>
            {t("anadir")}
          </Boton>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-tinta-2">{t("intro")}</p>

        <div className="space-y-2">
          <label htmlFor={`${id}-texto`} className="tipo-subtitular block text-lg">
            {t("texto")}
          </label>
          <textarea
            ref={area}
            id={`${id}-texto`}
            value={texto}
            lang={lang}
            rows={2}
            maxLength={MAX_DESCRIPCION + 20}
            onChange={(e) => setTexto(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                anadir();
              }
            }}
            aria-describedby={`${id}-ayuda ${id}-contador`}
            aria-invalid={pasa || undefined}
            className="w-full rounded-[12px] border-2 border-tinta bg-blanco px-3 py-2.5 text-base aria-[invalid=true]:border-rojo-texto"
          />
          <div className="flex justify-between gap-3 text-sm">
            <span id={`${id}-ayuda`} className="text-tinta-2">
              {t("textoAyuda", { max: MAX_DESCRIPCION })}
            </span>
            <span id={`${id}-contador`} className={`shrink-0 whitespace-nowrap tabular-nums ${pasa ? "font-bold text-rojo-texto" : "text-tinta-2"}`}>
              {t("contador", { n: largo, max: MAX_DESCRIPCION })}
            </span>
          </div>
        </div>

        <section aria-labelledby={`${id}-ideas`} className="space-y-2">
          <h3 id={`${id}-ideas`} className="tipo-micro text-micro text-tinta-2">
            {t("ideas")}
          </h3>
          <ul className="flex flex-wrap gap-2" lang={lang}>
            {ideas.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => elegir(i)}
                  aria-pressed={texto === i}
                  className={`min-h-10 rounded-full border-2 px-3.5 text-left text-sm font-semibold transition-colors max-sm:min-h-11 ${
                    texto === i ? "border-tinta bg-tinta text-papel" : "border-linea bg-blanco hover:border-tinta"
                  }`}
                >
                  {i}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={`${id}-fecha`} className="space-y-2">
          <h3 id={`${id}-fecha`} className="tipo-subtitular text-lg">
            {t("fecha")}
          </h3>
          <p className="text-sm text-tinta-2">{t("fechaAyuda")}</p>
          <SelectorFecha valor={fecha} alCambiar={setFecha} hoy={hoy} idBase={`${id}-f`} />
        </section>
      </div>
    </Dialogo>
  );
}
