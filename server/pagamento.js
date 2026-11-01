// Pagamentos: Mercado Pago (real) ou simulado (sem credenciais).
//
// - Pix: criado pela API de Pagamentos; o QR Code aparece na página do pedido.
// - Cartão: Checkout Pro — o cliente digita o cartão no ambiente seguro do
//   Mercado Pago, então os dados do cartão nunca passam por este servidor.
// - Confirmação: webhook (/api/webhooks/mercadopago) e consulta periódica.
const crypto = require('node:crypto');

const MP_API = 'https://api.mercadopago.com';
const accessToken = process.env.MP_ACCESS_TOKEN || '';
const provedor = accessToken ? 'mercadopago' : 'simulado';
const PIX_MINUTOS = Number(process.env.PIX_EXPIRA_MINUTOS || 30);

// Status do Mercado Pago -> status do pedido.
const STATUS_MP = {
  approved: 'pago',
  authorized: 'aguardando',
  pending: 'aguardando',
  in_process: 'aguardando',
  in_mediation: 'aguardando',
  rejected: 'recusado',
  cancelled: 'cancelado',
  refunded: 'cancelado',
  charged_back: 'cancelado',
};

async function mp(metodo, caminho, corpo, idempotencia) {
  const headers = { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' };
  if (idempotencia) headers['X-Idempotency-Key'] = idempotencia;
  const res = await fetch(MP_API + caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalhe = json.message || (json.cause && json.cause[0] && json.cause[0].description) || res.statusText;
    const erro = new Error('Mercado Pago: ' + detalhe);
    erro.status = res.status;
    throw erro;
  }
  return json;
}

// Data no formato aceito pelo Mercado Pago (horário de Brasília).
function dataMP(data) {
  const brt = new Date(data.getTime() - 3 * 3600 * 1000);
  return brt.toISOString().replace('Z', '-03:00');
}

function nomes(nomeCompleto) {
  const partes = String(nomeCompleto || '').trim().split(/\s+/);
  return { first_name: partes[0] || 'Cliente', last_name: partes.slice(1).join(' ') || 'Santo Cacau' };
}

function urlNotificacao() {
  const base = process.env.PUBLIC_URL || '';
  // O Mercado Pago só aceita notificações em endereço público com HTTPS.
  return /^https:\/\//.test(base) ? base.replace(/\/$/, '') + '/api/webhooks/mercadopago' : undefined;
}

function codigoPixDemo(pedido) {
  return '00020126580014BR.GOV.BCB.PIX0136SANTOCACAU-DEMO-' + pedido.id + '5204000053039865406' + pedido.total.toFixed(2) + '5802BR5913SANTO CACAU6009SAO PAULO6304DEMO';
}

/** Cria a cobrança Pix. Retorna os dados públicos do pagamento. */
async function criarPix(pedido) {
  const expira = new Date(Date.now() + PIX_MINUTOS * 60 * 1000);
  if (provedor === 'simulado') {
    return { metodo: 'pix', provedor, parcelas: 1, pix: { qrCode: codigoPixDemo(pedido), expiraEm: expira.toISOString() } };
  }
  const pagamento = await mp(
    'POST',
    '/v1/payments',
    {
      transaction_amount: pedido.total,
      description: 'Pedido Santo Cacau #' + pedido.id,
      payment_method_id: 'pix',
      external_reference: pedido.id,
      date_of_expiration: dataMP(expira),
      notification_url: urlNotificacao(),
      payer: {
        email: pedido.cliente.email,
        ...nomes(pedido.cliente.nome),
        identification: { type: 'CPF', number: pedido.cliente.cpf },
      },
    },
    'pix-' + pedido.id
  );
  const dados = (pagamento.point_of_interaction && pagamento.point_of_interaction.transaction_data) || {};
  return {
    metodo: 'pix',
    provedor,
    parcelas: 1,
    idExterno: String(pagamento.id),
    pix: { qrCode: dados.qr_code, qrCodeBase64: dados.qr_code_base64, expiraEm: pagamento.date_of_expiration || expira.toISOString() },
  };
}

/** Cria o Checkout Pro para cartão. Retorna a URL do ambiente seguro. */
async function criarCheckoutCartao(pedido, urlRetorno, parcelasMax) {
  if (provedor === 'simulado') return { metodo: 'cartao', provedor, parcelas: 1 };
  const preferencia = await mp('POST', '/checkout/preferences', {
    items: [
      {
        id: pedido.id,
        title: 'Pedido Santo Cacau #' + pedido.id,
        description: pedido.itens.map((i) => i.qtd + 'x ' + i.nome).join(', ').slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: pedido.total,
      },
    ],
    payer: { email: pedido.cliente.email, name: nomes(pedido.cliente.nome).first_name, surname: nomes(pedido.cliente.nome).last_name },
    external_reference: pedido.id,
    back_urls: { success: urlRetorno, pending: urlRetorno, failure: urlRetorno },
    auto_return: 'approved',
    notification_url: urlNotificacao(),
    statement_descriptor: 'SANTOCACAU',
    payment_methods: {
      installments: parcelasMax,
      excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }],
    },
  });
  const teste = accessToken.startsWith('TEST-');
  return {
    metodo: 'cartao',
    provedor,
    parcelas: 1,
    idExterno: preferencia.id,
    checkoutUrl: (teste && preferencia.sandbox_init_point) || preferencia.init_point,
  };
}

/** Consulta o pagamento mais recente de um pedido no Mercado Pago. */
async function consultarPedido(pedidoId) {
  if (provedor === 'simulado') return null;
  const busca = await mp('GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' + encodeURIComponent(pedidoId));
  const pagamento = (busca.results || [])[0];
  if (!pagamento) return null;
  return traduzir(pagamento);
}

async function consultarPagamento(paymentId) {
  return traduzir(await mp('GET', '/v1/payments/' + encodeURIComponent(paymentId)));
}

function traduzir(pagamento) {
  let status = STATUS_MP[pagamento.status] || 'aguardando';
  // Pix vencido aparece como "cancelled" com motivo "expired".
  if (pagamento.status === 'cancelled' && /expir/i.test(pagamento.status_detail || '')) status = 'expirado';
  return {
    status,
    pedidoId: pagamento.external_reference,
    paymentId: String(pagamento.id),
    parcelas: pagamento.installments || 1,
    final: pagamento.card && pagamento.card.last_four_digits,
  };
}

// Confere a assinatura do webhook (x-signature), se MP_WEBHOOK_SECRET existir.
function assinaturaValida(req, dataId) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  if (!segredo) return true;
  const cabecalho = req.get('x-signature') || '';
  const partes = Object.fromEntries(cabecalho.split(',').map((p) => p.trim().split('=')));
  if (!partes.ts || !partes.v1) return false;
  const manifesto = 'id:' + String(dataId).toLowerCase() + ';request-id:' + (req.get('x-request-id') || '') + ';ts:' + partes.ts + ';';
  const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { provedor, criarPix, criarCheckoutCartao, consultarPedido, consultarPagamento, assinaturaValida };
