/**
 * Santo Cacau — painel de acessibilidade.
 *
 * Recursos: tamanho do texto, alto contraste (claro/escuro), fonte de leitura
 * facilitada, espaçamento de texto, destaque de links, pausa de animações,
 * cursor ampliado, guia de leitura, tradução para Libras (VLibras, do
 * Governo Federal) e leitura em voz alta (síntese de voz do aparelho).
 * As escolhas ficam salvas no aparelho e valem para todas as páginas.
 */
(function () {
  'use strict';

  var SC = window.SantoCacau;
  var THEME = window.SC_THEME;
  var icon = SC.util.icon;
  var prefs = THEME.readPrefs();

  var TAMANHOS = [
    { valor: 100, nome: 'Padrão' },
    { valor: 115, nome: 'Grande' },
    { valor: 130, nome: 'Maior' },
    { valor: 150, nome: 'Muito grande' },
    { valor: 175, nome: 'Máximo' },
  ];
  var CONTRASTES = [
    { valor: 'padrao', nome: 'Padrão', desc: 'Cores originais' },
    { valor: 'contraste-claro', nome: 'Alto contraste claro', desc: 'Preto sobre branco' },
    { valor: 'contraste-escuro', nome: 'Alto contraste escuro', desc: 'Amarelo e branco sobre preto' },
  ];
  var SWITCHES = [
    { chave: 'libras', nome: 'Tradutor de Libras (VLibras)', desc: 'Mostra o botão do intérprete virtual de Língua Brasileira de Sinais.' },
    { chave: 'legivel', nome: 'Fonte de leitura facilitada', desc: 'Atkinson Hyperlegible: letras mais fáceis de distinguir (baixa visão e dislexia).' },
    { chave: 'espacamento', nome: 'Espaçamento ampliado', desc: 'Mais espaço entre letras, palavras e linhas.' },
    { chave: 'links', nome: 'Destacar links', desc: 'Sublinha e contorna todos os links.' },
    { chave: 'movimento', nome: 'Pausar animações', desc: 'Remove transições e movimentos da tela.' },
    { chave: 'guia', nome: 'Guia de leitura', desc: 'Faixa que acompanha o mouse ou o dedo para ajudar a seguir a linha.' },
    { chave: 'cursor', nome: 'Cursor ampliado', desc: 'Ponteiro do mouse maior e com contorno.' },
  ];

  function save() {
    SC.storage.set('a11y', prefs);
    THEME.applyPrefs(prefs);
    applyRuntime();
  }

  /* ---------- Guia de leitura ---------- */

  var guia = null;
  function moveGuia(e) {
    var y = e.touches ? e.touches[0].clientY : e.clientY;
    if (guia) guia.style.top = y + 'px';
  }
  function setGuia(on) {
    if (on && !guia) {
      guia = document.createElement('div');
      guia.id = 'sc-guia-leitura';
      guia.setAttribute('aria-hidden', 'true');
      guia.style.top = '50%';
      document.body.appendChild(guia);
      document.addEventListener('mousemove', moveGuia);
      document.addEventListener('touchmove', moveGuia, { passive: true });
    } else if (!on && guia) {
      guia.remove();
      guia = null;
      document.removeEventListener('mousemove', moveGuia);
      document.removeEventListener('touchmove', moveGuia);
    }
  }

  /* ---------- VLibras (Governo Federal) ---------- */

  var librasLoaded = false;
  function setLibras(on) {
    var wrapper = document.querySelector('[vw]');
    if (!on) {
      if (wrapper) wrapper.style.display = 'none';
      return;
    }
    if (wrapper) {
      wrapper.style.display = '';
      return;
    }
    if (librasLoaded) return;
    librasLoaded = true;
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div vw class="enabled"><div vw-access-button class="active"></div>' +
        '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div></div>'
    );
    var script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.onload = function () {
      try {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
        // O widget se inicia no evento "load"; se a página já carregou, dispara manualmente.
        if (document.readyState === 'complete' && typeof window.onload === 'function') window.onload();
      } catch (e) {
        console.warn('[a11y] VLibras indisponível', e);
      }
    };
    script.onerror = function () {
      librasLoaded = false;
      var el = document.querySelector('[vw]');
      if (el) el.remove();
    };
    document.body.appendChild(script);
  }

  /* ---------- Leitura em voz alta ---------- */

  var tts = window.speechSynthesis;
  function vozPtBr() {
    var voices = tts.getVoices();
    return (
      voices.filter(function (v) {
        return /pt[-_]BR/i.test(v.lang);
      })[0] ||
      voices.filter(function (v) {
        return /^pt/i.test(v.lang);
      })[0] ||
      null
    );
  }
  // Dentro do app, a voz é feita pelo sistema (expo-speech) via ponte nativa.
  var ponteNativa = window.ReactNativeWebView && window.SantoCacauApp && window.SantoCacauApp.tts;
  function nativo(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function lerTexto(texto) {
    if (ponteNativa) {
      nativo({ type: 'tts:speak', text: texto.replace(/\s+/g, ' ').trim() });
      var stopBtn = document.getElementById('a11y-parar');
      if (stopBtn) stopBtn.disabled = false;
      return;
    }
    if (!tts) return SC.ui.toast('Seu navegador não oferece leitura em voz alta.', 'erro');
    tts.cancel();
    // Frases curtas evitam que alguns navegadores interrompam a leitura.
    var partes = texto.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || [];
    var voz = vozPtBr();
    partes.forEach(function (parte) {
      var u = new SpeechSynthesisUtterance(parte.trim());
      u.lang = 'pt-BR';
      u.rate = 1;
      if (voz) u.voice = voz;
      tts.speak(u);
    });
    updateTtsButtons();
  }
  function lerPagina() {
    var main = document.getElementById('conteudo');
    if (!main) return;
    var selecao = String(window.getSelection ? window.getSelection() : '').trim();
    var clone = main.cloneNode(true);
    clone.querySelectorAll('.material-symbols-outlined, [aria-hidden="true"], script, style').forEach(function (el) {
      el.remove();
    });
    lerTexto(selecao || clone.innerText || clone.textContent);
  }
  function pararLeitura() {
    if (ponteNativa) nativo({ type: 'tts:stop' });
    if (tts) tts.cancel();
    updateTtsButtons();
  }
  function updateTtsButtons() {
    if (ponteNativa) return;
    var stop = document.getElementById('a11y-parar');
    if (stop) stop.disabled = !(tts && (tts.speaking || tts.pending));
  }

  /* ---------- Painel ---------- */

  function radioGroup(name, legend, options, current) {
    return (
      '<fieldset class="flex flex-col gap-2"><legend class="text-title-md mb-2">' + legend + '</legend>' +
      options
        .map(function (o) {
          var id = 'a11y-' + name + '-' + o.valor;
          return (
            '<label for="' + id + '" class="flex items-center gap-3 p-3 rounded-lg border border-outline-variant has-[:checked]:border-primary has-[:checked]:border-2 has-[:checked]:bg-surface-container cursor-pointer">' +
            '<input type="radio" id="' + id + '" name="' + name + '" value="' + o.valor + '"' + (String(current) === String(o.valor) ? ' checked' : '') + ' />' +
            '<span class="flex flex-col"><span class="text-label-lg">' + o.nome + '</span>' +
            (o.desc ? '<span class="text-body-sm text-on-surface-variant">' + o.desc + '</span>' : '') +
            '</span></label>'
          );
        })
        .join('') +
      '</fieldset>'
    );
  }

  function renderPanel() {
    var switches = SWITCHES.map(function (s) {
      var id = 'a11y-sw-' + s.chave;
      return (
        '<li class="flex items-start justify-between gap-4 py-3 border-b border-outline-variant/60">' +
        '<span class="flex flex-col"><span id="' + id + '-nome" class="text-label-lg">' + s.nome + '</span>' +
        '<span id="' + id + '-desc" class="text-body-sm text-on-surface-variant">' + s.desc + '</span></span>' +
        '<button type="button" role="switch" class="switch mt-1" id="' + id + '" data-chave="' + s.chave + '" aria-checked="' + !!prefs[s.chave] + '" aria-labelledby="' + id + '-nome" aria-describedby="' + id + '-desc"></button>' +
        '</li>'
      );
    }).join('');

    return (
      '<dialog id="sc-a11y" aria-labelledby="sc-a11y-titulo" class="w-full">' +
      '<div class="sticky top-0 z-10 bg-surface flex items-center justify-between gap-2 px-5 py-4 border-b border-outline-variant">' +
      '<h2 id="sc-a11y-titulo" class="font-titulo text-headline-md flex items-center gap-2">' + icon('accessibility_new', 'text-secondary') + 'Acessibilidade</h2>' +
      '<button type="button" data-fechar class="tap rounded-full flex items-center justify-center hover:bg-surface-container">' + icon('close') + '<span class="sr-only">Fechar painel de acessibilidade</span></button>' +
      '</div>' +
      '<div class="px-5 py-5 flex flex-col gap-6">' +
      '<section aria-labelledby="a11y-ouvir" class="flex flex-col gap-2">' +
      '<h3 id="a11y-ouvir" class="text-title-md">Leitura em voz alta</h3>' +
      '<p class="text-body-sm text-on-surface-variant">Lê o conteúdo principal da página (ou o trecho que você selecionou).</p>' +
      '<div class="flex gap-2">' +
      '<button type="button" id="a11y-ler" class="btn tap flex-1 px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2">' + icon('volume_up') + 'Ouvir página</button>' +
      '<button type="button" id="a11y-parar" disabled class="btn tap px-4 rounded-full bg-surface-container-high text-on-surface text-label-lg flex items-center justify-center gap-2 disabled:opacity-50">' + icon('stop') + 'Parar</button>' +
      '</div></section>' +
      radioGroup('fonte', 'Tamanho do texto', TAMANHOS, prefs.fonte) +
      radioGroup('contraste', 'Contraste de cores', CONTRASTES, prefs.contraste) +
      '<section aria-labelledby="a11y-outros"><h3 id="a11y-outros" class="text-title-md">Outros recursos</h3><ul>' + switches + '</ul></section>' +
      '<section aria-labelledby="a11y-atalhos" class="flex flex-col gap-1"><h3 id="a11y-atalhos" class="text-title-md">Atalhos de teclado</h3>' +
      '<p class="text-body-sm text-on-surface-variant">Alt+1 conteúdo • Alt+2 menu • Alt+3 busca • Alt+4 rodapé. A tecla Tab percorre os itens e Esc fecha janelas.</p></section>' +
      '<div class="flex flex-col sm:flex-row gap-2">' +
      '<button type="button" id="a11y-restaurar" class="btn tap flex-1 px-4 rounded-full bg-surface-container-high text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('restart_alt') + 'Restaurar padrões</button>' +
      '<a href="' + SC.url('acessibilidade') + '" class="btn tap flex-1 px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('description') + 'Declaração de acessibilidade</a>' +
      '</div></div></dialog>'
    );
  }

  function syncPanel(dialog) {
    dialog.querySelectorAll('input[name="fonte"]').forEach(function (r) {
      r.checked = Number(r.value) === prefs.fonte;
    });
    dialog.querySelectorAll('input[name="contraste"]').forEach(function (r) {
      r.checked = r.value === prefs.contraste;
    });
    dialog.querySelectorAll('[role="switch"]').forEach(function (sw) {
      sw.setAttribute('aria-checked', String(!!prefs[sw.getAttribute('data-chave')]));
    });
  }

  function mountPanel() {
    document.body.insertAdjacentHTML('beforeend', renderPanel());
    var dialog = document.getElementById('sc-a11y');
    var opener = null;

    dialog.addEventListener('change', function (e) {
      if (e.target.name === 'fonte') {
        prefs.fonte = Number(e.target.value);
        save();
        SC.ui.announce('Tamanho do texto: ' + e.target.closest('label').innerText.trim());
      }
      if (e.target.name === 'contraste') {
        prefs.contraste = e.target.value;
        save();
        SC.ui.announce('Contraste alterado.');
      }
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog || e.target.closest('[data-fechar]')) return dialog.close();
      var sw = e.target.closest('[role="switch"]');
      if (sw) {
        var chave = sw.getAttribute('data-chave');
        prefs[chave] = !prefs[chave];
        sw.setAttribute('aria-checked', String(prefs[chave]));
        save();
        return;
      }
      if (e.target.closest('#a11y-ler')) {
        dialog.close();
        lerPagina();
        return;
      }
      if (e.target.closest('#a11y-parar')) return pararLeitura();
      if (e.target.closest('#a11y-restaurar')) {
        prefs = {};
        for (var k in THEME.defaults) prefs[k] = THEME.defaults[k];
        save();
        syncPanel(dialog);
        SC.ui.announce('Preferências de acessibilidade restauradas.');
      }
    });

    dialog.addEventListener('close', function () {
      if (opener && document.body.contains(opener)) opener.focus();
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('#btn-a11y, [data-abrir-a11y]')) {
        opener = e.target.closest('button, a');
        syncPanel(dialog);
        updateTtsButtons();
        dialog.showModal();
      }
    });

    if (tts) {
      setInterval(updateTtsButtons, 1000);
      window.addEventListener('pagehide', pararLeitura);
    }
  }

  function applyRuntime() {
    setGuia(!!prefs.guia);
    setLibras(!!prefs.libras);
  }

  mountPanel();
  applyRuntime();

  SC.a11y = {
    open: function () {
      document.getElementById('btn-a11y').click();
    },
    lerPagina: lerPagina,
    lerTexto: lerTexto,
    parar: pararLeitura,
  };
})();
