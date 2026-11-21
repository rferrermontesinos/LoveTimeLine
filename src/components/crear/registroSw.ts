/**
 * Cómo pide la página al service worker (public/sw.js) que guarde lo que ya ha cargado: el código
 * que se carga bajo demanda y las fuentes de las cartas no los cita el HTML, y sin conexión hacen
 * falta igual.
 */

/** Registros a los que ya se escucha por si aparece un service worker nuevo durante la visita. */
const escuchados = new WeakSet<ServiceWorkerRegistration>();

/**
 * Pide a los service workers del registro que guarden `urls()` (se lee en cada envío, con lo
 * cargado hasta ese momento). No basta con el activo: tras un despliegue, el nuevo se instala y
 * espera mientras haya pestañas con el viejo, y al activarse borra las copias del viejo. Por eso
 * también se avisa al que se instala o espera, y al que aparezca más tarde en esta misma visita.
 */
export function pedirQueGuarden(registro: ServiceWorkerRegistration, urls: () => string[]): void {
  const enviar = (sw: ServiceWorker | null) => sw?.postMessage({ tipo: "guardar", urls: urls() });
  for (const sw of new Set([registro.active, registro.waiting, registro.installing])) enviar(sw);
  if (escuchados.has(registro)) return;
  escuchados.add(registro);
  registro.addEventListener("updatefound", () => enviar(registro.installing));
}
