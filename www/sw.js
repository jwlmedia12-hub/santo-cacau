/**
 * Santo Cacau — service worker (só é registrado em produção, via HTTPS).
 * Páginas: rede primeiro, com cópia offline. Imagens, CSS e JS: cache primeiro.
 * Ao publicar uma nova versão, aumente VERSAO para limpar o cache antigo.
 */
var VERSAO = 'sc-v1';
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
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) {
          return k !== VERSAO;
        }).map(function (k) {
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(VERSAO).then(function (c) {
            c.put(req, copy);
          });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      return (
        hit ||
        fetch(req).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(VERSAO).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        })
      );
    })
  );
});
