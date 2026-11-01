/**
 * Santo Cacau — orquestrador de navegação.
 *
 * Cada tela é um HTML independente. Este arquivo centraliza o mapa de rotas.
 * Links gerados pelo layout usam `href` reais (funcionam com teclado, leitores
 * de tela e "abrir em nova aba"); elementos com `data-path="<rota>"` também
 * navegam, por compatibilidade.
 *
 * API global: SantoCacau.navigate('catalogo', { q: 'trufa' }) e SantoCacau.url('produto', { id })
 */
(function () {
  'use strict';

  // Nome da rota -> arquivo, relativo à raiz do site (www/).
  var ROUTES = {
    inicio: 'index.html',
    catalogo: 'html/catalogo.html',
    produto: 'html/produto.html',
    passaporte: 'html/passaporte.html',
    carrinho: 'html/carrinho.html',
    checkout: 'html/checkout.html',
    pedido: 'html/pedido.html',
    login: 'html/login.html',
    dashboard: 'html/dashboard.html',
    ajuda: 'html/ajuda.html',
    privacidade: 'html/privacidade.html',
    cookies: 'html/cookies.html',
    termos: 'html/termos.html',
    trocas: 'html/trocas.html',
    acessibilidade: 'html/acessibilidade.html',
  };

  // Nomes alternativos usados nas telas.
  var ALIASES = {
    home: 'inicio',
    chocolates: 'catalogo',
    sacola: 'carrinho',
    compras: 'carrinho',
    perfil: 'dashboard',
    conta: 'dashboard',
    cadastro: 'login',
    contato: 'ajuda',
  };

  // Raiz do site = pasta acima de /js, resolvida a partir deste script,
  // para funcionar em qualquer servidor, subpasta ou WebView.
  var script = document.currentScript || document.querySelector('script[src*="router.js"]');
  var BASE_URL = new URL('../', script ? script.src : window.location.href);

  function resolve(name) {
    if (!name) return null;
    var key = String(name).replace(/^#/, '').toLowerCase();
    key = ALIASES[key] || key;
    return ROUTES[key] ? key : null;
  }

  function url(name, params, hash) {
    var route = resolve(name) || 'inicio';
    var target = new URL(ROUTES[route], BASE_URL);
    if (params) {
      Object.keys(params).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          target.searchParams.set(key, params[key]);
        }
      });
    }
    if (hash) target.hash = hash;
    return target.href;
  }

  // Caminho de um recurso relativo à raiz do site (ex.: imagens do catálogo).
  function asset(path) {
    return new URL(path, BASE_URL).href;
  }

  function currentRoute() {
    var fromBody = document.body && resolve(document.body.getAttribute('data-route'));
    if (fromBody) return fromBody;
    var path = window.location.pathname;
    for (var route in ROUTES) {
      if (route !== 'inicio' && path.slice(-ROUTES[route].length) === ROUTES[route]) return route;
    }
    return 'inicio';
  }

  function navigate(name, params, hash) {
    var route = resolve(name);
    if (!route) {
      console.warn('[router] rota desconhecida:', name);
      return;
    }
    window.location.href = url(route, params, hash);
  }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // Delegação: um único listener cobre todos os elementos com data-path.
  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-path]');
    if (!target) return;
    var route = resolve(target.getAttribute('data-path'));
    if (!route) return;
    event.preventDefault();
    navigate(route);
  });

  window.SantoCacau = window.SantoCacau || {};
  window.SantoCacau.routes = ROUTES;
  window.SantoCacau.navigate = navigate;
  window.SantoCacau.url = url;
  window.SantoCacau.asset = asset;
  window.SantoCacau.param = param;
  window.SantoCacau.resolve = resolve;
  window.SantoCacau.currentRoute = currentRoute;
})();
