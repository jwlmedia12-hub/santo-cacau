// Sacola: itens, quantidades, embalagem, cupom, Grãos Dourados, frete e resumo.
(function () {
  var SC = window.SantoCacau;
  var DATA = window.SC_DATA;
  var util = SC.util;
  var esc = util.esc;
  var icon = util.icon;
  var root = document.getElementById('sacola');
  var contagem = document.getElementById('sacola-contagem');
  var cepMsg = '';

  function itemHtml(i) {
    var p = i.produto;
    var href = SC.url('produto', { id: p.id });
    return (
      '<li class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">' +
      '<div class="flex gap-3">' +
      '<img src="' + SC.asset(p.img) + '" alt="" class="w-24 h-24 rounded-lg object-cover shrink-0 bg-surface-container" />' +
      '<div class="flex-1 min-w-0 flex flex-col gap-1">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<h3 class="text-title-md leading-tight"><a class="hover:underline" href="' + href + '">' + esc(p.nome) + '</a></h3>' +
      '<button type="button" data-acao="remover" data-id="' + p.id + '" data-key="remover-' + p.id + '" class="tap -mt-2 -mr-2 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error">' +
      icon('delete') + '<span class="sr-only">Remover ' + esc(p.nome) + ' da sacola</span></button>' +
      '</div>' +
      '<p class="text-body-sm text-on-surface-variant">' + esc(p.unidade) + ' • ' + util.money(p.preco) + ' cada</p>' +
      (p.alcool ? '<p class="text-body-sm text-error font-semibold">Contém álcool • maiores de 18 anos</p>' : '') +
      '<div class="flex items-center justify-between gap-2 mt-auto">' +
      '<div role="group" aria-label="Quantidade de ' + esc(p.nome) + '" class="flex items-center rounded-full border border-outline">' +
      '<button type="button" data-acao="menos" data-id="' + p.id + '" data-key="menos-' + p.id + '" class="tap rounded-full flex items-center justify-center disabled:opacity-40"' + (i.qtd <= 1 ? ' disabled' : '') + '>' +
      icon('remove') + '<span class="sr-only">Diminuir</span></button>' +
      '<span class="min-w-[2rem] text-center text-title-md" aria-live="polite">' + i.qtd + '<span class="sr-only"> unidades</span></span>' +
      '<button type="button" data-acao="mais" data-id="' + p.id + '" data-key="mais-' + p.id + '" class="tap rounded-full flex items-center justify-center disabled:opacity-40"' + (i.qtd >= 99 ? ' disabled' : '') + '>' +
      icon('add') + '<span class="sr-only">Aumentar</span></button>' +
      '</div>' +
      '<p class="text-title-lg font-bold">' + util.money(i.total) + '</p>' +
      '</div></div></div>' +
      '<label class="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2 cursor-pointer">' +
      '<input type="checkbox" data-acao="presente" data-id="' + p.id + '" data-key="presente-' + p.id + '"' + (i.presente ? ' checked' : '') + ' />' +
      '<span class="flex-1 text-body-sm flex items-center gap-1">' + icon('redeem', 'text-secondary text-[1.125rem]') +
      'Embalar para presente com fita e cartão</span>' +
      '<span class="text-label-md text-on-surface-variant">+ ' + util.money(DATA.regras.embalagemPresente) + '/un.</span>' +
      '</label></li>'
    );
  }

  function entregaHtml(r) {
    var opcoes = Object.keys(DATA.regras.frete)
      .map(function (key) {
        var f = DATA.regras.frete[key];
        var id = 'entrega-' + key;
        var valor = f.valor === 0 ? 'Grátis' : util.money(f.valor);
        return (
          '<label for="' + id + '" class="flex items-start gap-3 p-3 rounded-lg border border-outline-variant has-[:checked]:border-2 has-[:checked]:border-primary cursor-pointer">' +
          '<input type="radio" id="' + id + '" name="entrega" value="' + key + '" data-acao="entrega" data-key="' + id + '" class="mt-0.5"' + (r.entrega === key ? ' checked' : '') + ' />' +
          '<span class="flex-1"><span class="flex justify-between gap-2 text-label-lg"><span>' + esc(f.nome) + '</span><span>' + valor + '</span></span>' +
          '<span class="block text-body-sm text-on-surface-variant">' + esc(f.prazo) +
          (f.gratisAcima ? ' • grátis acima de ' + util.money(f.gratisAcima) : '') +
          (f.apenasCapitalSP ? ' • só capital de SP' : '') + '</span></span></label>'
        );
      })
      .join('');
    var aviso = r.avisos.filter(function (a) { return a.campo === 'entrega'; })[0];
    return (
      '<section aria-labelledby="entrega-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">' +
      '<h2 id="entrega-titulo" class="text-title-lg flex items-center gap-2">' + icon('local_shipping', 'text-secondary') + 'Entrega</h2>' +
      '<form id="form-cep" class="flex flex-col gap-1" novalidate>' +
      '<label for="cep" class="text-label-lg">CEP de entrega</label>' +
      '<div class="flex gap-2"><input id="cep" class="campo" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" value="' + esc(r.opts.cep || '') + '" aria-describedby="cep-status" data-key="cep" />' +
      '<button class="btn tap px-4 rounded-lg bg-surface-container-high text-on-surface text-label-lg shrink-0" data-key="calcular">Calcular</button></div>' +
      '<p id="cep-status" class="text-body-sm text-on-surface-variant" aria-live="polite">' + esc(cepMsg) + '</p>' +
      '<a class="text-body-sm underline text-secondary self-start" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP<span class="sr-only"> (abre site dos Correios em nova janela)</span></a>' +
      '</form>' +
      '<fieldset class="flex flex-col gap-2"><legend class="text-label-lg mb-1">Forma de entrega</legend>' + opcoes + '</fieldset>' +
      (aviso ? '<p class="text-body-sm text-error font-semibold flex items-center gap-1">' + icon('error', 'text-[1.125rem]') + esc(aviso.msg) + '</p>' : '') +
      '</section>'
    );
  }

  function descontosHtml(r) {
    var regras = DATA.regras.resgateGraos;
    var avisoCupom = r.avisos.filter(function (a) { return a.campo === 'cupom'; })[0];
    var graos;
    if (!r.user) {
      graos = '<p class="text-body-sm text-on-cacau-muted"><a class="underline font-semibold text-ouro" href="' + SC.url('login', { next: location.pathname }) + '">Entre na sua conta</a> para acumular e usar Grãos Dourados.</p>';
    } else if (!r.podeUsarGraos) {
      graos = '<p class="text-body-sm text-on-cacau-muted">Saldo: ' + r.user.graos + ' Grãos. Com ' + regras.graos + ' Grãos você ganha ' + util.money(regras.desconto) + ' de desconto.</p>';
    } else {
      graos =
        '<div class="flex items-center justify-between gap-3">' +
        '<span class="flex flex-col"><span id="graos-nome" class="text-label-lg">Usar ' + regras.graos + ' Grãos (' + util.money(regras.desconto) + ' de desconto)</span>' +
        '<span id="graos-desc" class="text-body-sm text-on-cacau-muted">Saldo atual: ' + r.user.graos + ' Grãos</span></span>' +
        '<button type="button" role="switch" class="switch" data-acao="graos" data-key="graos" aria-checked="' + r.usarGraos + '" aria-labelledby="graos-nome" aria-describedby="graos-desc"></button></div>';
    }
    return (
      '<section aria-labelledby="graos-titulo" class="card p-4 rounded-xl bg-cacau text-on-cacau shadow-md flex flex-col gap-2">' +
      '<h2 id="graos-titulo" class="text-title-lg text-ouro flex items-center gap-2">' + icon('confirmation_number') + 'Passaporte Fidelidade</h2>' +
      graos + '</section>' +
      '<section aria-labelledby="cupom-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-2">' +
      '<h2 id="cupom-titulo" class="text-title-lg flex items-center gap-2">' + icon('sell', 'text-secondary') + 'Cupom de desconto</h2>' +
      (r.cupom
        ? '<p class="text-body-md text-sucesso font-semibold flex items-center gap-1">' + icon('check_circle') + 'Cupom ' + esc(r.cupom.codigo) + ' aplicado: ' + esc(r.cupom.descricao) + '</p>' +
          '<button type="button" data-acao="remover-cupom" data-key="remover-cupom" class="self-start text-label-lg underline text-secondary tap">Remover cupom</button>'
        : '<form id="form-cupom" class="flex flex-col gap-1" novalidate><label for="cupom" class="text-label-lg">Código do cupom</label>' +
          '<div class="flex gap-2"><input id="cupom" class="campo uppercase" autocomplete="off" autocapitalize="characters" placeholder="Ex.: DEGUSTA15" value="' + esc(r.opts.cupom || '') + '" data-key="cupom"' +
          (avisoCupom ? ' aria-invalid="true" aria-describedby="cupom-erro"' : '') + ' />' +
          '<button class="btn tap px-4 rounded-lg bg-surface-container-high text-on-surface text-label-lg shrink-0" data-key="aplicar">Aplicar</button></div>' +
          (avisoCupom ? '<p id="cupom-erro" class="text-body-sm text-error font-semibold">' + esc(avisoCupom.msg) + '</p>' : '') +
          '</form>') +
      '</section>'
    );
  }

  function render() {
    var active = document.activeElement && document.activeElement.getAttribute('data-key');
    var r = SC.pricing.compute();
    contagem.textContent = r.quantidade === 1 ? '1 item' : r.quantidade + ' itens';

    if (!r.itens.length) {
      root.innerHTML =
        '<div class="card rounded-xl bg-surface-container-low p-8 text-center flex flex-col items-center gap-3">' +
        icon('shopping_bag', 'text-[3rem] text-secondary') +
        '<h2 class="text-title-lg">Sua sacola está vazia</h2>' +
        '<p class="text-body-md text-on-surface-variant">Que tal escolher algumas delícias artesanais?</p>' +
        '<a href="' + SC.url('catalogo') + '" class="btn tap px-6 rounded-full bg-primary text-on-primary text-label-lg flex items-center gap-2">' + icon('storefront') + 'Ver chocolates</a></div>';
      return;
    }

    var freteBarra = '';
    if (r.freteFaltam > 0 && r.frete > 0) {
      var pct = Math.round((1 - r.freteFaltam / r.freteRegra.gratisAcima) * 100);
      freteBarra =
        '<div class="card p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">' +
        '<p class="text-label-lg flex items-center gap-2">' + icon('local_shipping', 'text-secondary') +
        'Faltam ' + util.money(r.freteFaltam) + ' para frete grátis na ' + esc(r.freteRegra.nome) + '</p>' +
        '<div class="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden" aria-hidden="true"><div class="h-full bg-secondary rounded-full" style="width:' + pct + '%"></div></div></div>';
    }

    root.innerHTML =
      '<div class="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">' +
      '<div class="flex flex-col gap-4">' + freteBarra +
      '<section aria-labelledby="itens-titulo"><h2 id="itens-titulo" class="sr-only">Itens da sacola</h2>' +
      '<ul class="flex flex-col gap-3">' + r.itens.map(itemHtml).join('') + '</ul></section>' +
      entregaHtml(r) + '</div>' +
      '<div class="flex flex-col gap-4 lg:sticky lg:top-28">' + descontosHtml(r) +
      '<section aria-labelledby="resumo-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm">' +
      '<h2 id="resumo-titulo" class="text-title-lg mb-3">Resumo do pedido</h2>' + SC.ui.resumo(r) + '</section>' +
      '<a href="' + SC.url('checkout') + '" class="btn tap h-14 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-between px-6 shadow-lg">' +
      '<span class="flex items-center gap-2">' + icon('lock', 'text-ouro') + 'Finalizar compra</span><span>' + util.money(r.total) + '</span></a>' +
      '<a href="' + SC.url('catalogo') + '" class="tap text-label-lg text-on-surface-variant flex items-center justify-center gap-1 underline underline-offset-2">' + icon('arrow_back') + 'Continuar escolhendo chocolates</a>' +
      '<p class="text-body-sm text-on-surface-variant flex items-start gap-2">' + icon('ac_unit', 'text-secondary') + 'Garantia de frescor: embalagem com isolamento térmico preservando a textura.</p>' +
      '</div></div>';

    if (active) {
      var el = root.querySelector('[data-key="' + active + '"]');
      if (el && !el.disabled) el.focus();
      else if (active.indexOf('menos-') === 0) {
        var mais = root.querySelector('[data-key="' + active.replace('menos-', 'mais-') + '"]');
        if (mais) mais.focus();
      }
    }
  }

  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-acao]');
    if (!btn) return;
    var acao = btn.getAttribute('data-acao');
    var id = btn.getAttribute('data-id');
    var item = id && SC.cart.items().filter(function (i) { return i.id === id; })[0];
    var p = id && SC.produtos.get(id);
    if (acao === 'mais' && item) {
      SC.cart.setQty(id, item.qtd + 1);
      SC.ui.announce(p.nome + ': ' + (item.qtd + 1) + ' unidades.');
    }
    if (acao === 'menos' && item) {
      SC.cart.setQty(id, item.qtd - 1);
      SC.ui.announce(p.nome + ': ' + (item.qtd - 1) + ' unidades.');
    }
    if (acao === 'remover' && item) {
      SC.ui
        .confirm({ titulo: 'Remover item?', mensagem: 'Remover ' + p.nome + ' da sacola?', confirmar: 'Remover', perigo: true })
        .then(function (ok) {
          if (!ok) return;
          SC.cart.remove(id);
          SC.ui.toast(p.nome + ' removido da sacola.');
          var heading = document.getElementById('itens-titulo') || document.querySelector('h1');
          if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus();
          }
        });
    }
    if (acao === 'graos') {
      var on = btn.getAttribute('aria-checked') !== 'true';
      SC.checkout.set({ usarGraos: on });
      SC.ui.announce(on ? 'Resgate de Grãos aplicado.' : 'Resgate de Grãos removido.');
    }
    if (acao === 'remover-cupom') {
      SC.checkout.set({ cupom: '' });
      SC.ui.announce('Cupom removido.');
      var c = document.getElementById('cupom');
      if (c) c.focus();
    }
  });

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute('data-acao') === 'presente') {
      SC.cart.setGift(t.getAttribute('data-id'), t.checked);
    }
    if (t.getAttribute('data-acao') === 'entrega') {
      SC.checkout.set({ entrega: t.value });
      SC.ui.announce('Entrega selecionada: ' + DATA.regras.frete[t.value].nome);
    }
  });

  root.addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.id === 'form-cupom') {
      var codigo = document.getElementById('cupom').value.trim().toUpperCase();
      SC.checkout.set({ cupom: codigo });
      var r = SC.pricing.compute();
      if (r.cupom) SC.ui.toast('Cupom ' + r.cupom.codigo + ' aplicado.');
      else {
        var erro = r.avisos.filter(function (a) { return a.campo === 'cupom'; })[0];
        SC.ui.announce(erro ? erro.msg : 'Digite um código de cupom.', true);
      }
    }
    if (e.target.id === 'form-cep') {
      var cep = document.getElementById('cep').value;
      cepMsg = 'Consultando CEP…';
      document.getElementById('cep-status').textContent = cepMsg;
      SC.buscarCep(cep)
        .then(function (end) {
          cepMsg = 'Entrega para ' + end.cidade + '/' + end.uf + '.';
          var patch = { cep: end.cep, endereco: end };
          if (SC.checkout.get().entrega === 'expressa' && !SC.pricing.isCapitalSP(end.cep)) patch.entrega = 'padrao';
          SC.checkout.set(patch);
        })
        .catch(function (err) {
          cepMsg = err.message;
          SC.checkout.set({ cep: SC.util.maskCEP(cep) });
        });
    }
  });

  root.addEventListener('input', function (e) {
    if (e.target.id === 'cep') e.target.value = util.maskCEP(e.target.value);
  });

  SC.events.on('cart', render);
  SC.events.on('auth', render);
  render();
})();
