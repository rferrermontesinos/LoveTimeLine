import { describe, expect, it } from "vitest";
import { asignarIconos, hashTexto, type MecanicaIcono } from "./asignar";

const ESTRELLA: MecanicaIcono = { id: "estrella", icono: "estrella", asignacion: "manual", maxCartas: 2 };
/** Mecánica automática de ejemplo: un icono cada 4 cartas, sin que nadie las elija. */
const AUTOMATICA: MecanicaIcono = { id: "automatica", icono: "x", asignacion: "automatica", cadaN: 4 };

const cartas = (n: number, destacadas: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({ id: `carta-${i}`, destacada: destacadas.includes(i) }));

describe("asignarIconos", () => {
  it("respeta el máximo de estrellas y no repite iconos en una carta", () => {
    const r = asignarIconos(cartas(20, [1, 2, 3]), [ESTRELLA, AUTOMATICA]);
    expect([...r.values()].filter((v) => v === "estrella")).toHaveLength(2);
    expect(r.get("carta-3")).not.toBe("estrella");
    expect([...r.values()].filter((v) => v === "x")).toHaveLength(5);
  });

  it("es estable: la misma carta recibe siempre el mismo icono", () => {
    const a = asignarIconos(cartas(40), [AUTOMATICA]);
    const b = asignarIconos([...cartas(40)].reverse(), [AUTOMATICA]);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("sin mecánicas no asigna nada", () => {
    expect(asignarIconos(cartas(10, [1]), []).size).toBe(0);
  });

  it("el hash es determinista", () => {
    expect(hashTexto("hola")).toBe(hashTexto("hola"));
    expect(hashTexto("hola")).not.toBe(hashTexto("adiós"));
  });
});
