#!/usr/bin/env bash
# Prueba la migración, la semilla (dos veces: debe ser idempotente) y las reglas RLS sobre un
# Postgres 15+ vacío, imitando lo mínimo de Supabase. No necesita Docker ni el CLI de Supabase.
#
#   createdb prueba_portal
#   DATABASE_URL=postgres://localhost/prueba_portal pnpm db:test
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL con una base de datos vacía}"
cd "$(dirname "$0")/.."
psql_() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql_ < supabase/pruebas/simulacion-supabase.sql
# pg_cron y pg_net no están en un Postgres normal: la simulación ya crea lo que se usa de ellos.
for m in supabase/migrations/*.sql; do
  sed -E '/create extension if not exists (pg_cron|pg_net)/d' "$m" | psql_ > /dev/null
done
psql_ < supabase/seed.sql
psql_ < supabase/seed.sql
psql_ < supabase/pruebas/rls.sql 2>&1 | sed -E 's/^psql:[^ ]+ NOTICE:  /  /; s/^NOTICE:  /  /'
echo "✓ migración, semilla y RLS"
