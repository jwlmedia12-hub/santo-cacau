/**
 * Santo Cacau — consentimento de cookies (LGPD, Lei 13.709/2018).
 *
 * - Necessários: sempre ativos (sacola, sessão, segurança, suas preferências
 *   de acessibilidade e o próprio registro de consentimento).
 * - Estatísticas e Marketing: só são carregados com consentimento.
 *
 * Para adicionar uma ferramenta (ex.: Google Analytics), use no HTML:
 *   <script type="text/plain" data-consent="estatisticas" data-src="https://..."></script>
 * Ela só é ativada depois que o visitante aceitar a categoria.
 */
(function () {
  'use strict';

  var SC = window.SantoCacau;
  var icon = SC.util.icon;
  var VERSAO = window.SC_EMPRESA.atualizacaoPoliticas;

  var CATEGORIAS = [
    {
      id: 'necessarios',
      nome: 'Necessários',
      fixo: true,
      desc: 'Fazem o site funcionar: sacola, login, segurança, suas preferências de acessibilidade e este registro de consentimento. Não podem ser desativados.',
    },
    {
      id: 'estatisticas',
      nome: 'Estatísticas',
      desc: 'Medem, de forma agregada, quais páginas são mais visitadas para melhorarmos o site.',
    },
    {
      id: 'marketing',
      nome: 'Marketing',
      desc: 'Permitem mostrar ofertas da Santo Cacau em outros sites e redes sociais.',
    },
  ];

  function get() {
    var c = SC.storage.get('consentimento', null);
    return c && c.versao === VERSAO ? c : null;
  }

  function has(categoria) {
    if (categoria === 'necessarios') return true;
    var c = get();
    return !!(c && c.categorias[categoria]);
  }

  function activateScripts() {
    document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(function (old) {
      if (!has(old.getAttribute('data-consent'))) return;
      var s = document.createElement('script');
      if (old.getAttribute('data-src')) s.src = old.getAttribute('data-src');
      else s.textContent = old.textContent;
      s.async = true;
      old.replaceWith(s);
    });
  }

  function save(categorias) {
    SC.storage.set('consentimento', {
      versao: VERSAO,
      data: new Date().toISOString(),
      categorias: { estatisticas: !!categorias.estatisticas, marketing: !!categorias.marketing },
    });
    hideBanner();
    activateScripts();
    SC.events.emit('consent', get());
    SC.ui.toast('Suas escolhas de cookies foram salvas.');
  }

  /* ---------- Banner ---------- */

  function showBanner() {
    if (document.getElementById('sc-cookie-banner')) return;
    document.body.insertAdjacentHTML(
      'beforeend',
      '<section id="sc-cookie-banner" aria-labelledby="sc-cookie-titulo" aria-describedby="sc-cookie-desc" ' +
        'class="fixed z-[55] inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-4 md:left-auto md:right-4 md:max-w-md bg-surface-container-lowest text-on-surface rounded-2xl shadow-2xl border border-outline-variant p-5 flex flex-col gap-3">' +
        '<h2 id="sc-cookie-titulo" class="text-title-lg flex items-center gap-2">' + icon('cookie', 'text-secondary') + 'Sua privacidade importa</h2>' +
        '<p id="sc-cookie-desc" class="text-body-sm text-on-surface-variant">Usamos cookies necessários para o site funcionar. Com sua permissão, também usamos cookies de estatísticas e marketing. ' +
        'Saiba mais na <a class="underline font-semibold text-secondary" href="' + SC.url('cookies') + '">Política de Cookies</a> e na <a class="underline font-semibold text-secondary" href="' + SC.url('privacidade') + '">Política de Privacidade</a>.</p>' +
        '<div class="grid grid-cols-2 gap-2">' +
        '<button type="button" data-cookie="rejeitar" class="btn tap px-3 rounded-full bg-primary text-on-primary text-label-lg">Rejeitar opcionais</button>' +
        '<button type="button" data-cookie="aceitar" class="btn tap px-3 rounded-full bg-primary text-on-primary text-label-lg">Aceitar todos</button>' +
        '<button type="button" data-cookie="personalizar" class="btn tap col-span-2 px-3 rounded-full border-2 border-primary text-on-surface text-label-lg">Personalizar escolhas</button>' +
        '</div></section>'
    );
  }

  function hideBanner() {
    var el = document.getElementById('sc-cookie-banner');
    if (el) el.remove();
  }

  /* ---------- Preferências ---------- */

  function openPreferences() {
    var atual = get();
    var dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'sc-cookie-pref-titulo');
    dialog.innerHTML =
      '<form method="dialog" class="flex flex-col">' +
      '<div class="flex items-center justify-between gap-2 px-5 py-4 border-b border-outline-variant">' +
      '<h2 id="sc-cookie-pref-titulo" class="font-titulo text-headline-md">Preferências de cookies</h2>' +
      '<button type="button" data-fechar class="tap rounded-full flex items-center justify-center hover:bg-surface-container">' + icon('close') + '<span class="sr-only">Fechar</span></button>' +
      '</div><ul class="px-5">' +
      CATEGORIAS.map(function (c) {
        var on = c.fixo || (atual && atual.categorias[c.id]);
        var id = 'cookie-sw-' + c.id;
        return (
          '<li class="flex items-start justify-between gap-4 py-4 border-b border-outline-variant/60">' +
          '<span class="flex flex-col"><span id="' + id + '-nome" class="text-label-lg">' + c.nome + (c.fixo ? ' <span class="text-body-sm text-on-surface-variant">(sempre ativos)</span>' : '') + '</span>' +
          '<span id="' + id + '-desc" class="text-body-sm text-on-surface-variant">' + c.desc + '</span></span>' +
          '<button type="button" role="switch" class="switch mt-1 disabled:opacity-60" data-categoria="' + c.id + '" aria-checked="' + !!on + '"' +
          (c.fixo ? ' aria-disabled="true" disabled' : '') + ' aria-labelledby="' + id + '-nome" aria-describedby="' + id + '-desc"></button></li>'
        );
      }).join('') +
      '</ul><div class="px-5 py-4 grid grid-cols-2 gap-2">' +
      '<button type="button" data-acao="rejeitar" class="btn tap px-3 rounded-full bg-surface-container-high text-on-surface text-label-lg">Rejeitar opcionais</button>' +
      '<button type="button" data-acao="salvar" class="btn tap px-3 rounded-full bg-primary text-on-primary text-label-lg">Salvar escolhas</button>' +
      '</div></form>';
    document.body.appendChild(dialog);
    var opener = document.activeElement;

    dialog.addEventListener('click', function (e) {
      var sw = e.target.closest('[role="switch"]:not([disabled])');
      if (sw) sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
      if (e.target.closest('[data-fechar]') || e.target === dialog) dialog.close();
      var acao = e.target.closest('[data-acao]');
      if (acao) {
        var escolhas = {};
        dialog.querySelectorAll('[data-categoria]').forEach(function (s) {
          escolhas[s.getAttribute('data-categoria')] =
            acao.getAttribute('data-acao') === 'salvar' && s.getAttribute('aria-checked') === 'true';
        });
        save(escolhas);
        dialog.close();
      }
    });
    dialog.addEventListener('close', function () {
      dialog.remove();
      var target = opener && document.body.contains(opener) ? opener : document.getElementById('conteudo');
      if (target) target.focus();
    });
    dialog.showModal();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cookie]');
    if (btn) {
      var acao = btn.getAttribute('data-cookie');
      if (acao === 'aceitar') save({ estatisticas: true, marketing: true });
      if (acao === 'rejeitar') save({ estatisticas: false, marketing: false });
      if (acao === 'personalizar') openPreferences();
      return;
    }
    if (e.target.closest('[data-abrir-cookies]')) openPreferences();
  });

  if (!get()) showBanner();
  else activateScripts();

  SC.consent = {
    get: get,
    has: has,
    open: openPreferences,
    revogar: function () {
      SC.storage.remove('consentimento');
      showBanner();
      SC.events.emit('consent', null);
    },
    categorias: CATEGORIAS,
  };
})();
