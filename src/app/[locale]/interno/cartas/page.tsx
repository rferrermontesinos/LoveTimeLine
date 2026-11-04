import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { textoEn } from "@/domain/precios/tipos";
import { textosInternos } from "@/lib/carta/textosInternos";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";
import { Muestrario, type MecanicaMuestrario } from "./Muestrario";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = textosInternos(locale).muestrario;
  return { title: t.titulo, description: t.texto, robots: { index: false, follow: false, nocache: true } };
}

/** Muestrario interno: todas las caras de la plantilla con datos de ejemplo, para validarlas antes de imprimir. */
export default async function Cartas({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const catalogo = await obtenerCatalogo();
  // Icono de cada mecánica tal como lo asigna el catálogo: el dibujo no conoce ids de iconos.
  const mecanicas: MecanicaMuestrario[] = catalogo.mecanicas
    .filter((m) => m.activo && m.icono)
    .sort((a, b) => a.orden - b.orden)
    .map((m) => ({ id: m.id, icono: m.icono!, nombre: textoEn(m.nombre, locale) }));
  return (
    <>
      <CintaPrototipo />
      <Cabecera ocultarCta />
      <main id="contenido">
        <Muestrario mecanicas={mecanicas} />
      </main>
    </>
  );
}
