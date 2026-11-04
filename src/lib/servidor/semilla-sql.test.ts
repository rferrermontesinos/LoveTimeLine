import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import catalogo from "../../../supabase/catalogo.json";
import type { Catalogo } from "@/domain/precios/tipos";
import { semillaSql } from "./semilla-sql";

const semilla = catalogo as unknown as Catalogo;

describe("seed.sql", () => {
  it("está al día con catalogo.json (si falla: pnpm db:seed)", () => {
    const actual = readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
    expect(actual).toBe(semillaSql(semilla));
  });

  it("escapa las comillas simples de los textos", () => {
    const sql = semillaSql({ ...semilla, packs: [{ ...semilla.packs[0]!, nombre: { es: "L'Amor", en: "Love's" } }] });
    expect(sql).toContain(`'{"es":"L''Amor","en":"Love''s"}'::jsonb`);
  });

  it("guarda el precio de cada extra según su tipo", () => {
    const sql = semillaSql(semilla);
    expect(sql).toMatch(/\('copia-extra', 1, true, 'porcentajeMazo', null, 60, null, null,/);
    expect(sql).toMatch(/\('caja-personalizada', 4, true, 'fijo', 700, null, null, 'caja-personalizada',/);
  });

  it("deja lo retirado sin borrar, como inactivo", () => {
    const sql = semillaSql(semilla);
    expect(sql).toMatch(/\('pack-retos', 10, false, 'fijo', 600, null, 12, null,/);
    expect(sql).toMatch(/\('pareja', 11, false, 40, 4900,/);
  });
});
