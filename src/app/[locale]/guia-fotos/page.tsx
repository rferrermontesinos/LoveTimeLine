import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { URL_COLABORACION } from "@config/colaboracion";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { BotonEnlace } from "@/components/ui/Boton";
import { Chip, Micro, Seccion } from "@/components/ui/Piezas";
import { packsActivos } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

/** Los precios y los packs salen del catálogo: con la base conectada, la página se rehace cada 5 minutos. */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guia" });
  return { title: t("metaTitulo"), description: t("metaDescripcion") };
}

/** Los cuatro atajos del móvil, en el orden en que conviene usarlos. `buscar` vale igual en los dos. */
const ATAJOS = ["favoritas", "personas", "buscar", "album"] as const;
const CONSEJOS = ["1", "2", "3", "4", "5", "6"] as const;
/** Colores de la paleta que dejan leer la tinta encima. */
const COLORES = ["var(--color-amarillo)", "var(--color-rosa)", "var(--color-verde)", "var(--color-rojo)"];

/**
 * Guía para elegir las fotos: atajos de Fotos del iPhone y de Google Fotos, el ordenador, las fotos
 * de papel, las que tienen otros y qué fotos dan más juego. Pendiente de validar por Marc.
 */
export default async function GuiaFotos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guia");
  const n = await getTranslations("nav");
  const packs = packsActivos(await obtenerCatalogo());

  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        <Seccion className="pb-10 pt-12 sm:pt-16">
          <Micro className="text-tinta-2">{t("micro")}</Micro>
          <h1 className="tipo-titular mt-3 max-w-3xl text-[clamp(2.6rem,8vw,5rem)] leading-[0.9]">{t("titulo")}</h1>
          <p className="mt-5 max-w-2xl text-md text-tinta-2">{t("intro")}</p>
          <div data-testid="guia-cuantas" className="mt-8 max-w-2xl rounded-[var(--radius-carta)] bg-blanco p-5">
            <h2 className="tipo-subtitular text-lg">{t("cuantasTitulo")}</h2>
            <p className="mt-1 text-tinta-2">{t("cuantasTexto")}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {packs.map((p) => (
                <li key={p.id}>
                  <Chip className="text-tinta">{t("packCartas", { pack: textoEn(p.nombre, locale), n: p.cartas })}</Chip>
                </li>
              ))}
            </ul>
          </div>
        </Seccion>

        {/* Atajos del móvil: qué hacer en el iPhone y en Android */}
        <Seccion className="pb-14">
          <h2 className="tipo-titular text-3xl">{t("atajosTitulo")}</h2>
          <p className="mt-3 max-w-2xl text-md text-tinta-2">{t("atajosTexto")}</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {ATAJOS.map((a, i) => (
              <li key={a} data-atajo={a} className="rounded-[var(--radius-carta)] bg-blanco p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="tipo-titular mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-tinta" style={{ background: COLORES[i] }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="tipo-subtitular text-lg">{t(`atajos.${a}.titulo`)}</h3>
                    <p className="mt-1 text-tinta-2">{t(`atajos.${a}.texto`)}</p>
                  </div>
                </div>
                {a === "buscar" ? (
                  <p className="mt-4 rounded-[12px] bg-papel-2 px-4 py-3 text-sm">{t("atajos.buscar.comun")}</p>
                ) : (
                  <dl className="mt-4 space-y-2 text-sm">
                    {(["iphone", "android"] as const).map((sistema) => (
                      <div key={sistema} className="rounded-[12px] bg-papel-2 px-4 py-3">
                        <dt className="font-semibold">{t(sistema)}</dt>
                        <dd className="mt-0.5">{t(`atajos.${a}.${sistema}`)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {a === "album" && <p className="mt-3 text-sm font-semibold">{t("atajos.album.despues")}</p>}
              </li>
            ))}
          </ol>
        </Seccion>

        {/* Ordenador, papel y fotos de otros */}
        <Seccion className="pb-16">
          <div className="grid gap-4 md:grid-cols-3">
            <section className="rounded-[var(--radius-carta)] bg-papel-2 p-5 sm:p-6">
              <h2 className="tipo-subtitular text-xl">{t("ordenadorTitulo")}</h2>
              <p className="mt-2 text-tinta-2">{t("ordenadorTexto")}</p>
            </section>
            <section className="rounded-[var(--radius-carta)] bg-papel-2 p-5 sm:p-6">
              <h2 className="tipo-subtitular text-xl">{t("papelTitulo")}</h2>
              <p className="mt-2 text-tinta-2">{t("papelTexto")}</p>
            </section>
            <section data-testid="guia-otros" className="rounded-[var(--radius-carta)] bg-papel-2 p-5 sm:p-6">
              <h2 className="tipo-subtitular text-xl">{t("otrosTitulo")}</h2>
              {/* El enlace para pedir fotos solo se ofrece si el servicio está configurado. */}
              {URL_COLABORACION && <p className="mt-2 text-tinta-2">{t("otrosEnlace")}</p>}
              <p className="mt-2 text-tinta-2">{t("otrosWhatsapp")}</p>
            </section>
          </div>
        </Seccion>

        {/* Qué fotos funcionan en la partida */}
        <div className="bg-tinta py-16 text-papel">
          <Seccion>
            <h2 className="tipo-titular max-w-3xl text-3xl">{t("juegoTitulo")}</h2>
            <p className="mb-8 mt-4 max-w-2xl text-md text-papel/80">{t("juegoTexto")}</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CONSEJOS.map((c, i) => (
                <li key={c} data-consejo={c} className="rounded-[var(--radius-carta)] bg-[#1f1f1f] p-5">
                  <span aria-hidden="true" className="block h-2 w-10 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                  <h3 className="tipo-subtitular mt-3 text-lg">{t(`consejos.${c}.titulo`)}</h3>
                  <p className="mt-1 text-papel/85">{t(`consejos.${c}.texto`)}</p>
                </li>
              ))}
            </ul>
          </Seccion>
        </div>

        <Seccion className="py-16">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-rosa p-8 sm:p-10">
            <div className="max-w-xl">
              <h2 className="tipo-titular text-3xl">{t("ctaTitulo")}</h2>
              <p className="mt-3 text-md">{t("ctaTexto")}</p>
            </div>
            <BotonEnlace href="/crear" tamano="lg">
              {n("crear")}
            </BotonEnlace>
          </div>
        </Seccion>
      </main>
      <Pie />
    </>
  );
}
