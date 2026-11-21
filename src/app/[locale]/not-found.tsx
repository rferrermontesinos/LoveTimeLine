import { useTranslations } from "next-intl";
import { BotonEnlace } from "@/components/ui/Boton";
import { Pestana } from "@/components/ui/Piezas";

export default function NoEncontrada() {
  const t = useTranslations("errores");
  return (
    <main id="contenido" className="mx-auto grid min-h-[80dvh] max-w-[1200px] place-items-center px-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-carta)] bg-tinta p-8 pt-28 text-papel shadow-[var(--shadow-carta)]">
        <Pestana tamano="lg">?</Pestana>
        <h1 className="tipo-titular text-4xl leading-[0.95]">{t("noEncontrada")}</h1>
        <div className="mt-8">
          <BotonEnlace href="/" variante="acento" color="var(--color-rosa)">
            {t("volverInicio")}
          </BotonEnlace>
        </div>
      </div>
    </main>
  );
}
