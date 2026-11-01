/**
 * Santo Cacau — service worker (só é registrado em produção, via HTTPS).
 * Tudo é buscado primeiro na rede, para que cada atualização do site apareça
 * logo; a cópia guardada só é usada sem internet.
 */
var VERSAO = 'sc-v3';
var ESSENCIAIS = [
  './',
  './index.html',
  './html/catalogo.html',
  './html/carrinho.html',
  './html/ajuda.html',
  './css/styles.css',
  './img/logo.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSAO).then(function (cache) {
      return cache.addAll(ESSENCIAIS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== VERSAO;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Dados da conta e pedidos nunca vão para o cache do aparelho.
  if (url.pathname.indexOf('/api/') !== -1) return;

  // "no-cache" revalida com o servidor em vez de usar o cache HTTP do navegador.
  var rede = req.mode === 'navigate' ? fetch(req) : fetch(new Request(req, { cache: 'no-cache' }));

  event.respondWith(
    rede
      .then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(VERSAO).then(function (c) {
            c.put(req, copy);
          });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
        });
      })
  );
});
