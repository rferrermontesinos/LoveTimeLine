/*
 * Service worker del portal, escrito a mano y sin dependencias. Solo sirve para reabrir el
 * configurador sin conexión: el mazo y sus fotos ya viven en el dispositivo (IndexedDB), así que
 * basta con tener a mano las páginas y su código.
 *
 * - Páginas del configurador y de la confirmación (/es/crear, /en/pedido/confirmado…): red
 *   primero y, sin red, la última copia. La copia se guarda sin la consulta (?pack=,
 *   ?session_id=…) y solo de visitas sin consulta, porque la página puede depender de ella.
 * - Código y fuentes (/_next/static/…, /fonts/…): caché primero. Sus nombres cambian cuando
 *   cambia su contenido, así que una copia nunca se queda vieja.
 * - Nada más pasa por aquí: ni /api/, ni las peticiones RSC de la navegación interna, ni nada
 *   personal (las fotos nunca salen del dispositivo).
 *
 * La versión llega en la URL del registro (/sw.js?v=…) y cambia en cada compilación. Tras
 * desplegar, el navegador instala el nuevo, que prepara sus propias copias; cuando se cierran las
 * pestañas que usaban el anterior, se activa y borra las copias de las versiones viejas. Lo que el
 * HTML no cita (el código que se carga bajo demanda) se lo manda la página también al nuevo
 * mientras espera (src/components/crear/registroSw.ts), y las fuentes de las cartas, que solo se
 * cargan desde JS, las guarda él mismo al instalarse. Para retirarlo algún día, se publica un sw.js
 * que se dé de baja (self.registration.unregister()).
 *
 * Las funciones de arriba son puras y se prueban en src/components/crear/sw.test.ts.
 */

var VERSION = new URL(self.location.href).searchParams.get("v") || "sin-version";
var PREFIJO = "baraja-recuerdos";
var CACHE_PAGINAS = PREFIJO + "-paginas-" + VERSION;
var CACHE_CODIGO = PREFIJO + "-codigo-" + VERSION;
var IDIOMAS = ["es", "en"];
var PAGINAS = ["crear", "pedido/confirmado"];
/** Como mucho, tantos recursos por mensaje de la página (por si llega algo raro). */
var MAX_RECURSOS = 400;
/**
 * Fuentes de las cartas. Las carga el dibujante desde JS (src/lib/carta/fuentes.ts) y no las cita
 * ninguna hoja de estilos, así que se guardan al instalar. Son las de las plantillas
 * (styles/plantillas/*.json, «fuentes»): sw.test.ts comprueba que coinciden.
 */
var FUENTES_CARTAS = [
  "/fonts/cartas/brico-96-75-800.woff2",
  "/fonts/cartas/brico-14-100-600.woff2",
  "/fonts/cartas/brico-12-75-700.woff2",
  "/fonts/cartas/brico-14-100-400.woff2",
];

/** Páginas que se guardan al instalar, para poder abrirlas sin conexión desde la primera visita. */
function paginasSinConexion() {
  var rutas = [];
  IDIOMAS.forEach(function (idioma) {
    PAGINAS.forEach(function (pagina) {
      rutas.push("/" + idioma + "/" + pagina);
    });
  });
  return rutas;
}

/** Clave de la copia de una página que se puede abrir sin conexión («/es/crear»), o null si no es una de ellas. */
function clavePagina(url) {
  var ruta = url.pathname.replace(/\/+$/, "");
  return paginasSinConexion().indexOf(ruta) >= 0 ? ruta : null;
}

/** Código y fuentes del portal: lo único que se guarda aparte de las páginas. */
function esCodigo(url) {
  return url.pathname.indexOf("/_next/static/") === 0 || url.pathname.indexOf("/fonts/") === 0;
}

/** Peticiones de la navegación interna de Next (RSC): siempre a la red. */
function esRsc(peticion, url) {
  return peticion.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

/** Qué hacer con una petición: "pagina" (red primero), "codigo" (caché primero) o null (como si no hubiera service worker). */
function estrategia(peticion, origen) {
  if (peticion.method !== "GET") return null;
  var url = new URL(peticion.url);
  if (url.origin !== origen || url.pathname.indexOf("/api/") === 0 || esRsc(peticion, url)) return null;
  if (peticion.mode === "navigate") return clavePagina(url) ? "pagina" : null;
  return esCodigo(url) ? "codigo" : null;
}

/** Rutas de código y fuentes que cita un texto (el HTML de una página o una hoja de estilos), sin repetir. */
function recursosCitados(texto) {
  var vistos = {};
  var lista = [];
  var patron = /\/(?:_next\/static|fonts)\/[^"'\s\\<>()`]+/g;
  var m;
  while ((m = patron.exec(texto))) {
    if (!vistos[m[0]]) {
      vistos[m[0]] = true;
      lista.push(m[0]);
    }
  }
  return lista;
}

/** Las cachés de este portal que no son de esta versión. */
function cachesViejas(nombres) {
  return nombres.filter(function (n) {
    return n.indexOf(PREFIJO + "-") === 0 && n !== CACHE_PAGINAS && n !== CACHE_CODIGO;
  });
}

/** Guarda código y fuentes que aún no estén; los que fallan se ignoran (se guardarán al pedirlos). */
function guardarCodigo(rutas) {
  return caches.open(CACHE_CODIGO).then(function (cache) {
    return Promise.all(
      rutas.slice(0, MAX_RECURSOS).map(function (ruta) {
        var url;
        try {
          url = new URL(ruta, self.location.origin);
        } catch {
          return null;
        }
        if (url.origin !== self.location.origin || !esCodigo(url)) return null;
        return cache.match(url.href, { ignoreVary: true }).then(function (ya) {
          if (ya) return null;
          return fetch(url.href, { credentials: "same-origin" })
            .then(function (respuesta) {
              if (!respuesta.ok) return null;
              var copia = respuesta.clone();
              // Las hojas de estilos citan las fuentes: también se guardan.
              var esCss = /\.css(?:$|\?)/.test(url.pathname + url.search);
              return cache.put(url.href, respuesta).then(function () {
                return esCss ? copia.text().then(function (css) { return guardarCodigo(recursosCitados(css)); }) : null;
              });
            })
            .catch(function () {
              return null;
            });
        });
      }),
    );
  });
}

/**
 * Guarda las páginas que se pueden abrir sin conexión y el código que citan. Se piden sin cookies:
 * la copia es la de cualquier visitante, sin nada de nadie.
 */
function precargarPaginas() {
  return caches.open(CACHE_PAGINAS).then(function (cache) {
    return Promise.all(
      paginasSinConexion().map(function (ruta) {
        return fetch(ruta, { credentials: "omit", cache: "no-store" })
          .then(function (respuesta) {
            if (!respuesta.ok || respuesta.redirected) return null;
            var copia = respuesta.clone();
            return cache.put(ruta, respuesta).then(function () {
              return copia.text().then(function (html) {
                return guardarCodigo(recursosCitados(html));
              });
            });
          })
          .catch(function () {
            return null;
          });
      }),
    );
  });
}

function redPrimero(evento) {
  var url = new URL(evento.request.url);
  var clave = clavePagina(url);
  return fetch(evento.request).then(
    function (respuesta) {
      if (respuesta.ok && respuesta.type === "basic" && !respuesta.redirected && !url.search) {
        var copia = respuesta.clone();
        evento.waitUntil(
          caches.open(CACHE_PAGINAS).then(function (cache) {
            return cache.put(clave, copia);
          }),
        );
      }
      return respuesta;
    },
    function (error) {
      return caches
        .open(CACHE_PAGINAS)
        .then(function (cache) {
          return cache.match(clave, { ignoreVary: true });
        })
        .then(function (copia) {
          if (copia) return copia;
          throw error;
        });
    },
  );
}

function cachePrimero(evento) {
  return caches.open(CACHE_CODIGO).then(function (cache) {
    return cache.match(evento.request, { ignoreVary: true }).then(function (guardada) {
      if (guardada) return guardada;
      return fetch(evento.request).then(function (respuesta) {
        if (respuesta.ok && respuesta.type === "basic") {
          var copia = respuesta.clone();
          evento.waitUntil(cache.put(evento.request, copia));
        }
        return respuesta;
      });
    });
  });
}

self.addEventListener("install", function (evento) {
  evento.waitUntil(Promise.all([precargarPaginas(), guardarCodigo(FUENTES_CARTAS)]));
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches
      .keys()
      .then(function (nombres) {
        return Promise.all(
          cachesViejas(nombres).map(function (n) {
            return caches.delete(n);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (evento) {
  var tipo = estrategia(evento.request, self.location.origin);
  if (tipo === "pagina") evento.respondWith(redPrimero(evento));
  else if (tipo === "codigo") evento.respondWith(cachePrimero(evento));
});

// La página avisa de lo que ya ha cargado (código, fuentes, lo precargado) para tenerlo sin conexión.
self.addEventListener("message", function (evento) {
  var datos = evento.data;
  if (!datos || datos.tipo !== "guardar" || !Array.isArray(datos.urls)) return;
  evento.waitUntil(guardarCodigo(datos.urls.filter(function (u) { return typeof u === "string"; })));
});
