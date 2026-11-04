import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { Abanico } from "@/components/inicio/Abanico";
import { CartaVolteable, EjemplosPrecision } from "@/components/inicio/CartaVolteable";
import { BotonEnlace } from "@/components/ui/Boton";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Micro, Pestana, Seccion } from "@/components/ui/Piezas";
import { formatearImporte, precioDesde } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

const MODOS = ["guardian", "cooperativo", "clasico", "duelo", "generaciones"] as const;
const COLOR_MODO: Record<(typeof MODOS)[number], string> = {
  guardian: "var(--color-rosa)",
  cooperativo: "var(--color-verde)",
  clasico: "var(--color-amarillo)",
  duelo: "var(--color-rojo)",
  generaciones: "var(--color-papel)",
};

export default async function Inicio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("inicio");
  const tm = await getTranslations("modos");
  const tc = await getTranslations("comun");
  const catalogo = await obtenerCatalogo();
  const desde = precioDesde(catalogo);
  const precio = (cents: number) => formatearImporte(cents, catalogo.moneda, locale);
  const mecanicas = catalogo.mecanicas.filter((m) => m.activo);

  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        {/* Portada */}
        <Seccion className="grid items-center gap-10 pb-16 pt-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
          <div className="space-y-6 [animation:aparecer_500ms_var(--ease-salida)_both]">
            <Micro className="text-rosa-texto">{t("heroAntetitulo")}</Micro>
            <h1 className="tipo-titular text-[clamp(3.1rem,10.5vw,6.6rem)] leading-[0.88]">{t("heroTitulo")}</h1>
            <p className="max-w-[34rem] text-md text-tinta-2">{t("heroTexto")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <BotonEnlace href="/crear" tamano="lg">
                {t("heroCta")}
              </BotonEnlace>
              <BotonEnlace href="/como-jugar" variante="secundario" tamano="lg">
                {t("heroSecundario")}
              </BotonEnlace>
            </div>
            {desde && <p className="text-sm font-semibold">{t("heroPrecio", { precio: precio(desde.cents) })}</p>}
          </div>
          <div className="mesa relative -mx-4 overflow-hidden rounded-none px-4 py-10 sm:mx-0 sm:rounded-[28px]">
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

        {/* Formas de jugar */}
        <div className="bg-tinta py-16 text-papel">
          <Seccion>
            <h2 className="tipo-titular max-w-3xl text-3xl">{t("modosTitulo")}</h2>
            <p className="mt-4 max-w-2xl text-md text-papel/80">{t("modosTexto")}</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {MODOS.map((m) => (
                <li key={m} className="relative overflow-hidden rounded-[var(--radius-carta)] bg-[#1f1f1f] p-5 pt-[4.6rem]">
                  <Pestana color={COLOR_MODO[m]}>?</Pestana>
                  <h3 className="tipo-titular text-xl">{tm(`${m}.nombre`)}</h3>
                  <p className="tipo-micro mt-1 text-micro text-papel/70">{tm(`${m}.jugadores`)}</p>
                  <p className="mt-3 text-sm text-papel/85">{tm(`${m}.resumen`)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <BotonEnlace href="/como-jugar" variante="acento" color="var(--color-amarillo)">
                {t("heroSecundario")}
              </BotonEnlace>
            </div>
          </Seccion>
        </div>

        {/* Mecánicas gratis */}
        <Seccion className="py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="tipo-titular text-3xl">{t("mecanicasTitulo")}</h2>
              <p className="mt-4 text-md text-tinta-2">{t("mecanicasTexto")}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {mecanicas.map((m) => (
                <li key={m.id} className="flex gap-4 rounded-[var(--radius-carta)] bg-blanco p-5">
                  <IconoMecanica id={m.id} />
                  <div>
                    <h3 className="font-bold">{textoEn(m.nombre, locale)}</h3>
                    <p className="mt-1 text-sm text-tinta-2">{textoEn(m.descripcion, locale)}</p>
                    <p className="tipo-micro mt-2 text-micro text-verde-texto">{tc("gratis")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Seccion>

        {/* Precios */}
        <Seccion id="precios" className="scroll-mt-24 py-16">
          <h2 className="tipo-titular text-3xl">{t("preciosTitulo")}</h2>
          <p className="mt-4 max-w-2xl text-md text-tinta-2">{t("preciosTexto")}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {catalogo.packs
              .filter((p) => p.activo)
              .map((p, i) => (
                <article key={p.id} className="relative flex flex-col overflow-hidden rounded-[var(--radius-carta)] bg-blanco p-6 pt-24 shadow-[var(--shadow-carta)]">
                  <Pestana tamano="lg" color={i === 0 ? "var(--color-rosa)" : "var(--color-verde)"}>
                    {p.cartas}
                  </Pestana>
                  <h3 className="tipo-titular text-2xl">{textoEn(p.nombre, locale)}</h3>
                  <p className="mt-1 text-tinta-2">{textoEn(p.descripcion, locale)}</p>
                  <p className="tipo-titular mt-6 text-[3.6rem] leading-none">{precio(p.precioCents)}</p>
                  <ul className="mt-4 space-y-1 text-sm">
                    <li>· {t("packCartas", { n: p.cartas })}</li>
                    <li>· {t("packIncluye")}</li>
                    <li>· {t("ampliacion", { n: catalogo.ampliacion.bloqueCartas, precio: precio(catalogo.ampliacion.precioBloqueCents) })}</li>
                  </ul>
                  <div className="mt-6">
                    <BotonEnlace href={`/crear?pack=${p.id}`} className="w-full sm:w-auto">
                      {tc("desde", { precio: precio(p.precioCents) })} · {textoEn(p.nombre, locale)}
                    </BotonEnlace>
                  </div>
                </article>
              ))}
          </div>
          <h3 className="tipo-subtitular mt-12 text-lg">{t("extrasTitulo")}</h3>
          <ul className="mt-4 divide-y divide-linea rounded-[var(--radius-carta)] bg-blanco px-5">
            {catalogo.extras
              .filter((x) => x.activo)
              .map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                  <div className="max-w-2xl">
                    <p className="font-semibold">{textoEn(x.nombre, locale)}</p>
                    <p className="text-sm text-tinta-2">{textoEn(x.descripcion, locale)}</p>
                  </div>
                  <p className="tipo-subtitular text-md">{x.precio.tipo === "fijo" ? `+${precio(x.precio.cents)}` : `${x.precio.porcentaje} %`}</p>
                </li>
              ))}
          </ul>
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
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-md font-semibold">
                  {t(`faq.${n}.p`)}
                  <span aria-hidden="true" className="tipo-titular text-xl transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-3xl text-tinta-2">{t(`faq.${n}.r`)}</p>
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
    </>
  );
}
