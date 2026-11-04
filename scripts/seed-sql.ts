/**
 * Genera supabase/seed.sql a partir de supabase/catalogo.json (la única fuente del catálogo).
 *   pnpm db:seed
 * Después: `supabase db reset` en local, o pegar seed.sql en el editor SQL del proyecto.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import catalogo from "../supabase/catalogo.json";
import type { Catalogo } from "../src/domain/precios/tipos";
import { semillaSql } from "../src/lib/servidor/semilla-sql";

async function main() {
  const destino = path.join(process.cwd(), "supabase", "seed.sql");
  await writeFile(destino, semillaSql(catalogo as unknown as Catalogo));
  console.log(`✓ ${path.relative(process.cwd(), destino)}`);
}

void main();
