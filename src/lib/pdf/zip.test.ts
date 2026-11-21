import { describe, expect, it } from "vitest";
import { crc32, crearZip, leerZip } from "./zip";

describe("crc32", () => {
  it("da el valor de referencia de «123456789»", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("crearZip", () => {
  it("guarda cada archivo tal cual, con su nombre (también con acentos) y su CRC", () => {
    const archivos = [
      { nombre: "mazo-48-cartas-caras.pdf", bytes: new Uint8Array([37, 80, 68, 70, 1, 2, 3]) },
      { nombre: "mazo-48-cartas-reversos.pdf", bytes: new Uint8Array(100_000).map((_, i) => i % 251) },
      { nombre: "LÉEME.txt", bytes: new TextEncoder().encode("Página 1 ↔ página 1\r\n") },
    ];
    const leidos = leerZip(crearZip(archivos, new Date(2026, 10, 20, 16, 30)));
    expect(leidos.map((a) => a.nombre)).toEqual(archivos.map((a) => a.nombre));
    for (const [i, a] of leidos.entries()) {
      expect(Array.from(a.bytes)).toEqual(Array.from(archivos[i]!.bytes));
      expect(a.crc).toBe(crc32(archivos[i]!.bytes));
    }
  });

  it("un ZIP vacío es solo el final del directorio", () => {
    expect(crearZip([]).byteLength).toBe(22);
  });
});
