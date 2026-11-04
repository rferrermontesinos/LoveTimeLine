import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { EjemplosPrecision } from "@/components/inicio/CartaVolteable";
import { BotonEnlace } from "@/components/ui/Boton";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Micro, Pestana, Seccion } from "@/components/ui/Piezas";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "juego" });
  return { title: t("titulo"), description: t("intro") };
}

const PASOS = [
  { titulo: "componentes", texto: "componentesTexto", color: "var(--color-rosa)" },
  { titulo: "preparacion", texto: "preparacionTexto", color: "var(--color-amarillo)" },
  { titulo: "turno", texto: "turnoTexto", color: "var(--color-verde)" },
  { titulo: "final", texto: "finalTexto", color: "var(--color-rojo)" },
] as const;

const MECANICAS = [
  { id: "estrella", clave: "estrella" },
  { id: "cuentalo", clave: "cuentalo" },
  { id: "comodin", clave: "comodin" },
  { id: "en-blanco", clave: "enBlanco" },
] as const;

const MODOS = ["guardian", "cooperativo", "clasico", "duelo", "generaciones"] as const;
const COLOR_MODO: Record<(typeof MODOS)[number], string> = {
  guardian: "var(--color-rosa)",
  cooperativo: "var(--color-verde)",
  clasico: "var(--color-amarillo)",
  duelo: "var(--color-rojo)",
  generaciones: "var(--color-papel)",
};

export default async function ComoJugar({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("juego");
  const tm = await getTranslations("modos");
  const n = await getTranslations("nav");
  const ti = await getTranslations("instrucciones");

  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        <Seccion className="pb-10 pt-12 sm:pt-16">
          <Micro className="text-tinta-2">{n("comoJugar")}</Micro>
          <h1 className="tipo-titular mt-3 max-w-3xl text-[clamp(2.6rem,8vw,5rem)] leading-[0.9]">{t("titulo")}</h1>
          <p className="mt-5 max-w-2xl text-md text-tinta-2">{t("intro")}</p>
        </Seccion>

        <Seccion className="pb-14">
          <ol className="grid gap-4 md:grid-cols-2">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="relative overflow-hidden rounded-[var(--radius-carta)] bg-blanco p-6 pl-[4.5rem] pt-7">
                <Pestana color={p.color}>{i + 1}</Pestana>
                <h2 className="tipo-subtitular text-xl">{t(p.titulo)}</h2>
                <p className="mt-2 text-tinta-2">{t(p.texto)}</p>
              </li>
            ))}
          </ol>
        </Seccion>

        <Seccion className="pb-16">
          <div className="grid items-center gap-8 rounded-[28px] bg-papel-2 p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div>
              <h2 className="tipo-titular text-3xl">{t("fechas")}</h2>
              <p className="mt-4 max-w-xl text-md text-tinta-2">{t("fechasTexto")}</p>
            </div>
            <EjemplosPrecision idioma={locale} />
          </div>
        </Seccion>

        <Seccion className="pb-16">
          <h2 className="tipo-titular text-3xl">{t("mecanicasTitulo")}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {MECANICAS.map((m) => (
              <li key={m.id} className="flex gap-4 rounded-[var(--radius-carta)] bg-blanco p-5">
                <IconoMecanica id={m.id} />
                <p className="pt-1">{t(m.clave)}</p>
              </li>
            ))}
          </ul>
        </Seccion>

        <div className="bg-tinta py-16 text-papel">
          <Seccion>
            <h2 className="tipo-titular max-w-3xl text-3xl">{t("modosTitulo")}</h2>
            <p className="mt-4 max-w-2xl text-md text-papel/80">{t("modosTexto")}</p>
            <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {MODOS.map((m) => (
                <li key={m} className="relative overflow-hidden rounded-[var(--radius-carta)] bg-[#1f1f1f] p-6 pt-[4.8rem]">
                  <Pestana color={COLOR_MODO[m]}>?</Pestana>
                  <h3 className="tipo-titular text-2xl">{tm(`${m}.nombre`)}</h3>
                  <p className="tipo-micro mt-1 text-micro text-papel/70">{tm(`${m}.jugadores`)}</p>
                  <p className="mt-3 text-papel/90">{t(`modos.${m}`)}</p>
                </li>
              ))}
              <li className="flex items-end rounded-[var(--radius-carta)] bg-amarillo p-6 text-tinta">
                <p className="tipo-subtitular text-xl">{t("consejo")}</p>
              </li>
            </ul>
          </Seccion>
        </div>

        <Seccion className="py-16">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-rosa p-8 sm:p-10">
            <div className="max-w-xl">
              <h2 className="tipo-titular text-3xl">{ti("titulo")}</h2>
              <p className="mt-3">{ti("texto")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <BotonEnlace href="/instrucciones">{ti("titulo")}</BotonEnlace>
              <BotonEnlace href="/crear" variante="secundario">
                {n("crear")}
              </BotonEnlace>
            </div>
          </div>
        </Seccion>
      </main>
      <Pie />
    </>
  );
}
