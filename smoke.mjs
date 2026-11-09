// Testes rápidos da API do Santo Cacau (modo simulado).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.PORT = '3999';
const { app } = require('./server/app.js');
const { iniciar } = require('./server/db.js');
await iniciar();
const srv = app.listen(3999);
const B = 'http://localhost:3999';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const out = [];
const t = (id, desc, ok, nota) => out.push({ id, desc, ok, nota });
const cli = { nome: 'Ana Teste', email: 'ana@teste.com', cpf: '52998224725', telefone: '11987654321' };
const end = { cep: '01310-100', logradouro: 'Av Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };
const base = { itens: [{ id: 'trufas-nobres-70', qtd: 2, preco: 0.01 }], opts: { entrega: 'padrao' }, pagamento: { metodo: 'pix' }, cliente: cli, endereco: end, aceiteTermos: true };

let r = await call('GET', '/api/saude');
t('API-01', 'Saúde da API', r.s === 200, JSON.stringify(r.j));

r = await call('POST', '/api/pedidos', base);
const ped = r.j.pedido || r.j; const pid = ped.id; const tok = r.j.token || ped.token;
t('PAG-01', 'Pedido Pix com preço adulterado (0,01) recalculado no servidor', r.s === 201 && ped.valores && ped.valores.subtotal === 137, `status ${r.s}, subtotal ${ped.valores && ped.valores.subtotal}, total ${ped.valores && ped.valores.total}`);
t('PAG-02', 'Pedido Pix gera QR Code', !!(ped.pagamento && ped.pagamento.pix && ped.pagamento.pix.qrCode), ped.pagamento && ped.pagamento.provedor);

r = await call('POST', `/api/pedidos/${pid}/simular-pagamento`, { token: tok });
t('PAG-03', 'Simular pagamento muda status para pago', r.s === 200 && r.j.pedido && r.j.pedido.status === 'pago', `status ${r.s}: ${r.j.pedido && r.j.pedido.status}`);

r = await call('GET', `/api/pedidos/${pid}`);
t('SEG-01', 'Pedido sem token de acesso não é exibido', r.s === 404, `status ${r.s}`);

r = await call('POST', '/api/pedidos', { ...base, opts: { entrega: 'expressa' }, endereco: { ...end, cep: '20040-002', cidade: 'Rio de Janeiro', uf: 'RJ' } });
t('LOC-01', 'Entrega expressa recusada fora da capital de SP', r.s === 400, `status ${r.s}: ${r.j.erro}`);

r = await call('POST', '/api/pedidos', { ...base, endereco: { ...end, cep: '123' } });
t('LOC-02', 'CEP incompleto é recusado', r.s === 400, `status ${r.s}: ${r.j.erro}`);

r = await call('POST', '/api/pedidos', { ...base, opts: { entrega: 'padrao', cupom: 'NAOEXISTE' } });
t('CUP-01', 'Cupom inexistente é recusado', r.s === 400, `status ${r.s}: ${r.j.erro}`);

r = await call('POST', '/api/pedidos', { ...base, itens: [{ id: 'trufa-caramelo-salgado', qtd: 2 }], opts: { entrega: 'padrao', cupom: 'DEGUSTA15' } });
t('CUP-02', 'Cupom DEGUSTA15 abaixo do mínimo de R$ 100 é recusado', r.s === 400, `status ${r.s}: ${r.j.erro}`);

r = await call('POST', '/api/pedidos', { ...base, aceiteTermos: false });
t('PAG-04', 'Pedido sem aceite dos termos é recusado', r.s === 400, `status ${r.s}: ${r.j.erro}`);

r = await call('POST', '/api/webhooks/mercadopago?type=payment&data.id=123', { type: 'payment', data: { id: '123' } });
t('SEG-02', 'Webhook do Mercado Pago sem assinatura', r.s === 401, `status ${r.s}`);

let codes = [];
for (let i = 0; i < 11; i++) codes.push((await call('POST', '/api/auth/login', { identificador: 'ana@teste.com', senha: 'errada' + i })).s);
t('SEG-03', '11ª tentativa de login seguida é bloqueada (429)', codes[10] === 429, codes.join(','));

// Estresse leve: 300 requisições, 50 simultâneas
const t0 = Date.now(); let erros = 0; const lat = [];
for (let lote = 0; lote < 6; lote++) {
  await Promise.all(Array.from({ length: 50 }, async () => {
    const a = Date.now();
    const x = await call('GET', '/api/saude').catch(() => ({ s: 0 }));
    lat.push(Date.now() - a);
    if (x.s !== 200) erros++;
  }));
}
lat.sort((a, b) => a - b);
t('DES-01', '300 requisições (50 simultâneas) em /api/saude', erros === 0, `${erros} erros, p95 ${lat[Math.floor(lat.length * 0.95)]} ms, total ${Date.now() - t0} ms`);

srv.close();
console.log(JSON.stringify(out, null, 1));
process.exit(0);
