// Confirmação e acompanhamento de pedido.
(function () {
  var SC = window.SantoCacau;
  var util = SC.util;
  var esc = util.esc;
  var icon = util.icon;
  var root = document.getElementById('pedido');
  var novo = SC.param('novo') === '1';

  function etapas(status) {
    var lista = [
      { id: 'aguardando', nome: 'Pedido recebido' },
      { id: 'pago', nome: 'Pagamento aprovado' },
      { id: 'preparo', nome: 'Em preparo no ateliê' },
      { id: 'enviado', nome: 'A caminho' },
      { id: 'entregue', nome: 'Entregue' },
    ];
    var atual = Math.max(0, lista.map(function (e) { return e.id; }).indexOf(status));
    return (
      '<ol class="flex flex-col gap-3">' +
      lista
        .map(function (e, i) {
          var feito = i <= atual;
          return (
            '<li class="flex items-center gap-3"' + (i === atual ? ' aria-current="step"' : '') + '>' +
            '<span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ' +
            (feito ? 'bg-sucesso text-surface' : 'border-2 border-outline text-on-surface-variant') + '">' +
            icon(feito ? 'check' : 'radio_button_unchecked', 'text-[1.125rem]') + '</span>' +
            '<span class="text-body-md ' + (feito ? 'font-semibold text-on-surface' : 'text-on-surface-variant') + '">' + e.nome +
            '<span class="sr-only">' + (i < atual ? ' (concluído)' : i === atual ? ' (etapa atual)' : ' (pendente)') + '</span></span></li>'
          );
        })
        .join('') +
      '</ol>'
    );
  }

  // Volta do Mercado Pago: guarda o código de acesso do pedido (visitantes).
  var tokenUrl = SC.param('token');
  if (tokenUrl && SC.param('id')) {
    var mapa = SC.storage.get('pedidos-tokens', {});
    mapa[SC.param('id')] = tokenUrl;
    SC.storage.set('pedidos-tokens', mapa);
  }

  var statusAnterior = null;
  var acompanhamento = null;

  function render(o) {
    if (!o) {
      root.innerHTML =
        '<div class="card rounded-xl bg-surface-container-low p-8 text-center flex flex-col items-center gap-3 mt-4">' +
        icon('receipt_long', 'text-[2.5rem] text-secondary') +
        '<h1 class="font-titulo text-headline-lg">Pedido não encontrado</h1>' +
        '<p class="text-body-md text-on-surface-variant">Confira o link ou acesse seus pedidos na sua conta.</p>' +
        '<a href="' + SC.url('dashboard') + '" class="btn tap px-5 rounded-full bg-primary text-on-primary text-label-lg flex items-center">Minha conta</a></div>';
      return;
    }
    document.title = 'Pedido #' + o.id + ' — Santo Cacau';
    var v = o.valores;
    var aguardando = o.status === 'aguardando';
    var pix = o.pagamento.metodo === 'pix' && aguardando && o.pagamento.pix;
    var simulado = o.pagamento.provedor === 'simulado';
    var falhou = o.status === 'recusado' || o.status === 'expirado' || o.status === 'cancelado';
    var titulo = falhou ? 'Pagamento não concluído' : aguardando ? (novo ? 'Pedido recebido!' : 'Pedido #' + esc(o.id)) : novo ? 'Pedido confirmado!' : 'Pedido #' + esc(o.id);

    root.innerHTML =
      '<div class="pt-2 flex flex-col gap-4">' +
      '<div class="text-center flex flex-col items-center gap-2">' +
      (novo ? '<span class="w-16 h-16 rounded-full bg-sucesso-container text-on-sucesso-container flex items-center justify-center">' + icon('celebration', 'text-[2rem]') + '</span>' : '') +
      '<h1 id="pedido-titulo" tabindex="-1" class="font-titulo text-headline-xl">' + titulo + '</h1>' +
      '<p class="text-body-md text-on-surface-variant">' + (novo ? 'Número do pedido: <strong class="text-on-surface">#' + esc(o.id) + '</strong>. ' : '') +
      'Feito em ' + util.dateTime(o.criadoEm) + '.' + (o.cliente.email ? ' Enviamos as atualizações para ' + esc(o.cliente.email) + '.' : '') + '</p>' +
      (o.graosGanhos && !falhou
        ? '<p class="text-label-lg text-secondary flex items-center gap-1">' + icon('savings') + '+' + o.graosGanhos + ' Grãos Dourados ' + (aguardando ? 'após a confirmação do pagamento' : 'creditados') + '</p>'
        : '') +
      (falhou
        ? '<p class="rounded-lg bg-error-container text-on-error-container p-3 text-body-md">O pagamento ficou como “' + esc(SC.orders.statusLabel(o.status)) +
          '”. Nenhum valor foi cobrado. <a class="underline font-semibold" href="' + SC.url('catalogo') + '">Faça um novo pedido</a> ou fale com a gente na <a class="underline font-semibold" href="' + SC.url('ajuda', { pedido: o.id }, 'contato') + '">Central de ajuda</a>.</p>'
        : '') +
      '</div>' +

      (pix
        ? '<section aria-labelledby="pix-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">' +
          '<h2 id="pix-titulo" class="text-title-lg flex items-center gap-2">' + icon('qr_code_2', 'text-secondary') + 'Pague com Pix</h2>' +
          '<p class="text-body-sm text-on-surface-variant">Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código abaixo. Valor: <strong class="text-on-surface">' + util.money(v.total) + '</strong>.' +
          (simulado ? ' (Código de demonstração — não pague.)' : '') +
          (o.pagamento.pix.expiraEm ? ' Válido até ' + esc(util.dateTime(o.pagamento.pix.expiraEm)) + '.' : '') + '</p>' +
          (o.pagamento.pix.qrCodeBase64
            ? '<img src="data:image/png;base64,' + esc(o.pagamento.pix.qrCodeBase64) + '" alt="QR Code Pix para pagar ' + esc(util.money(v.total)) + '. Se não conseguir ler, use o código copia e cola abaixo." class="w-56 h-56 self-center bg-white p-2 rounded-lg" />'
            : '') +
          '<label for="pix-codigo" class="text-label-lg">Código Pix copia e cola</label>' +
          '<textarea id="pix-codigo" readonly rows="3" class="campo font-mono text-body-sm break-all">' + esc(o.pagamento.pix.qrCode) + '</textarea>' +
          '<p class="text-body-sm text-on-surface-variant">Esta página atualiza sozinha quando o pagamento for confirmado.</p>' +
          '<div class="flex flex-col sm:flex-row gap-2">' +
          '<button type="button" id="copiar-pix" class="btn tap flex-1 px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2">' + icon('content_copy') + 'Copiar código Pix</button>' +
          (simulado ? '<button type="button" id="simular-pagamento" class="btn tap flex-1 px-4 rounded-full border-2 border-primary text-on-surface text-label-lg">Simular pagamento aprovado</button>' : '') +
          '</div></section>'
        : '') +

      '<section aria-labelledby="status-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">' +
      '<h2 id="status-titulo" class="text-title-lg">Acompanhamento: ' + esc(SC.orders.statusLabel(o.status)) + '</h2>' + etapas(o.status) + '</section>' +

      '<section aria-labelledby="itens-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-3">' +
      '<h2 id="itens-titulo" class="text-title-lg">Itens</h2><ul class="flex flex-col gap-3">' +
      o.itens.map(function (i) {
        return '<li class="flex items-center gap-3"><img src="' + SC.asset(i.img) + '" alt="" class="w-14 h-14 rounded-lg object-cover" />' +
          '<span class="flex-1 text-body-md">' + i.qtd + '× ' + esc(i.nome) + (i.presente ? ' <span class="text-body-sm text-secondary">(presente)</span>' : '') + '</span>' +
          '<span class="text-label-lg">' + util.money(i.preco * i.qtd) + '</span></li>';
      }).join('') + '</ul>' +
      '<dl class="flex flex-col gap-1 text-body-md border-t border-outline-variant pt-3">' +
      '<div class="flex justify-between"><dt>Subtotal</dt><dd>' + util.money(v.subtotal) + '</dd></div>' +
      (v.embalagem ? '<div class="flex justify-between"><dt>Embalagem</dt><dd>' + util.money(v.embalagem) + '</dd></div>' : '') +
      '<div class="flex justify-between"><dt>Frete</dt><dd>' + (v.frete ? util.money(v.frete) : 'Grátis') + '</dd></div>' +
      (v.descontoCupom ? '<div class="flex justify-between text-sucesso"><dt>Cupom ' + esc(o.cupom) + '</dt><dd>− ' + util.money(v.descontoCupom) + '</dd></div>' : '') +
      (v.descontoGraos ? '<div class="flex justify-between text-sucesso"><dt>Grãos Dourados</dt><dd>− ' + util.money(v.descontoGraos) + '</dd></div>' : '') +
      '<div class="flex justify-between text-title-lg font-bold"><dt>Total</dt><dd>' + util.money(v.total) + '</dd></div>' +
      '</dl><p class="text-body-sm text-on-surface-variant">Pagamento: ' +
      (o.pagamento.metodo === 'cartao' ? 'cartão' + (o.pagamento.final ? ' final ' + esc(o.pagamento.final) : '') + (v.parcelas > 1 ? ' em ' + v.parcelas + 'x' : '') : 'Pix') + (simulado ? ' (simulado)' : ' via Mercado Pago') + '</p></section>' +

      '<section aria-labelledby="entrega-titulo" class="card p-4 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-1">' +
      '<h2 id="entrega-titulo" class="text-title-lg">' + esc(o.entrega.nome) + '</h2>' +
      '<p class="text-body-md text-on-surface-variant">' + esc(o.entrega.prazo) + '</p>' +
      (o.entrega.endereco && o.entrega.endereco.logradouro
        ? '<p class="text-body-md">' + esc(o.entrega.endereco.logradouro) + ', ' + esc(o.entrega.endereco.numero) +
          (o.entrega.endereco.complemento ? ' — ' + esc(o.entrega.endereco.complemento) : '') + '<br />' +
          esc(o.entrega.endereco.bairro) + ', ' + esc(o.entrega.endereco.cidade) + '/' + esc(o.entrega.endereco.uf) + ' — CEP ' + esc(o.entrega.endereco.cep) + '</p>'
        : '<p class="text-body-md">' + esc(window.SC_DATA.boutiques[0].endereco) + '</p>') +
      (o.observacoes ? '<p class="text-body-sm text-on-surface-variant mt-2">Mensagem do cartão: “' + esc(o.observacoes) + '”</p>' : '') +
      '</section>' +

      '<div class="flex flex-col sm:flex-row gap-2">' +
      '<a href="' + SC.url('catalogo') + '" class="btn tap flex-1 px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center">Continuar comprando</a>' +
      (o.userId ? '<a href="' + SC.url('dashboard', null, 'pedidos') + '" class="btn tap flex-1 px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center">Meus pedidos</a>' : '') +
      '<a href="' + SC.url('ajuda') + '" class="btn tap flex-1 px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center">Preciso de ajuda</a>' +
      '</div>' +
      '<p class="text-body-sm text-on-surface-variant">Arrependeu-se? Você tem 7 dias após o recebimento para desistir. Veja a <a class="underline text-secondary font-semibold" href="' + SC.url('trocas') + '">política de trocas</a>.</p>' +
      '</div>';

    var copiar = document.getElementById('copiar-pix');
    if (copiar) {
      copiar.addEventListener('click', function () {
        var campo = document.getElementById('pix-codigo');
        var done = function () { SC.ui.toast('Código Pix copiado.'); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(campo.value).then(done, function () { campo.select(); document.execCommand('copy'); done(); });
        else { campo.select(); document.execCommand('copy'); done(); }
      });
      var simular = document.getElementById('simular-pagamento');
      if (simular) {
        simular.addEventListener('click', function () {
          simular.disabled = true;
          SC.orders.simularPagamento(o.id).then(
            function (pedido) {
              mostrar(pedido);
              document.getElementById('status-titulo').scrollIntoView();
            },
            function (err) {
              simular.disabled = false;
              SC.ui.toast(err.message, 'erro');
            }
          );
        });
      }
    }
  }

  // Renderiza e avisa quando o status muda (ex.: Pix confirmado pelo banco).
  function mostrar(o) {
    render(o);
    if (o && statusAnterior === 'aguardando' && o.status !== 'aguardando') {
      var ok = o.status === 'pago';
      SC.ui.toast(ok ? 'Pagamento aprovado! Seu pedido já vai para o ateliê.' : 'Status do pedido: ' + SC.orders.statusLabel(o.status) + '.', ok ? 'sucesso' : 'erro');
      SC.auth.refresh();
    }
    statusAnterior = o && o.status;
    clearTimeout(acompanhamento);
    // Com servidor, consulta o status a cada 5 segundos enquanto aguarda.
    if (o && o.status === 'aguardando' && SC.modo === 'api') {
      acompanhamento = setTimeout(function () {
        SC.orders.get(o.id).then(mostrar, function () {
          mostrar(o);
        });
      }, 5000);
    }
  }

  root.innerHTML = '<p class="pt-4 text-body-md" role="status">Carregando pedido…</p>';
  SC.orders.get(SC.param('id')).then(
    function (o) {
      mostrar(o);
      var titulo = document.getElementById('pedido-titulo');
      if (titulo) titulo.focus();
      if (novo && o) SC.ui.announce(o.status === 'pago' ? 'Pedido confirmado com sucesso.' : 'Pedido recebido. Aguardando pagamento.');
    },
    function (err) {
      root.innerHTML = '<p class="pt-4 text-body-md text-error" role="alert">' + esc(err.message) + '</p>';
    }
  );
})();
