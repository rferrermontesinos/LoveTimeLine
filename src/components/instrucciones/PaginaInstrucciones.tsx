"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boton } from "@/components/ui/Boton";
import { Micro, Seccion } from "@/components/ui/Piezas";
import { textosFolleto } from "@/lib/carta/textos";
import { obtenerEstilo, obtenerTinta } from "@/lib/estilos";
import { ProveedorMazo, useMazo } from "@/lib/mazo/contexto";
import { aniosPortada } from "@/lib/mazo/derivados";
import { CaraA, CaraB, type ColoresFolleto, type Personalizacion } from "./Folleto";

const MM = 96 / 25.4;
const ANCHO_HOJA = 252 * MM;
const ALTO_HOJA = 176 * MM;

export function PaginaInstrucciones({ generico }: { generico: boolean }) {
  return (
    <ProveedorMazo>
      <Contenido generico={generico} />
    </ProveedorMazo>
  );
}

function Contenido({ generico }: { generico: boolean }) {
  const t = useTranslations("instrucciones");
  const locale = useLocale();
  const { estado, mazo } = useMazo();
  const usarMazo = !generico && !!mazo;
  const textos = textosFolleto(usarMazo ? mazo.idiomaMazo : locale);
  const estilo = obtenerEstilo(usarMazo ? mazo.estiloId : "pareja");
  const tinta = obtenerTinta(estilo, usarMazo ? mazo.tintaId : null);
  const colores: ColoresFolleto = { fondo: tinta.fondo, franja: tinta.franja, texto: tinta.texto, tinta: estilo.colores.tinta, papel: estilo.colores.papel };
  const personal: Personalizacion | null = usarMazo ? { titulo: mazo.titulo, anios: aniosPortada(mazo), dedicatoria: mazo.dedicatoria } : null;

  return (
    <div data-listo={estado === "listo" ? "si" : "no"}>
      <style>{"@page { size: 297mm 210mm; margin: 0; }"}</style>
      <Seccion className="space-y-6 py-12 print:hidden">
        <div className="space-y-3">
          <Micro className="text-tinta-2">{t("caraA")} · {t("caraB")}</Micro>
          <h1 className="tipo-titular text-[clamp(2.4rem,7vw,4.4rem)] leading-[0.9]">{t("titulo")}</h1>
          <p className="max-w-2xl text-md text-tinta-2">{t("texto")}</p>
          <p className="text-sm font-semibold">{usarMazo ? t("personalizado") : t("generico")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => window.print()}>{t("imprimir")}</Boton>
          <a href={`/instrucciones/${locale}.pdf`} download className="tipo-boton inline-flex min-h-12 items-center rounded-full border-2 border-tinta px-5 hover:bg-papel-2">
            {t("descargar")}
          </a>
        </div>
        <div className="grid gap-6 rounded-[24px] bg-papel-2 p-5 sm:p-7 md:grid-cols-[minmax(0,420px)_1fr]">
          <EsquemaPlegado />
          <div className="space-y-3">
            <h2 className="tipo-subtitular text-xl">{t("plegado")}</h2>
            <p>{t("plegadoTexto")}</p>
            <p className="text-sm text-tinta-2">{t("impresion")}</p>
          </div>
        </div>
      </Seccion>

      {estado === "listo" && (
        <>
          <Hoja etiqueta={t("caraA")}>
            <CaraA t={textos} c={colores} p={personal} />
          </Hoja>
          <Hoja etiqueta={t("caraB")}>
            <CaraB t={textos} c={colores} p={personal} />
          </Hoja>
        </>
      )}
    </div>
  );
}

/** Una cara del folleto: en pantalla, escalada para caber; al imprimir, centrada en un A4 apaisado con marcas. */
function Hoja({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setEscala(Math.min(1, e!.contentRect.width / ANCHO_HOJA)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section aria-label={etiqueta} className="hoja-folleto mx-auto mb-12 w-full max-w-[1200px] px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
      <Micro className="mb-3 text-tinta-2 print:hidden">{etiqueta}</Micro>
      <div ref={ref} className="w-full print:w-auto">
        <div className="escala-pantalla relative" style={{ height: ALTO_HOJA * escala }}>
          <div className="escala-pantalla absolute left-0 top-0 origin-top-left shadow-[var(--shadow-carta)] print:shadow-none" style={{ transform: `scale(${escala})`, width: ANCHO_HOJA, height: ALTO_HOJA }}>
            {children}
            <PlieguesPantalla />
            <MarcasImpresion />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Líneas de pliegue discontinuas, solo en pantalla. */
function PlieguesPantalla() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 print:hidden">
      {[63, 126, 189].map((x) => (
        <span key={x} className="absolute bottom-0 top-0 border-l border-dashed border-cobalto/60" style={{ left: `${x}mm` }} />
      ))}
      <span className="absolute left-0 right-0 border-t border-dashed border-cobalto/60" style={{ top: "88mm" }} />
    </div>
  );
}

/** Marcas de corte (esquinas) y de pliegue (lados), fuera de la hoja; solo al imprimir. */
function MarcasImpresion() {
  const linea = "absolute bg-black";
  const g = "0.2mm";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden print:block">
      {(["izq", "der"] as const).flatMap((lado) =>
        (["arr", "aba"] as const).map((v) => {
          const x = lado === "izq" ? "-9mm" : "calc(100% + 3mm)";
          const y = v === "arr" ? "-9mm" : "calc(100% + 3mm)";
          return (
            <span key={`${lado}${v}`}>
              <span className={linea} style={{ left: x, top: v === "arr" ? 0 : "100%", width: "6mm", height: g }} />
              <span className={linea} style={{ top: y, left: lado === "izq" ? 0 : "100%", height: "6mm", width: g }} />
            </span>
          );
        }),
      )}
      {[63, 126, 189].map((x) => (
        <span key={x}>
          <span className={linea} style={{ left: `${x}mm`, top: "-7mm", height: "4mm", width: g }} />
          <span className={linea} style={{ left: `${x}mm`, top: "calc(100% + 3mm)", height: "4mm", width: g }} />
        </span>
      ))}
      <span className={linea} style={{ top: "88mm", left: "-7mm", width: "4mm", height: g }} />
      <span className={linea} style={{ top: "88mm", left: "calc(100% + 3mm)", width: "4mm", height: g }} />
    </div>
  );
}

/** Esquema en tres pasos: hoja abierta, plegada a lo largo y en acordeón. */
function EsquemaPlegado() {
  return (
    <svg viewBox="0 0 420 150" className="h-auto w-full" role="img" aria-labelledby="esquema-plegado-titulo">
      <title id="esquema-plegado-titulo">1 → 2 → 3</title>
      <g fill="none" stroke="#141414" strokeWidth="2">
        <rect x="6" y="20" width="168" height="117" rx="4" fill="#FFFFFF" />
        <line x1="6" y1="78.5" x2="174" y2="78.5" strokeDasharray="6 5" stroke="#2E56E6" />
        {[48, 90, 132].map((x) => (
          <line key={x} x1={x} y1="20" x2={x} y2="137" strokeDasharray="2 5" stroke="#5E584F" strokeWidth="1.5" />
        ))}
        <rect x="132" y="78.5" width="42" height="58.5" fill="#141414" />
        <rect x="132" y="78.5" width="10" height="14" fill="#F7739E" stroke="none" />
      </g>
      <path d="M186 78 h26 m-8 -7 l8 7 l-8 7" fill="none" stroke="#141414" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="none" stroke="#141414" strokeWidth="2">
        <rect x="222" y="50" width="120" height="58" rx="3" fill="#F5F0E6" />
        {[252, 282, 312].map((x, i) => (
          <line key={x} x1={x} y1="50" x2={x} y2="108" strokeDasharray="6 5" stroke={i % 2 ? "#E8402F" : "#2E56E6"} />
        ))}
        <rect x="312" y="50" width="30" height="58" fill="#141414" />
        <rect x="312" y="50" width="8" height="11" fill="#F7739E" stroke="none" />
      </g>
      <path d="M352 78 h20 m-8 -7 l8 7 l-8 7" fill="none" stroke="#141414" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <rect x="382" y="44" width="34" height="48" rx="3" fill="#141414" />
        <rect x="382" y="44" width="9" height="13" fill="#F7739E" />
        <text x="384" y="55" fontSize="11" fontWeight="800" fill="#141414">?</text>
      </g>
      <g fontSize="14" fontWeight="700" fill="#141414">
        <text x="6" y="14">1</text>
        <text x="222" y="42">2</text>
        <text x="382" y="36">3</text>
      </g>
    </svg>
  );
}
