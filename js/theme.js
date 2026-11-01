/**
 * Santo Cacau — tema e preferências visuais (carregado de forma síncrona no <head>).
 *
 * As cores do Tailwind apontam para variáveis CSS (--c-<token>). Aqui ficam as
 * três paletas (padrão, alto contraste claro e alto contraste escuro) e a
 * aplicação imediata das preferências de acessibilidade salvas, antes do
 * primeiro desenho da página, para não haver "piscada" de tema.
 */
(function () {
  'use strict';

  var PALETTES = {
    padrao: {
      surface: '#fdf9f3',
      'surface-container-lowest': '#ffffff',
      'surface-container-low': '#f7f3ed',
      'surface-container': '#f1ede7',
      'surface-container-high': '#ebe8e2',
      'surface-container-highest': '#e6e2dc',
      'on-surface': '#1c1c18',
      'on-surface-variant': '#4f4441',
      outline: '#6f625e',
      'outline-variant': '#d3c3be',
      primary: '#26140d',
      'on-primary': '#ffffff',
      secondary: '#735c00',
      'on-secondary': '#ffffff',
      'secondary-container': '#fed65b',
      'on-secondary-container': '#3d2f00',
      'secondary-fixed': '#ffe088',
      'on-secondary-fixed': '#241a00',
      cacau: '#291710',
      'on-cacau': '#fdf9f3',
      'on-cacau-muted': '#e6d5cc',
      ouro: '#ffe088',
      'on-ouro': '#241a00',
      error: '#ba1a1a',
      'on-error': '#ffffff',
      'error-container': '#ffdad6',
      'on-error-container': '#93000a',
      sucesso: '#1d6b3a',
      'sucesso-container': '#d7f5df',
      'on-sucesso-container': '#0b3d1d',
      foco: '#0b57d0',
    },
    'contraste-claro': {
      surface: '#ffffff',
      'surface-container-lowest': '#ffffff',
      'surface-container-low': '#ffffff',
      'surface-container': '#ffffff',
      'surface-container-high': '#f0f0f0',
      'surface-container-highest': '#e8e8e8',
      'on-surface': '#000000',
      'on-surface-variant': '#000000',
      outline: '#000000',
      'outline-variant': '#000000',
      primary: '#000000',
      'on-primary': '#ffffff',
      secondary: '#4d3d00',
      'on-secondary': '#ffffff',
      'secondary-container': '#ffe24d',
      'on-secondary-container': '#000000',
      'secondary-fixed': '#ffe24d',
      'on-secondary-fixed': '#000000',
      cacau: '#000000',
      'on-cacau': '#ffffff',
      'on-cacau-muted': '#ffffff',
      ouro: '#ffe24d',
      'on-ouro': '#000000',
      error: '#a00000',
      'on-error': '#ffffff',
      'error-container': '#fff0f0',
      'on-error-container': '#6b0000',
      sucesso: '#0a5c26',
      'sucesso-container': '#e6ffe9',
      'on-sucesso-container': '#003d12',
      foco: '#0000ee',
    },
    'contraste-escuro': {
      surface: '#000000',
      'surface-container-lowest': '#000000',
      'surface-container-low': '#000000',
      'surface-container': '#000000',
      'surface-container-high': '#1a1a1a',
      'surface-container-highest': '#262626',
      'on-surface': '#ffffff',
      'on-surface-variant': '#ffffff',
      outline: '#ffffff',
      'outline-variant': '#bdbdbd',
      primary: '#ffeb3b',
      'on-primary': '#000000',
      secondary: '#ffeb3b',
      'on-secondary': '#000000',
      'secondary-container': '#ffeb3b',
      'on-secondary-container': '#000000',
      'secondary-fixed': '#ffeb3b',
      'on-secondary-fixed': '#000000',
      cacau: '#000000',
      'on-cacau': '#ffffff',
      'on-cacau-muted': '#ffffff',
      ouro: '#ffeb3b',
      'on-ouro': '#000000',
      error: '#ff8a80',
      'on-error': '#000000',
      'error-container': '#3a0000',
      'on-error-container': '#ffb4ab',
      sucesso: '#69f0ae',
      'sucesso-container': '#002910',
      'on-sucesso-container': '#b9f6ca',
      foco: '#00e5ff',
    },
  };

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255);
  }

  function block(selector, palette) {
    var lines = Object.keys(palette).map(function (token) {
      return '--c-' + token + ':' + hexToRgb(palette[token]) + ';';
    });
    return selector + '{' + lines.join('') + '}';
  }

  var css =
    block(':root', PALETTES.padrao) +
    block('html.tema-contraste-claro', PALETTES['contraste-claro']) +
    block('html.tema-contraste-escuro', PALETTES['contraste-escuro']);

  var style = document.createElement('style');
  style.id = 'sc-theme';
  style.textContent = css;
  document.head.appendChild(style);

  // Preferências padrão de acessibilidade (o painel em a11y.js as altera).
  var DEFAULTS = {
    fonte: 100, // % do tamanho de texto
    contraste: 'padrao', // padrao | contraste-claro | contraste-escuro
    legivel: false, // fonte de leitura facilitada
    espacamento: false, // espaçamento ampliado (WCAG 1.4.12)
    links: false, // destacar links
    movimento: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches,
    cursor: false, // cursor ampliado
    guia: false, // guia de leitura
    libras: true, // widget VLibras
  };

  function readPrefs() {
    var prefs = {};
    for (var k in DEFAULTS) prefs[k] = DEFAULTS[k];
    try {
      var saved = JSON.parse(localStorage.getItem('sc:a11y') || 'null');
      if (saved) for (var key in saved) if (key in DEFAULTS) prefs[key] = saved[key];
    } catch (e) {
      /* armazenamento indisponível: usa o padrão */
    }
    return prefs;
  }

  function applyPrefs(prefs) {
    var root = document.documentElement;
    // No app iOS, soma o tamanho de fonte do sistema (injetado pelo app).
    var escalaApp = (window.SantoCacauApp && window.SantoCacauApp.fontScale) || 1;
    var tamanho = Math.round(prefs.fonte * escalaApp);
    root.style.fontSize = tamanho === 100 ? '' : tamanho + '%';
    root.classList.toggle('a11y-fonte-grande', tamanho >= 130);
    root.classList.remove('tema-contraste-claro', 'tema-contraste-escuro');
    if (prefs.contraste !== 'padrao') root.classList.add('tema-' + prefs.contraste);
    root.classList.toggle('a11y-legivel', !!prefs.legivel);
    root.classList.toggle('a11y-espacamento', !!prefs.espacamento);
    root.classList.toggle('a11y-links', !!prefs.links);
    root.classList.toggle('a11y-sem-movimento', !!prefs.movimento);
    root.classList.toggle('a11y-cursor', !!prefs.cursor);
    if (prefs.legivel && !document.getElementById('sc-font-legivel')) {
      var link = document.createElement('link');
      link.id = 'sc-font-legivel';
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
      document.head.appendChild(link);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', PALETTES[prefs.contraste].surface);
  }

  applyPrefs(readPrefs());

  window.SC_THEME = {
    tokens: Object.keys(PALETTES.padrao),
    palettes: PALETTES,
    defaults: DEFAULTS,
    readPrefs: readPrefs,
    applyPrefs: applyPrefs,
  };
})();
