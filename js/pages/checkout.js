// Checkout: identificação, entrega, pagamento (simulado), aceite e confirmação.
(function () {
  var SC = window.SantoCacau;
  var DATA = window.SC_DATA;
  var util = SC.util;
  var esc = util.esc;
  var icon = util.icon;
  var root = document.getElementById('checkout');
  var r = SC.pricing.compute();

  if (!r.itens.length) {
    root.innerHTML =
      '<div class="card rounded-xl bg-surface-container-low p-8 text-center flex flex-col items-center gap-3">' +
      icon('shopping_bag', 'text-[3rem] text-secondary') +
      '<h2 class="text-title-lg">Sua sacola está vazia</h2>' +
      '<a href="' + SC.url('catalogo') + '" class="btn tap px-6 rounded-full bg-primary text-on-primary text-label-lg flex items-center">Ver chocolates</a></div>';
    return;
  }

  var user = r.user;
  var opts = r.opts;
  var end = opts.endereco || (user && user.enderecos && user.enderecos[0]) || {};
  var retirada = r.entrega === 'retirada';

  function campo(id, label, attrs, extra) {
    return (
      '<div class="' + ((extra && extra.cls) || '') + '">' +
      '<label for="' + id + '" class="block text-label-lg mb-1">' + label + (attrs.indexOf('required') !== -1 ? ' <span aria-hidden="true">*</span>' : '') + '</label>' +
      '<input id="' + id + '" name="' + id + '" class="campo" ' + attrs + ' />' +
      (extra && extra.dica ? '<p id="' + id + '-dica" class="text-body-sm text-on-surface-variant mt-1">' + extra.dica + '</p>' : '') +
      '</div>'
    );
  }

  function secao(num, titulo, conteudo) {
    return (
      '<section aria-labelledby="sec-' + num + '" class="card p-4 md:p-6 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-4">' +
      '<h2 id="sec-' + num + '" class="text-title-lg flex items-center gap-2"><span aria-hidden="true" class="w-7 h-7 rounded-full bg-primary text-on-primary text-label-md flex items-center justify-center">' + num + '</span>' + titulo + '</h2>' +
      conteudo + '</section>'
    );
  }

  var identificacao = user
    ? '<p class="text-body-md">Comprando como <strong>' + esc(user.nome) + '</strong> (' + esc(user.email) + ').</p>' +
      '<button type="button" id="sair" class="self-start text-label-lg underline text-secondary tap">Não é você? Sair</button>'
    : '<p class="text-body-sm text-on-surface-variant">Já tem conta? <a class="underline font-semibold text-secondary" href="' + SC.url('login', { next: location.pathname }) + '">Entre para ganhar Grãos Dourados</a>, ou continue como visitante:</p>' +
      '<div class="grid gap-4 sm:grid-cols-2">' +
      campo('nome', 'Nome completo', 'required autocomplete="name"', { cls: 'sm:col-span-2' }) +
      campo('email', 'E-mail', 'required type="email" autocomplete="email" inputmode="email"', { dica: 'Enviaremos a confirmação do pedido para este e-mail.' }) +
      campo('telefone', 'Celular com DDD', 'required type="tel" autocomplete="tel-national" inputmode="tel" placeholder="(11) 90000-0000"') +
      campo('cpf', 'CPF', 'required inputmode="numeric" autocomplete="off" placeholder="000.000.000-00"', { dica: 'Necessário para emissão da nota fiscal.' }) +
      '</div>';

  var entrega = retirada
    ? '<p class="text-body-md">' + icon('storefront', 'text-secondary align-middle') + ' <strong>' + esc(DATA.regras.frete.retirada.nome) + '</strong> — ' + esc(DATA.boutiques[0].endereco) + '.</p>' +
      '<p class="text-body-sm text-on-surface-variant">' + esc(DATA.regras.frete.retirada.prazo) + '. ' + esc(DATA.boutiques[0].horario) + '. Acessibilidade: ' + esc(DATA.boutiques[0].acessibilidade) + '</p>' +
      '<a href="' + SC.url('carrinho') + '" class="self-start text-label-lg underline text-secondary tap">Alterar forma de entrega</a>'
    : '<p class="text-body-md"><strong>' + esc(r.freteRegra.nome) + '</strong> — ' + esc(r.freteRegra.prazo) + '. <a href="' + SC.url('carrinho') + '" class="underline text-secondary font-semibold">Alterar</a></p>' +
      '<div class="grid gap-4 sm:grid-cols-6">' +
      '<div class="sm:col-span-2"><label for="cep" class="block text-label-lg mb-1">CEP <span aria-hidden="true">*</span></label>' +
      '<input id="cep" name="cep" class="campo" required inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" value="' + esc(end.cep || opts.cep || '') + '" aria-describedby="cep-status" />' +
      '<p id="cep-status" class="text-body-sm text-on-surface-variant mt-1" aria-live="polite"></p></div>' +
      campo('logradouro', 'Rua / avenida', 'required autocomplete="address-line1" value="' + esc(end.logradouro || '') + '"', { cls: 'sm:col-span-4' }) +
      campo('numero', 'Número', 'required inputmode="numeric" autocomplete="off" value="' + esc(end.numero || '') + '"', { cls: 'sm:col-span-2' }) +
      campo('complemento', 'Complemento (opcional)', 'autocomplete="address-line2" value="' + esc(end.complemento || '') + '"', { cls: 'sm:col-span-4' }) +
      campo('bairro', 'Bairro', 'required autocomplete="address-level3" value="' + esc(end.bairro || '') + '"', { cls: 'sm:col-span-2' }) +
      campo('cidade', 'Cidade', 'required autocomplete="address-level2" value="' + esc(end.cidade || '') + '"', { cls: 'sm:col-span-3' }) +
      campo('uf', 'UF', 'required maxlength="2" autocomplete="address-level1" value="' + esc(end.uf || '') + '"', { cls: 'sm:col-span-1' }) +
      '</div>';

  var parcelasOpts = '';
  for (var n = 1; n <= r.parcelas; n++) {
    parcelasOpts += '<option value="' + n + '">' + n + 'x de ' + util.money(r.total / n) + ' sem juros</option>';
  }

  // Com servidor, os dados do cartão são digitados só no ambiente seguro do
  // Mercado Pago; na demonstração, ficam neste formulário e não são enviados.
  var comServidor = SC.modo === 'api';
  var avisoPagamento = comServidor
    ? '<p class="rounded-lg bg-surface-container-low p-3 text-body-sm flex items-start gap-2">' + icon('verified_user', 'shrink-0 text-secondary') +
      '<span>Pagamento processado pelo <strong>Mercado Pago</strong>. No cartão, você digita os dados no ambiente seguro do Mercado Pago — eles não passam pela Santo Cacau.</span></p>'
    : '<p class="rounded-lg bg-secondary-fixed text-on-secondary-fixed p-3 text-body-sm flex items-start gap-2">' + icon('info', 'shrink-0') +
      '<span><strong>Ambiente de demonstração:</strong> nenhum valor é cobrado e os dados do cartão não são enviados nem guardados. Não use um cartão real.</span></p>';

  var pagamento =
    avisoPagamento +
    '<fieldset class="flex flex-col gap-2"><legend class="text-label-lg mb-1">Forma de pagamento <span aria-hidden="true">*</span></legend>' +
    '<label for="pg-pix" class="flex items-start gap-3 p-3 rounded-lg border border-outline-variant has-[:checked]:border-2 has-[:checked]:border-primary cursor-pointer">' +
    '<input type="radio" id="pg-pix" name="metodo" value="pix" checked class="mt-0.5" />' +
    '<span><span class="block text-label-lg">Pix</span><span class="block text-body-sm text-on-surface-variant">Aprovação imediata. O código aparece após confirmar.</span></span></label>' +
    '<label for="pg-cartao" class="flex items-start gap-3 p-3 rounded-lg border border-outline-variant has-[:checked]:border-2 has-[:checked]:border-primary cursor-pointer">' +
    '<input type="radio" id="pg-cartao" name="metodo" value="cartao" class="mt-0.5" />' +
    '<span><span class="block text-label-lg">Cartão de crédito</span><span class="block text-body-sm text-on-surface-variant">Em até ' + r.parcelas + 'x sem juros.' +
    (comServidor ? ' Você será levado ao Mercado Pago para concluir.' : '') + '</span></span></label>' +
    '</fieldset>' +
    (comServidor
      ? ''
      : '<div id="dados-cartao" hidden class="grid gap-4 sm:grid-cols-6">' +
        campo('cartao-numero', 'Número do cartão', 'inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000"', { cls: 'sm:col-span-6' }) +
        campo('cartao-nome', 'Nome impresso no cartão', 'autocomplete="cc-name"', { cls: 'sm:col-span-6' }) +
        campo('cartao-validade', 'Validade (MM/AA)', 'inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA"', { cls: 'sm:col-span-3' }) +
        campo('cartao-cvv', 'Código de segurança (CVV)', 'inputmode="numeric" autocomplete="cc-csc" maxlength="4"', { cls: 'sm:col-span-3', dica: '3 ou 4 números no verso do cartão.' }) +
        '<div class="sm:col-span-6"><label for="parcelas" class="block text-label-lg mb-1">Parcelas</label><select id="parcelas" name="parcelas" class="campo">' + parcelasOpts + '</select></div>' +
        '</div>');

  var confirmacoes =
    '<div><label for="observacoes" class="block text-label-lg mb-1">Mensagem para o cartão de presente (opcional)</label>' +
    '<textarea id="observacoes" name="observacoes" rows="3" maxlength="300" class="campo" aria-describedby="obs-dica"></textarea>' +
    '<p id="obs-dica" class="text-body-sm text-on-surface-variant mt-1">Até 300 caracteres.</p></div>' +
    (r.itens.some(function (i) { return i.produto.alcool; })
      ? '<div data-campo><label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" id="maioridade" class="mt-0.5" required />' +
        '<span class="text-body-md">Declaro ter 18 anos ou mais. Este pedido contém bombons com bebida alcoólica, cuja venda a menores é proibida. <span aria-hidden="true">*</span></span></label></div>'
      : '') +
    '<div data-campo><label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" id="aceite" class="mt-0.5" required />' +
    '<span class="text-body-md">Li e aceito os <a class="underline font-semibold text-secondary" href="' + SC.url('termos') + '" target="_blank">Termos de Uso<span class="sr-only"> (abre em nova janela)</span></a>, a ' +
    '<a class="underline font-semibold text-secondary" href="' + SC.url('trocas') + '" target="_blank">Política de Trocas<span class="sr-only"> (abre em nova janela)</span></a> e estou ciente da ' +
    '<a class="underline font-semibold text-secondary" href="' + SC.url('privacidade') + '" target="_blank">Política de Privacidade<span class="sr-only"> (abre em nova janela)</span></a>. <span aria-hidden="true">*</span></span></label></div>';

  var itensResumo = r.itens
    .map(function (i) {
      return '<li class="flex justify-between gap-2 text-body-sm"><span>' + i.qtd + '× ' + esc(i.produto.nome) + (i.presente ? ' (presente)' : '') + '</span><span class="font-semibold">' + util.money(i.total) + '</span></li>';
    })
    .join('');

  root.innerHTML =
    '<form id="form-checkout" novalidate class="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">' +
    '<div class="flex flex-col gap-4">' +
    secao(1, 'Identificação', identificacao) +
    secao(2, retirada ? 'Retirada' : 'Endereço de entrega', entrega) +
    secao(3, 'Pagamento', pagamento) +
    secao(4, 'Revisão e confirmação', confirmacoes) +
    '</div>' +
    '<aside aria-labelledby="resumo-titulo" class="flex flex-col gap-4 lg:sticky lg:top-28">' +
    '<section class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm">' +
    '<h2 id="resumo-titulo" class="text-title-lg mb-3">Resumo do pedido</h2>' +
    '<ul class="flex flex-col gap-1 mb-3">' + itensResumo + '</ul>' + SC.ui.resumo(r) + '</section>' +
    '<button type="submit" class="btn tap h-14 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2 shadow-lg">' +
    icon('lock', 'text-ouro') + 'Confirmar pedido • ' + util.money(r.total) + '</button>' +
    '<p class="text-body-sm text-on-surface-variant flex items-start gap-2">' + icon('verified_user', 'text-secondary') +
    'Você pode desistir da compra em até 7 dias após o recebimento (art. 49 do Código de Defesa do Consumidor).</p>' +
    '</aside></form>';

  var form = document.getElementById('form-checkout');
  var $ = function (id) { return document.getElementById(id); };

  if ($('telefone')) SC.ui.form.mask($('telefone'), util.maskPhone);
  if ($('cpf')) SC.ui.form.mask($('cpf'), util.maskCPF);
  if ($('cartao-numero')) SC.ui.form.mask($('cartao-numero'), function (v) { return util.digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); });
  if ($('cartao-validade')) SC.ui.form.mask($('cartao-validade'), function (v) { return util.digits(v).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2'); });
  if ($('cartao-cvv')) SC.ui.form.mask($('cartao-cvv'), function (v) { return util.digits(v).slice(0, 4); });

  if ($('sair')) {
    $('sair').addEventListener('click', function () {
      SC.auth.logout().then(function () {
        location.reload();
      });
    });
  }

  // CEP preenche o endereço automaticamente.
  if ($('cep')) {
    SC.ui.form.mask($('cep'), util.maskCEP);
    $('cep').addEventListener('input', function () {
      if (util.digits(this.value).length !== 8) return;
      var status = $('cep-status');
      status.textContent = 'Buscando endereço…';
      SC.buscarCep(this.value)
        .then(function (e) {
          ['logradouro', 'bairro', 'cidade', 'uf'].forEach(function (k) {
            if (e[k]) $(k).value = e[k];
          });
          status.textContent = 'Endereço encontrado: ' + e.cidade + '/' + e.uf + '. Informe o número.';
          SC.checkout.set({ cep: e.cep, endereco: e });
          $('numero').focus();
        })
        .catch(function (err) {
          status.textContent = err.message;
        });
    });
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'metodo') {
      var cartao = e.target.value === 'cartao';
      if ($('dados-cartao')) $('dados-cartao').hidden = !cartao;
      SC.ui.announce(
        cartao
          ? comServidor
            ? 'Cartão selecionado. Ao confirmar, você será levado ao Mercado Pago.'
            : 'Campos do cartão exibidos.'
          : 'Pagamento por Pix selecionado.'
      );
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var metodo = form.querySelector('input[name="metodo"]:checked').value;
    var v = function (id) { return $(id) ? $(id).value.trim() : ''; };
    var checks = [];

    if (!user) {
      checks.push([$('nome'), v('nome').split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : null]);
      checks.push([$('email'), !util.validEmail(v('email')) ? 'Informe um e-mail válido, como nome@exemplo.com.' : null]);
      checks.push([$('telefone'), util.digits(v('telefone')).length < 10 ? 'Informe o celular com DDD.' : null]);
      checks.push([$('cpf'), !util.validCPF(v('cpf')) ? 'CPF inválido. Confira os 11 números.' : null]);
    }
    if (!retirada) {
      checks.push([$('cep'), util.digits(v('cep')).length !== 8 ? 'Informe um CEP com 8 números.' : null]);
      checks.push([$('logradouro'), !v('logradouro') ? 'Informe a rua ou avenida.' : null]);
      checks.push([$('numero'), !v('numero') ? 'Informe o número (ou "s/n").' : null]);
      checks.push([$('bairro'), !v('bairro') ? 'Informe o bairro.' : null]);
      checks.push([$('cidade'), !v('cidade') ? 'Informe a cidade.' : null]);
      checks.push([$('uf'), !/^[A-Za-z]{2}$/.test(v('uf')) ? 'Informe a sigla do estado, como SP.' : null]);
      if (r.entrega === 'expressa' && util.digits(v('cep')).length === 8 && !SC.pricing.isCapitalSP(v('cep'))) {
        checks.push([$('cep'), 'A entrega expressa atende apenas a capital de SP. Volte à sacola e escolha a entrega padrão.']);
      }
    }
    if (metodo === 'cartao' && !comServidor) {
      var num = util.digits(v('cartao-numero'));
      var val = v('cartao-validade').split('/');
      var mes = Number(val[0]);
      var ano = 2000 + Number(val[1]);
      var hoje = new Date();
      checks.push([$('cartao-numero'), num.length < 13 || num.length > 19 ? 'Número do cartão incompleto.' : null]);
      checks.push([$('cartao-nome'), !v('cartao-nome') ? 'Informe o nome impresso no cartão.' : null]);
      checks.push([
        $('cartao-validade'),
        !(mes >= 1 && mes <= 12) || ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes < hoje.getMonth() + 1)
          ? 'Validade inválida ou vencida (use MM/AA).'
          : null,
      ]);
      checks.push([$('cartao-cvv'), util.digits(v('cartao-cvv')).length < 3 ? 'O código de segurança tem 3 ou 4 números.' : null]);
    }
    if ($('maioridade')) checks.push([$('maioridade'), !$('maioridade').checked ? 'Confirme que você tem 18 anos ou mais.' : null]);
    checks.push([$('aceite'), !$('aceite').checked ? 'É preciso aceitar os termos para concluir.' : null]);

    if (!SC.ui.form.validate(form, checks)) return;

    var cliente = user
      ? { nome: user.nome, email: user.email, cpf: user.cpf, telefone: user.telefone }
      : { nome: v('nome'), email: v('email').toLowerCase(), cpf: util.digits(v('cpf')), telefone: util.digits(v('telefone')) };
    var endereco = retirada
      ? null
      : { cep: util.maskCEP(v('cep')), logradouro: v('logradouro'), numero: v('numero'), complemento: v('complemento'), bairro: v('bairro'), cidade: v('cidade'), uf: v('uf').toUpperCase() };
    var pagamentoInfo =
      metodo === 'cartao'
        ? comServidor
          ? { metodo: 'cartao' }
          : { metodo: 'cartao', final: util.digits(v('cartao-numero')).slice(-4), parcelas: Number(v('parcelas')) || 1 }
        : { metodo: 'pix', parcelas: 1 };

    var botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    SC.ui.announce('Criando seu pedido…');

    // Guarda o endereço na conta para a próxima compra.
    var salvarEndereco = user && endereco ? SC.conta.atualizarPerfil({ endereco: endereco }).catch(function () {}) : Promise.resolve();

    salvarEndereco
      .then(function () {
        return SC.orders.create({
          cliente: cliente,
          endereco: endereco,
          pagamento: pagamentoInfo,
          observacoes: v('observacoes'),
          aceiteTermos: $('aceite').checked,
          confirmaMaioridade: !!($('maioridade') && $('maioridade').checked),
        });
      })
      .then(function (res) {
        // Cartão com servidor: conclui no ambiente seguro do Mercado Pago.
        if (res.pagamento && res.pagamento.checkoutUrl) {
          SC.ui.announce('Levando você ao Mercado Pago…');
          window.location.href = res.pagamento.checkoutUrl;
          return;
        }
        SC.navigate('pedido', { id: res.pedido.id, novo: 1 });
      })
      .catch(function (err) {
        botao.disabled = false;
        botao.removeAttribute('aria-busy');
        SC.ui.toast(err.message, 'erro');
      });
  });
})();
