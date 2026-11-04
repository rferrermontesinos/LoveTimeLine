import { getTranslations, setRequestLocale } from "next-intl/server";
import { PRINT } from "@config/print";
import { Link } from "@/i18n/navigation";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { Abanico } from "@/components/inicio/Abanico";
import { CartaVolteable, EjemplosPrecision } from "@/components/inicio/CartaVolteable";
import { ContinuarMazo } from "@/components/inicio/ContinuarMazo";
import { SelectorPacks } from "@/components/inicio/SelectorPacks";
import { BotonEnlace } from "@/components/ui/Boton";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Micro, Pestana, Seccion } from "@/components/ui/Piezas";
import { CARTAS_POR_PERSONA } from "@/domain/juego/reglas";
import { formatearImporte } from "@/domain/precios/cotizar";
import { textoEn, type Extra } from "@/domain/precios/tipos";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

const MODOS = ["clasico", "historia"] as const;
const COLOR_MODO: Record<(typeof MODOS)[number], string> = {
  clasico: "var(--color-amarillo)",
  historia: "var(--color-verde)",
};

const porOrden = <T extends { orden: number }>(a: T, b: T) => a.orden - b.orden;

export default async function Inicio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("inicio");
  const tm = await getTranslations("modos");
  const tc = await getTranslations("comun");
  const catalogo = await obtenerCatalogo();
  const mecanicas = catalogo.mecanicas.filter((m) => m.activo).sort(porOrden);
  const extras = catalogo.extras.filter((x) => x.activo).sort(porOrden);
  const precioExtra = (x: Extra) =>
    x.precio.tipo === "fijo"
      ? `+${formatearImporte(x.precio.cents, catalogo.moneda, locale)}`
      : t("extraPorcentaje", { porcentaje: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(x.precio.porcentaje / 100) });

  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        {/* Portada: el título, los packs a primera vista y el abanico de cartas */}
        <Seccion className="grid items-center gap-x-12 gap-y-8 pb-14 pt-4 sm:pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="[animation:aparecer_500ms_var(--ease-salida)_both]">
            <Micro className="text-rosa-texto">{t("heroAntetitulo")}</Micro>
            <h1 className="tipo-titular mt-3 text-[clamp(2.7rem,9.5vw,4.75rem)] leading-[0.88]">{t("heroTitulo")}</h1>
            <p className="mt-4 max-w-[36rem] text-base text-tinta-2 sm:text-md">{t("heroTexto")}</p>
            <div className="mt-5 sm:mt-6">
              <SelectorPacks id="precios" catalogo={catalogo} idioma={locale} />
            </div>
            <Link href="/como-jugar" className="enlace mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold">
              {t("heroSecundario")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="mesa relative -mx-4 overflow-hidden px-4 py-8 sm:mx-0 sm:rounded-[28px] lg:py-12">
            <Abanico idioma={locale} />
          </div>
        </Seccion>

        {/* Cómo funciona */}
        <Seccion className="py-14" etiqueta={t("comoTitulo")}>
          <h2 className="tipo-titular mb-8 text-3xl">{t("comoTitulo")}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {(["1", "2", "3"] as const).map((n, i) => (
              <li key={n} className="relative overflow-hidden rounded-[var(--radius-carta)] bg-blanco p-6 pl-16 pt-7">
                <Pestana color={["var(--color-rosa)", "var(--color-amarillo)", "var(--color-verde)"][i]}>{n}</Pestana>
                <h3 className="tipo-subtitular text-lg">{t(`como.${n}.titulo`)}</h3>
                <p className="mt-2 text-tinta-2">{t(`como.${n}.texto`)}</p>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* Dos caras */}
        <Seccion className="py-14">
          <div className="grid items-center gap-10 rounded-[28px] bg-papel-2 p-6 sm:p-10 lg:grid-cols-[auto_1fr]">
            <CartaVolteable idioma={locale} />
            <div className="space-y-5">
              <h2 className="tipo-titular text-3xl">{t("cartasTitulo")}</h2>
              <p className="max-w-xl text-md text-tinta-2">{t("cartasTexto")}</p>
              <p className="font-semibold">{t("cartasPrecision")}</p>
              <div className="max-w-md">
                <EjemplosPrecision idioma={locale} />
                <p className="sr-only">{t("ejemplosPrecision")}</p>
              </div>
            </div>
          </div>
        </Seccion>

        {/* Tipos de juego */}
        <div className="bg-tinta py-16 text-papel">
          <Seccion etiqueta={t("tipos.titulo")}>
            <h2 className="tipo-titular max-w-3xl text-3xl">{t("tipos.titulo")}</h2>
            <p className="mt-4 max-w-2xl text-md text-papel/80">{t("tipos.texto", { n: CARTAS_POR_PERSONA })}</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {MODOS.map((m, i) => (
                <li key={m} data-modo={m} className="relative flex flex-col overflow-hidden rounded-[var(--radius-carta)] bg-[#1f1f1f] p-5 pt-[4.6rem] sm:p-6 sm:pt-[4.8rem]">
                  <Pestana color={COLOR_MODO[m]}>{i + 1}</Pestana>
                  <h3 className="tipo-titular text-2xl">{tm(`${m}.nombre`)}</h3>
                  <p className="tipo-micro mt-1 text-micro text-papel/70">
                    {tm(`${m}.etiqueta`)} · {tm(`${m}.jugadores`)}
                  </p>
                  <p className="mt-3 flex-1 text-papel/85">{tm(`${m}.resumen`)}</p>
                  <Link
                    href={`/como-jugar#${m}`}
                    className="mt-4 inline-flex min-h-11 items-center gap-1.5 self-start font-semibold underline decoration-2 underline-offset-4 hover:decoration-[3px]"
                    style={{ textDecorationColor: COLOR_MODO[m] }}
                  >
                    {t(`tipos.reglas.${m}`)}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Seccion>
        </div>

        {/* Extras de juego (gratis) y extras opcionales (de pago) */}
        <Seccion className="space-y-14 py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="tipo-titular text-3xl">{t("mecanicasTitulo")}</h2>
              <p className="mt-4 text-md text-tinta-2">{t("mecanicasTexto")}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {mecanicas.map((m) => (
                <li key={m.id} className="flex gap-4 rounded-[var(--radius-carta)] bg-blanco p-5">
                  <IconoMecanica icono={m.icono} />
                  <div>
                    <h3 className="font-bold">{textoEn(m.nombre, locale)}</h3>
                    <p className="mt-1 text-sm text-tinta-2">{textoEn(m.descripcion, locale)}</p>
                    <p className="tipo-micro mt-2 text-micro text-verde-texto">{tc("gratis")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="tipo-titular text-3xl">{t("extrasTitulo")}</h2>
              <p className="mt-4 text-md text-tinta-2">{t("extrasTexto")}</p>
            </div>
            <ul className="divide-y divide-linea rounded-[var(--radius-carta)] bg-blanco px-5">
              {extras.map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-4">
                  <div className="min-w-0 max-w-xl flex-1">
                    <h3 className="font-semibold">{textoEn(x.nombre, locale)}</h3>
                    <p className="text-sm text-tinta-2">{textoEn(x.descripcion, locale)}</p>
                  </div>
                  <p className="tipo-subtitular text-md">{precioExtra(x)}</p>
                </li>
              ))}
            </ul>
          </div>
        </Seccion>

        {/* Privacidad */}
        <Seccion className="py-16">
          <div className="rounded-[28px] bg-verde p-6 sm:p-10">
            <h2 className="tipo-titular text-3xl">{t("privacidadTitulo")}</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {(["1", "2", "3", "4"] as const).map((n) => (
                <li key={n} className="flex gap-3 text-md">
                  <span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-tinta" />
                  {t(`privacidad.${n}`)}
                </li>
              ))}
            </ul>
          </div>
        </Seccion>

        {/* Preguntas */}
        <Seccion className="py-16">
          <h2 className="tipo-titular text-3xl">{t("faqTitulo")}</h2>
          <div className="mt-6 divide-y divide-linea border-y border-linea">
            {(["1", "2", "3", "4", "5"] as const).map((n) => (
              <details key={n} className="group py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-md font-semibold">
                  {t(`faq.${n}.p`)}
                  <span aria-hidden="true" className="tipo-titular text-xl transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-3xl text-tinta-2">{t(`faq.${n}.r`, { ancho: PRINT.carta.anchoMm, alto: PRINT.carta.altoMm })}</p>
              </details>
            ))}
          </div>
        </Seccion>

        {/* Llamada final */}
        <Seccion className="py-10">
          <div className="relative overflow-hidden rounded-[28px] bg-rosa p-8 pl-20 sm:p-12 sm:pl-28">
            <Pestana tamano="lg" color="var(--color-rojo)">
              ?
            </Pestana>
            <h2 className="tipo-titular text-3xl">{t("ctaTitulo")}</h2>
            <p className="mt-3 max-w-xl text-md">{t("ctaTexto")}</p>
            <div className="mt-6">
              <BotonEnlace href="/crear" tamano="lg">
                {t("heroCta")}
              </BotonEnlace>
            </div>
          </div>
        </Seccion>
      </main>
      <Pie />
      <ContinuarMazo />
    </>
  );
}
