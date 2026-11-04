import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BRAND_CONTACT_EMAIL, BRAND_NAME } from "@config/brand";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { CREDITOS_FOTOS } from "@/components/marco/creditosFotos";
import { Pie } from "@/components/marco/Pie";
import { Seccion } from "@/components/ui/Piezas";
import { textoEn } from "@/domain/precios/tipos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacidadPagina" });
  return { title: t("titulo") };
}

export default async function Privacidad({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacidadPagina");
  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        <Seccion className="max-w-[820px] space-y-8 py-14">
          <h1 className="tipo-titular text-[clamp(2.6rem,8vw,4.4rem)] leading-[0.9]">{t("titulo")}</h1>
          <p className="text-md">{t("intro")}</p>
          <section className="space-y-3 rounded-[var(--radius-carta)] bg-verde p-6 text-tinta">
            <h2 className="tipo-subtitular text-xl">{t("prototipoTitulo")}</h2>
            <p>{t("prototipo")}</p>
          </section>
          <section className="space-y-3">
            <h2 className="tipo-subtitular text-xl">{t("realTitulo")}</h2>
            <ul className="space-y-3">
              {(["1", "2", "3", "4", "5"] as const).map((k) => (
                <li key={k} className="flex gap-3 rounded-[14px] bg-blanco p-4">
                  <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-[3px] bg-rosa" />
                  <span>{t(`real.${k}`)}</span>
                </li>
              ))}
            </ul>
          </section>
          {/* Créditos de las fotos de muestra (el pie enlaza aquí) */}
          <section id="fotos" aria-labelledby="titulo-fotos" className="scroll-mt-24 space-y-3">
            <h2 id="titulo-fotos" className="tipo-subtitular text-xl">
              {t("fotosTitulo")}
            </h2>
            <p>{t("fotosTexto", { fuente: CREDITOS_FOTOS.fuente, marca: BRAND_NAME })}</p>
            <ul className="divide-y divide-linea rounded-[14px] bg-blanco px-4 text-sm">
              {CREDITOS_FOTOS.fotos.map((f) => (
                <li key={f.id} className="py-2.5">
                  {t.rich("fotosDe", {
                    descripcion: textoEn(f.descripcion, locale),
                    fotografo: f.fotografo,
                    enlace: (texto) => (
                      <a className="enlace" href={f.pagina}>
                        {texto}
                      </a>
                    ),
                  })}
                </li>
              ))}
            </ul>
            <p className="text-sm text-tinta-2">
              {t.rich("fotosLicencia", {
                licencia: CREDITOS_FOTOS.licencia.nombre,
                enlace: (texto) => (
                  <a className="enlace" href={CREDITOS_FOTOS.licencia.url}>
                    {texto}
                  </a>
                ),
              })}
            </p>
          </section>
          <p className="text-sm text-tinta-2">{t("contacto", { email: BRAND_CONTACT_EMAIL })}</p>
        </Seccion>
      </main>
      <Pie />
    </>
  );
}
