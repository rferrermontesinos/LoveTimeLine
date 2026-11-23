import { describe, expect, it } from "vitest";
import { pedirQueGuarden } from "./registroSw";

/** Un service worker falso que apunta lo que le mandan. */
function trabajador(nombre: string) {
  const recibidos: unknown[] = [];
  return { nombre, recibidos, postMessage: (m: unknown) => void recibidos.push(m) };
}

type Trabajador = ReturnType<typeof trabajador>;

/** Un registro falso con sus tres huecos y el evento `updatefound`. */
function registro(e: { active?: Trabajador; waiting?: Trabajador; installing?: Trabajador }) {
  const oyentes: (() => void)[] = [];
  const r = {
    active: e.active ?? null,
    waiting: e.waiting ?? null,
    installing: e.installing ?? null,
    addEventListener: (tipo: string, f: () => void) => {
      if (tipo === "updatefound") oyentes.push(f);
    },
    /** El navegador encuentra otra versión y empieza a instalarla. */
    nuevaVersion(sw: Trabajador) {
      r.installing = sw;
      for (const f of oyentes) f();
    },
    oyentes,
  };
  return r;
}

const comoRegistro = (r: ReturnType<typeof registro>) => r as unknown as ServiceWorkerRegistration;

describe("pedirQueGuarden", () => {
  it("con un solo service worker, se lo pide al activo", () => {
    const activo = trabajador("v1");
    pedirQueGuarden(comoRegistro(registro({ active: activo })), () => ["/_next/static/chunks/editor.js"]);
    expect(activo.recibidos).toEqual([{ tipo: "guardar", urls: ["/_next/static/chunks/editor.js"] }]);
  });

  it("tras un despliegue, también al nuevo que se instala o espera (el que borrará las copias del activo)", () => {
    const activo = trabajador("v1");
    const instalando = trabajador("v2");
    pedirQueGuarden(comoRegistro(registro({ active: activo, installing: instalando })), () => ["/fonts/cartas/a.woff2"]);
    expect(activo.recibidos).toHaveLength(1);
    expect(instalando.recibidos).toEqual([{ tipo: "guardar", urls: ["/fonts/cartas/a.woff2"] }]);

    const esperando = trabajador("v3");
    pedirQueGuarden(comoRegistro(registro({ active: trabajador("v1"), waiting: esperando })), () => []);
    expect(esperando.recibidos).toHaveLength(1);
  });

  it("una versión que aparece más tarde en la visita recibe lo cargado hasta entonces, sin escuchar dos veces", () => {
    const r = registro({ active: trabajador("v1") });
    let cargado = ["/_next/static/chunks/main.js"];
    pedirQueGuarden(comoRegistro(r), () => cargado);
    // Se reintenta (al volver la conexión): no se añade otro oyente.
    pedirQueGuarden(comoRegistro(r), () => cargado);
    expect(r.oyentes).toHaveLength(1);

    cargado = [...cargado, "/_next/static/chunks/editor.js"];
    const nueva = trabajador("v2");
    r.nuevaVersion(nueva);
    expect(nueva.recibidos).toEqual([{ tipo: "guardar", urls: ["/_next/static/chunks/main.js", "/_next/static/chunks/editor.js"] }]);
  });

  it("el mismo service worker en dos huecos recibe la lista una sola vez", () => {
    const sw = trabajador("v1");
    pedirQueGuarden(comoRegistro(registro({ active: sw, waiting: sw })), () => []);
    expect(sw.recibidos).toHaveLength(1);
  });
});
