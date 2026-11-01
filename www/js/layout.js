/**
 * Santo Cacau — layout compartilhado e componentes de interface.
 *
 * Injeta em todas as páginas: atalhos de teclado (eMAG), cabeçalho com busca,
 * menu inferior (celular), navegação no topo (computador), rodapé com links
 * legais, região de avisos para leitores de tela e o "toast" visual.
 * Cada página só precisa de <main id="conteudo"> e do atributo data-route.
 */
(function () {
  'use strict';

  var SC = window.SantoCacau;
  var util = SC.util;
  var icon = util.icon;
  var esc = util.esc;
  var EMPRESA = window.SC_EMPRESA;

  /* ---------- Favoritos (por aparelho) ---------- */

  var favoritos = {
    list: function () {
      return SC.storage.get('favoritos', []);
    },
    has: function (id) {
      return favoritos.list().indexOf(id) !== -1;
    },
    toggle: function (id) {
      var list = favoritos.list();
      var i = list.indexOf(id);
      if (i === -1) list.push(id);
      else list.splice(i, 1);
      SC.storage.set('favoritos', list);
      return i === -1;
    },
  };

  /* ---------- Avisos ---------- */

  var toastTimer = null;

  // Mensagem para leitores de tela (região aria-live sempre presente).
  function announce(message, assertive) {
    var region = document.getElementById(assertive ? 'sc-live-assertive' : 'sc-live');
    if (!region) return;
    region.textContent = '';
    setTimeout(function () {
      region.textContent = message;
    }, 60);
  }

  function toast(message, tipo) {
    var el = document.getElementById('sc-toast');
    if (!el) return;
    var icone = tipo === 'erro' ? 'error' : tipo === 'info' ? 'info' : 'check_circle';
    el.innerHTML = icon(icone, 'text-ouro text-[1.25rem]') + '<span>' + esc(message) + '</span>';
    el.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    announce(message, tipo === 'erro');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
    }, 4500);
  }

  /* ---------- Diálogo de confirmação (substitui window.confirm) ---------- */

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var dialog = document.createElement('dialog');
      dialog.setAttribute('aria-labelledby', 'sc-confirm-titulo');
      dialog.setAttribute('aria-describedby', 'sc-confirm-msg');
      dialog.innerHTML =
        '<form method="dialog" class="p-6 flex flex-col gap-4">' +
        '<h2 id="sc-confirm-titulo" class="font-titulo text-headline-md">' + esc(opts.titulo) + '</h2>' +
        '<p id="sc-confirm-msg" class="text-body-md text-on-surface-variant">' + esc(opts.mensagem) + '</p>' +
        '<div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">' +
        '<button value="nao" class="btn tap px-5 rounded-full bg-surface-container-high text-on-surface font-semibold">' + esc(opts.cancelar || 'Cancelar') + '</button>' +
        '<button value="sim" class="btn tap px-5 rounded-full font-semibold ' +
        (opts.perigo ? 'bg-error text-on-error' : 'bg-primary text-on-primary') + '">' + esc(opts.confirmar || 'Confirmar') + '</button>' +
        '</div></form>';
      document.body.appendChild(dialog);
      var opener = document.activeElement;
      dialog.addEventListener('close', function () {
        resolve(dialog.returnValue === 'sim');
        dialog.remove();
        if (opener && opener.focus) opener.focus();
      });
      dialog.showModal();
    });
  }

  /* ---------- Formulários ---------- */

  var form = {
    // Marca o campo com erro, liga a mensagem por aria-describedby.
    error: function (input, message) {
      var id = input.id + '-erro';
      var msg = document.getElementById(id);
      if (!msg) {
        msg = document.createElement('p');
        msg.id = id;
        msg.className = 'text-body-sm text-error font-semibold flex items-center gap-1 mt-1';
        var anchor = input.closest('[data-campo]') || input;
        anchor.insertAdjacentElement('afterend', msg);
      }
      msg.innerHTML = icon('error', 'text-[1rem]') + '<span>' + esc(message) + '</span>';
      input.setAttribute('aria-invalid', 'true');
      var described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      if (described.indexOf(id) === -1) described.push(id);
      input.setAttribute('aria-describedby', described.join(' '));
    },
    clear: function (root) {
      root.querySelectorAll('[aria-invalid="true"]').forEach(function (input) {
        input.removeAttribute('aria-invalid');
        var id = input.id + '-erro';
        var described = (input.getAttribute('aria-describedby') || '')
          .split(' ')
          .filter(function (x) {
            return x && x !== id;
          });
        if (described.length) input.setAttribute('aria-describedby', described.join(' '));
        else input.removeAttribute('aria-describedby');
        var msg = document.getElementById(id);
        if (msg) msg.remove();
      });
    },
    // Recebe [[input, mensagem|null], ...]; foca o primeiro erro.
    validate: function (root, checks) {
      form.clear(root);
      var errors = checks.filter(function (c) {
        return c[1];
      });
      errors.forEach(function (c) {
        form.error(c[0], c[1]);
      });
      if (errors.length) {
        errors[0][0].focus();
        announce(
          errors.length === 1
            ? 'Há 1 campo para corrigir: ' + errors[0][1]
            : 'Há ' + errors.length + ' campos para corrigir. O primeiro é: ' + errors[0][1],
          true
        );
      }
      return errors.length === 0;
    },
    // Máscara enquanto digita, preservando a posição do cursor no fim.
    mask: function (input, fn) {
      input.addEventListener('input', function () {
        var atEnd = input.selectionStart === input.value.length;
        input.value = fn(input.value);
        if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
      });
    },
  };

  /* ---------- Componentes ---------- */

  var DIETA_NOMES = {};
  window.SC_DATA.dietas.forEach(function (d) {
    DIETA_NOMES[d.id] = d.nome;
  });

  function rating(p) {
    return (
      '<p class="flex items-center gap-1 text-secondary">' +
      icon('star', 'icon-fill text-[1rem]') +
      '<span aria-hidden="true" class="text-label-md font-bold">' + p.nota.toFixed(1).replace('.', ',') + '</span>' +
      '<span aria-hidden="true" class="text-body-sm text-on-surface-variant">(' + p.avaliacoes + ')</span>' +
      '<span class="sr-only">Nota ' + p.nota.toFixed(1).replace('.', ',') + ' de 5, ' + p.avaliacoes + ' avaliações</span>' +
      '</p>'
    );
  }

  function favButton(p, extra) {
    var on = favoritos.has(p.id);
    return (
      '<button type="button" data-fav="' + p.id + '" aria-pressed="' + on + '" ' +
      'class="tap rounded-full bg-surface/90 text-on-surface flex items-center justify-center shadow-sm ' + (extra || '') + '">' +
      icon('favorite', (on ? 'icon-fill text-error ' : '') + 'text-[1.25rem]') +
      '<span class="sr-only">Favoritar ' + esc(p.nome) + '</span></button>'
    );
  }

  function productCard(p, cls) {
    var href = SC.url('produto', { id: p.id });
    var dietas = p.dietas
      .map(function (d) {
        return DIETA_NOMES[d];
      })
      .slice(0, 2)
      .join(' • ');
    return (
      '<article class="card relative bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col ' + (cls || '') + '">' +
      '<div class="relative aspect-[4/3] bg-surface-container-low">' +
      '<a href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + SC.asset(p.img) + '" alt="" loading="lazy" class="w-full h-full object-cover" /></a>' +
      '<span class="absolute top-2 left-2 bg-secondary-fixed text-on-secondary-fixed px-2.5 py-1 rounded-full text-label-sm shadow-sm">' + esc(p.selo) + '</span>' +
      favButton(p, 'absolute top-1 right-1') +
      '</div>' +
      '<div class="p-4 flex flex-col gap-1 flex-1">' +
      '<p class="text-label-sm text-secondary uppercase">' + esc(p.teor) + (dietas ? ' • ' + esc(dietas) : '') + '</p>' +
      '<h3 class="text-title-lg text-on-surface"><a href="' + href + '" class="hover:underline">' + esc(p.nome) + '</a></h3>' +
      rating(p) +
      '<p class="text-body-sm text-on-surface-variant line-clamp-2">' + esc(p.resumo) + '</p>' +
      '<div class="mt-auto pt-3 flex items-end justify-between gap-2">' +
      '<p><span class="block text-body-sm text-on-surface-variant">' + esc(p.unidade) + '</span>' +
      '<span class="text-title-lg font-bold text-on-surface">' + util.money(p.preco) + '</span></p>' +
      '<button type="button" data-add-cart="' + p.id + '" class="btn tap px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform">' +
      icon('add_shopping_cart', 'text-[1.25rem]') + '<span>Adicionar</span><span class="sr-only"> ' + esc(p.nome) + ' à sacola</span></button>' +
      '</div></div></article>'
    );
  }

  // Resumo de valores (sacola e checkout) a partir de SC.pricing.compute().
  function resumo(r) {
    function row(label, value, cls) {
      return (
        '<div class="flex justify-between gap-3 ' + (cls || 'text-on-surface-variant') + '">' +
        '<dt>' + label + '</dt><dd class="text-right font-semibold">' + value + '</dd></div>'
      );
    }
    var itens = r.quantidade === 1 ? '1 item' : r.quantidade + ' itens';
    var html = '<dl class="flex flex-col gap-2 text-body-md">' + row('Subtotal (' + itens + ')', util.money(r.subtotal));
    if (r.embalagemItens) {
      html += row(
        'Embalagem para presente (' + r.embalagemItens + ')',
        r.embalagemCortesia ? 'Cortesia' : util.money(r.embalagem)
      );
    }
    html += row(
      esc(r.freteRegra.nome),
      r.frete === 0 ? 'Grátis' + (r.freteMotivo ? '<span class="block text-body-sm font-normal">' + esc(r.freteMotivo) + '</span>' : '') : util.money(r.frete)
    );
    if (r.descontoCupom) html += row('Cupom ' + esc(r.cupom.codigo), '− ' + util.money(r.descontoCupom), 'text-sucesso');
    if (r.descontoGraos) html += row('Resgate de ' + window.SC_DATA.regras.resgateGraos.graos + ' Grãos', '− ' + util.money(r.descontoGraos), 'text-sucesso');
    html += '</dl><div class="h-px bg-outline-variant my-3"></div>';
    html +=
      '<div class="flex justify-between items-baseline gap-3"><span class="text-title-md">Total</span>' +
      '<span class="text-headline-lg font-bold">' + util.money(r.total) + '</span></div>' +
      (r.parcelas > 1
        ? '<p class="text-body-sm text-on-surface-variant text-right">ou ' + r.parcelas + 'x de ' + util.money(r.valorParcela) + ' sem juros no cartão</p>'
        : '');
    if (r.user && r.graosGanhos) {
      html += '<p class="mt-2 text-body-sm text-secondary font-semibold flex items-center gap-1">' + icon('savings', 'text-[1.125rem]') + '+' + r.graosGanhos + ' Grãos Dourados com esta compra</p>';
    }
    return html;
  }

  /* ---------- Cabeçalho, navegação e rodapé ---------- */

  var NAV = [
    { route: 'inicio', label: 'Início', icone: 'home' },
    { route: 'catalogo', label: 'Chocolates', icone: 'storefront' },
    { route: 'passaporte', label: 'Passaporte', icone: 'confirmation_number' },
    { route: 'carrinho', label: 'Sacola', icone: 'shopping_bag' },
    { route: 'dashboard', label: 'Conta', icone: 'account_circle' },
  ];

  function activeRoute() {
    var r = SC.currentRoute();
    if (r === 'checkout' || r === 'pedido') return 'carrinho';
    if (r === 'login') return 'dashboard';
    if (r === 'produto') return 'catalogo';
    return r;
  }

  function cartLabel(n) {
    return n === 0 ? 'vazia' : n === 1 ? '1 item' : n + ' itens';
  }

  function renderShortcuts() {
    return (
      '<nav aria-label="Atalhos de acessibilidade" class="contents">' +
      '<a class="skip-link" href="#conteudo" accesskey="1">Ir para o conteúdo [Alt+1]</a>' +
      '<a class="skip-link" href="#menu-principal" accesskey="2">Ir para o menu [Alt+2]</a>' +
      '<a class="skip-link" href="#busca-global" accesskey="3">Ir para a busca [Alt+3]</a>' +
      '<a class="skip-link" href="#rodape" accesskey="4">Ir para o rodapé [Alt+4]</a>' +
      '</nav>'
    );
  }

  function renderHeader(user, count, route) {
    var desktopLinks = [
      { route: 'inicio', label: 'Início' },
      { route: 'catalogo', label: 'Chocolates' },
      { route: 'passaporte', label: 'Passaporte' },
      { route: 'ajuda', label: 'Ajuda' },
    ]
      .map(function (l) {
        var current = l.route === route;
        return (
          '<a href="' + SC.url(l.route) + '"' + (current ? ' aria-current="page"' : '') +
          ' class="px-3 py-2 rounded-full text-label-lg ' +
          (current ? 'text-secondary bg-secondary-fixed/40' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container') +
          '">' + l.label + '</a>'
        );
      })
      .join('');

    var q = SC.currentRoute() === 'catalogo' ? SC.param('q') || '' : '';

    return (
      '<header class="fixed top-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-outline-variant/50 pt-safe">' +
      '<div class="max-w-6xl mx-auto h-16 md:h-20 px-margin flex items-center gap-2 md:gap-4">' +
      '<a href="' + SC.url('inicio') + '" class="flex items-center gap-2 shrink-0 rounded-lg">' +
      '<img src="' + SC.asset('img/logo.png') + '" alt="" class="h-9 w-9 object-contain" />' +
      '<span class="font-titulo text-headline-md text-on-surface hidden sm:inline">Santo Cacau</span>' +
      '<span class="sr-only sm:hidden">Santo Cacau, página inicial</span></a>' +
      '<nav id="menu-principal-desktop" aria-label="Principal" class="hidden md:flex items-center gap-1">' + desktopLinks + '</nav>' +
      '<a href="' + SC.url('catalogo') + '#filtro-busca" class="busca-icone ml-auto tap rounded-full items-center justify-center text-on-surface hover:bg-surface-container">' +
      icon('search', 'text-[1.5rem]') + '<span class="sr-only">Buscar chocolates</span></a>' +
      '<form role="search" action="' + SC.url('catalogo') + '" method="get" class="busca-header flex-1 min-w-0 max-w-xs ml-auto">' +
      '<label for="busca-global" class="sr-only">Buscar chocolates</label>' +
      '<div class="flex items-center h-11 pl-3 pr-1 rounded-full bg-surface-container-low border border-outline/50">' +
      icon('search', 'text-on-surface-variant text-[1.25rem] shrink-0') +
      '<input id="busca-global" name="q" type="search" enterkeyhint="search" autocomplete="off" value="' + esc(q) + '" placeholder="Buscar chocolates" class="w-full min-w-0 bg-transparent px-2 text-body-md text-on-surface placeholder:text-on-surface-variant rounded-full" />' +
      '</div></form>' +
      '<button type="button" id="btn-a11y" aria-haspopup="dialog" aria-controls="sc-a11y" class="tap rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container">' +
      icon('accessibility_new', 'text-[1.5rem]') + '<span class="sr-only">Opções de acessibilidade</span></button>' +
      '<a href="' + SC.url('carrinho') + '" class="hidden md:flex tap rounded-full items-center justify-center gap-1 px-2 text-on-surface hover:bg-surface-container"' + (route === 'carrinho' ? ' aria-current="page"' : '') + '>' +
      icon('shopping_bag', 'text-[1.5rem]') + '<span data-cart-count aria-hidden="true" class="text-label-lg">' + count + '</span>' +
      '<span class="sr-only">Sacola, <span data-cart-label>' + cartLabel(count) + '</span></span></a>' +
      '<a href="' + SC.url(user ? 'dashboard' : 'login') + '" class="tap rounded-full flex items-center justify-center gap-1 md:px-3 text-on-surface hover:bg-surface-container">' +
      icon(user ? 'account_circle' : 'login', 'text-[1.5rem]') +
      '<span class="sr-only md:not-sr-only text-label-lg">' + (user ? 'Minha conta' : 'Entrar') + '</span></a>' +
      '</div></header>'
    );
  }

  function renderTabbar(user, count, route) {
    var items = NAV.map(function (item) {
      var current = item.route === route;
      var label = item.route === 'dashboard' ? (user ? 'Conta' : 'Entrar') : item.label;
      var href = SC.url(item.route === 'dashboard' && !user ? 'login' : item.route);
      var badge =
        item.route === 'carrinho'
          ? '<span data-cart-count aria-hidden="true" class="absolute -top-1 -right-2.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-secondary text-on-secondary text-[0.6875rem] font-bold flex items-center justify-center' +
            (count ? '' : ' hidden') + '">' + count + '</span>'
          : '';
      var srExtra = item.route === 'carrinho' ? '<span class="sr-only">, <span data-cart-label>' + cartLabel(count) + '</span></span>' : '';
      return (
        '<li class="flex-1"><a href="' + href + '"' + (current ? ' aria-current="page"' : '') +
        ' class="flex flex-col items-center justify-center gap-0.5 h-16 rounded-lg ' +
        (current ? 'text-secondary font-bold' : 'text-on-surface-variant') + '">' +
        '<span class="relative">' + icon(item.icone, (current ? 'icon-fill ' : '') + 'text-[1.5rem]') + badge + '</span>' +
        '<span class="text-label-sm">' + label + '</span>' + srExtra + '</a></li>'
      );
    }).join('');
    return (
      '<nav id="menu-principal" aria-label="Menu principal" class="md:hidden fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/95 backdrop-blur-xl border-t border-outline-variant/50">' +
      '<ul class="flex items-stretch px-1">' + items + '</ul></nav>'
    );
  }

  function footerLink(route, label) {
    return '<li><a class="hover:underline" href="' + SC.url(route) + '">' + label + '</a></li>';
  }

  function renderFooter() {
    var year = new Date().getFullYear();
    return (
      '<footer id="rodape" tabindex="-1" class="bg-cacau text-on-cacau mt-12">' +
      '<div class="max-w-6xl mx-auto px-margin py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">' +
      '<div class="flex flex-col gap-3">' +
      '<p class="flex items-center gap-2 font-titulo text-headline-md"><img src="' + SC.asset('img/logo.png') + '" alt="" class="h-9 w-9 rounded-full bg-on-cacau p-1" />Santo Cacau</p>' +
      '<p class="text-body-sm text-on-cacau-muted">Chocolates artesanais com cacau 100% rastreável, de pequenos produtores da Mata Atlântica e da Amazônia.</p>' +
      '</div>' +
      '<div><h2 class="text-label-lg text-ouro uppercase mb-3">Comprar</h2><ul class="flex flex-col gap-2 text-body-md text-on-cacau-muted">' +
      footerLink('catalogo', 'Chocolates') + footerLink('passaporte', 'Passaporte Santo Cacau') + footerLink('carrinho', 'Minha sacola') + footerLink('dashboard', 'Minha conta e pedidos') +
      '</ul></div>' +
      '<div><h2 class="text-label-lg text-ouro uppercase mb-3">Ajuda e políticas</h2><ul class="flex flex-col gap-2 text-body-md text-on-cacau-muted">' +
      footerLink('ajuda', 'Central de ajuda e contato') + footerLink('trocas', 'Trocas, devoluções e arrependimento') +
      footerLink('privacidade', 'Política de privacidade') + footerLink('cookies', 'Política de cookies') + footerLink('termos', 'Termos de uso') +
      footerLink('acessibilidade', 'Declaração de acessibilidade') +
      '<li><button type="button" data-abrir-cookies class="hover:underline text-left">Gerenciar cookies</button></li>' +
      '</ul></div>' +
      '<div><h2 class="text-label-lg text-ouro uppercase mb-3">Atendimento</h2><ul class="flex flex-col gap-2 text-body-md text-on-cacau-muted">' +
      '<li><a class="hover:underline inline-flex items-center gap-1" href="https://wa.me/' + EMPRESA.whatsappLink + '" target="_blank" rel="noopener">' + icon('chat', 'text-[1.125rem]') + 'WhatsApp ' + esc(EMPRESA.whatsapp) + '<span class="sr-only"> (abre em nova janela)</span></a></li>' +
      '<li><a class="hover:underline inline-flex items-center gap-1" href="tel:' + EMPRESA.telefoneLink + '">' + icon('call', 'text-[1.125rem]') + esc(EMPRESA.telefone) + '</a></li>' +
      '<li><a class="hover:underline inline-flex items-center gap-1 break-all" href="mailto:' + EMPRESA.email + '">' + icon('mail', 'text-[1.125rem]') + esc(EMPRESA.email) + '</a></li>' +
      '<li class="text-body-sm">' + esc(EMPRESA.horarioAtendimento) + '</li>' +
      '</ul></div>' +
      '</div>' +
      '<div class="border-t border-on-cacau/20"><div class="max-w-6xl mx-auto px-margin py-5 text-body-sm text-on-cacau-muted flex flex-col gap-1">' +
      '<p>© ' + year + ' ' + esc(EMPRESA.razaoSocial) + ' — CNPJ ' + esc(EMPRESA.cnpj) + '</p>' +
      '<p>' + esc(EMPRESA.endereco) + '</p>' +
      '<p>Venda de produtos com álcool proibida para menores de 18 anos. Imagens meramente ilustrativas.</p>' +
      '</div></div>' +
      '</footer>'
    );
  }

  function renderOverlays() {
    return (
      '<div id="sc-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>' +
      '<div id="sc-live-assertive" class="sr-only" role="alert" aria-live="assertive" aria-atomic="true"></div>' +
      '<div id="sc-toast" aria-hidden="true" class="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 w-[calc(100%-2rem)] max-w-md bg-cacau text-on-cacau px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-label-lg transition-all duration-300 opacity-0 translate-y-4 pointer-events-none"></div>'
    );
  }

  function updateCartBadges() {
    var n = SC.cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      if (el.closest('#menu-principal')) el.classList.toggle('hidden', n === 0);
    });
    document.querySelectorAll('[data-cart-label]').forEach(function (el) {
      el.textContent = cartLabel(n);
    });
  }

  // Preenche [data-empresa="campo"] com os dados institucionais.
  function fillEmpresa(root) {
    (root || document).querySelectorAll('[data-empresa]').forEach(function (el) {
      var value = EMPRESA[el.getAttribute('data-empresa')];
      if (value == null) return;
      el.textContent = value;
      var link = el.getAttribute('data-empresa-link');
      if (link === 'mailto') el.setAttribute('href', 'mailto:' + value);
    });
  }

  // Ícones de fonte nunca devem ser lidos ("shopping_bag").
  function hideIcons(root) {
    (root || document).querySelectorAll('.material-symbols-outlined:not([aria-hidden])').forEach(function (el) {
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function mount() {
    var body = document.body;
    var user = SC.auth.current();
    var count = SC.cart.count();
    var route = activeRoute();

    if (window.SantoCacauApp) document.documentElement.setAttribute('data-app', window.SantoCacauApp.platform || '1');

    body.classList.add('min-h-screen', 'flex', 'flex-col', 'bg-surface', 'text-on-surface', 'antialiased', 'font-texto');
    var bare = body.hasAttribute('data-sem-layout');

    body.insertAdjacentHTML('afterbegin', renderShortcuts() + (bare ? '' : renderHeader(user, count, route)));
    var main = document.getElementById('conteudo');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.classList.add('sc-main', 'flex-1', 'w-full');
    }
    if (!bare) {
      body.insertAdjacentHTML('beforeend', renderFooter() + renderTabbar(user, count, route));
      body.classList.add('sc-has-tabbar');
    }
    body.insertAdjacentHTML('beforeend', renderOverlays());
    fillEmpresa();
    hideIcons();
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) hideIcons(node.parentNode || node);
        });
      });
    }).observe(body, { childList: true, subtree: true });

    // Atalho Alt+2 aponta para o menu visível (topo no computador).
    var menuLink = document.querySelector('a[href="#menu-principal"]');
    if (menuLink) {
      menuLink.addEventListener('click', function (e) {
        e.preventDefault();
        var mobile = document.getElementById('menu-principal');
        var target = mobile && mobile.offsetParent ? mobile : document.getElementById('menu-principal-desktop');
        var first = target && target.querySelector('a');
        if (first) first.focus();
      });
    }

    // Atalhos eMAG também com Alt+Shift+número (accesskey varia por navegador).
    document.addEventListener('keydown', function (e) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      var map = { 1: '#conteudo', 2: '#menu-principal', 3: '#busca-global', 4: '#rodape' };
      var target = map[e.key];
      if (!target) return;
      e.preventDefault();
      if (target === '#menu-principal') return menuLink && menuLink.click();
      var el = document.querySelector(target);
      if (el && !el.offsetParent && target === '#busca-global') el = document.querySelector('.busca-icone');
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'start' });
      }
    });

    SC.events.on('cart', updateCartBadges);
    SC.events.on('auth', function () {
      // Recarrega o cabeçalho para refletir login/logout.
      var header = document.querySelector('body > header');
      if (header) header.outerHTML = renderHeader(SC.auth.current(), SC.cart.count(), activeRoute());
      var tabbar = document.getElementById('menu-principal');
      if (tabbar) tabbar.outerHTML = renderTabbar(SC.auth.current(), SC.cart.count(), activeRoute());
    });
  }

  /* ---------- Ações globais por delegação ---------- */

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add-cart]');
    if (add) {
      var p = SC.produtos.get(add.getAttribute('data-add-cart'));
      if (!p) return;
      var qtdInput = add.getAttribute('data-qtd-input') && document.getElementById(add.getAttribute('data-qtd-input'));
      var qtd = qtdInput ? Math.max(1, parseInt(qtdInput.value, 10) || 1) : 1;
      SC.cart.add(p.id, qtd);
      toast((qtd > 1 ? qtd + '× ' : '') + p.nome + ' adicionado à sacola. Total na sacola: ' + cartLabel(SC.cart.count()) + '.');
      return;
    }
    var fav = e.target.closest('[data-fav]');
    if (fav) {
      var id = fav.getAttribute('data-fav');
      var on = favoritos.toggle(id);
      fav.setAttribute('aria-pressed', String(on));
      var ic = fav.querySelector('.material-symbols-outlined');
      if (ic) {
        ic.classList.toggle('icon-fill', on);
        ic.classList.toggle('text-error', on);
      }
      var prod = SC.produtos.get(id);
      announce((prod ? prod.nome : 'Produto') + (on ? ' adicionado aos favoritos.' : ' removido dos favoritos.'));
    }
  });

  // PWA: service worker só em produção (HTTPS fora da rede local).
  function registerServiceWorker() {
    var host = location.hostname;
    var local = host === 'localhost' || host === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !local) {
      // Quando uma versão nova do site assume, recarrega uma vez para usá-la.
      var tinhaVersao = !!navigator.serviceWorker.controller;
      var recarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!tinhaVersao || recarregou) return;
        recarregou = true;
        location.reload();
      });
      navigator.serviceWorker
        .register(SC.asset('sw.js'), { updateViaCache: 'none' })
        .then(function (reg) {
          reg.update();
        })
        .catch(function () {});
    }
  }

  SC.favoritos = favoritos;
  SC.ui = {
    toast: toast,
    announce: announce,
    confirm: confirmDialog,
    form: form,
    productCard: productCard,
    resumo: resumo,
    favButton: favButton,
    rating: rating,
    fillEmpresa: fillEmpresa,
    dietaNome: function (id) {
      return DIETA_NOMES[id] || id;
    },
    // Redireciona para o login e volta à página atual depois.
    requireLogin: function () {
      var user = SC.auth.current();
      if (!user) {
        window.location.replace(SC.url('login', { next: location.pathname + location.search }));
        return null;
      }
      return user;
    },
  };

  mount();
  registerServiceWorker();
})();
