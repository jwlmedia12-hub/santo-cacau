// Aplicação HTTP: API em /api e o site (pasta www/) no mesmo endereço.
const path = require('node:path');
const express = require('express');
const s = require('./servicos');
const pagamento = require('./pagamento');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORTA = Number(process.env.PORT || 3000);
// Endereço público do site (usado em links de e-mail e na volta do Mercado Pago).
const SITE_URL = (process.env.SITE_URL || process.env.PUBLIC_URL || 'http://localhost:' + PORTA).replace(/\/$/, '');
const ORIGENS = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

/* ---------- Segurança básica ---------- */

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=(self)',
  });
  // CORS só para os endereços autorizados (ex.: o site no GitHub Pages).
  const origem = req.get('origin');
  if (origem && ORIGENS.includes(origem)) {
    res.set({
      'Access-Control-Allow-Origin': origem,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', express.json({ limit: '50kb' }));

// Limite simples de tentativas por IP (login, cadastro, senha, contato).
const tentativas = new Map();
function limite(maximo, janelaMs) {
  return (req, res, next) => {
    const chave = req.path + ':' + req.ip;
    const agora = Date.now();
    const t = tentativas.get(chave) || { n: 0, fim: agora + janelaMs };
    if (agora > t.fim) {
      t.n = 0;
      t.fim = agora + janelaMs;
    }
    t.n++;
    tentativas.set(chave, t);
    if (t.n > maximo) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    next();
  };
}
setInterval(() => {
  const agora = Date.now();
  for (const [k, t] of tentativas) if (agora > t.fim) tentativas.delete(k);
}, 60000).unref();

/* ---------- Autenticação ---------- */

function tokenDe(req) {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
function usuarioOpcional(req, res, next) {
  req.usuario = s.usuarioDoToken(tokenDe(req));
  next();
}
function exigeLogin(req, res, next) {
  req.usuario = s.usuarioDoToken(tokenDe(req));
  if (!req.usuario) return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
  next();
}
// Converte erros em respostas JSON com mensagem amigável.
const rota = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (erro) {
    if (erro instanceof s.ErroNegocio) return res.status(erro.status).json({ erro: erro.message });
    console.error(erro);
    res.status(500).json({ erro: 'Erro inesperado. Tente novamente em instantes.' });
  }
};

/* ---------- Rotas ---------- */

app.get('/api/saude', (req, res) => res.json({ ok: true, pagamento: pagamento.provedor }));

app.post('/api/auth/cadastro', limite(10, 15 * 60000), rota((req, res) => res.status(201).json(s.cadastrar(req.body))));
app.post('/api/auth/login', limite(10, 15 * 60000), rota((req, res) => res.json(s.entrar(req.body.identificador, req.body.senha))));
app.post('/api/auth/logout', rota((req, res) => {
  s.encerrarSessao(tokenDe(req));
  res.json({ ok: true });
}));
app.post('/api/auth/senha', exigeLogin, limite(10, 15 * 60000), rota((req, res) => {
  s.trocarSenha(req.usuario, req.body.atual, req.body.nova);
  res.json({ ok: true });
}));
app.post('/api/auth/recuperar', limite(5, 15 * 60000), rota(async (req, res) => {
  await s.pedirRedefinicao(req.body.email, SITE_URL);
  res.json({ ok: true });
}));
app.post('/api/auth/redefinir', limite(10, 15 * 60000), rota((req, res) => {
  s.redefinirSenha(req.body.token, req.body.senha);
  res.json({ ok: true });
}));

app.get('/api/eu', exigeLogin, rota((req, res) => res.json({ usuario: s.usuarioPublico(req.usuario) })));
app.patch('/api/eu', exigeLogin, rota((req, res) => res.json({ usuario: s.atualizarPerfil(req.usuario, req.body) })));
app.post('/api/eu/marketing', exigeLogin, rota((req, res) => res.json({ usuario: s.marketing(req.usuario, req.body.aceito) })));
app.post('/api/eu/resgates', exigeLogin, rota((req, res) => res.json(s.resgatar(req.usuario, req.body.recompensaId))));
app.post('/api/eu/agendamentos', exigeLogin, rota((req, res) => res.json({ usuario: s.agendar(req.usuario, req.body) })));
app.delete('/api/eu/agendamentos/:id', exigeLogin, rota((req, res) => res.json({ usuario: s.cancelarAgendamento(req.usuario, req.params.id) })));
app.get('/api/eu/exportar', exigeLogin, rota((req, res) => res.json(s.exportar(req.usuario))));
app.delete('/api/eu', exigeLogin, rota((req, res) => {
  s.excluirConta(req.usuario);
  res.json({ ok: true });
}));

app.get('/api/pedidos', exigeLogin, rota((req, res) => res.json({ pedidos: s.listarPedidos(req.usuario.id) })));
app.get('/api/pedidos/:id', usuarioOpcional, rota(async (req, res) => {
  let linha = s.buscarPedido(req.params.id, req.usuario, req.query.token);
  if (!linha) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  linha = await s.sincronizar(linha);
  res.json({ pedido: s.pedidoPublico(linha) });
}));
app.post('/api/pedidos', usuarioOpcional, limite(20, 15 * 60000), rota(async (req, res) => {
  res.status(201).json(await s.criarPedido(req.usuario, req.body, SITE_URL));
}));
// Só existe no modo simulado (sem credenciais do Mercado Pago).
app.post('/api/pedidos/:id/simular-pagamento', usuarioOpcional, rota((req, res) => {
  if (pagamento.provedor !== 'simulado') return res.status(403).json({ erro: 'Pagamento real: aguarde a confirmação do banco.' });
  const linha = s.buscarPedido(req.params.id, req.usuario, req.body.token);
  if (!linha) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  s.atualizarStatus(linha.id, 'pago');
  const atual = s.buscarPedido(linha.id, req.usuario, req.body.token);
  res.json({ pedido: s.pedidoPublico(atual), usuario: req.usuario ? s.usuarioPublico(s.usuarioDoToken(tokenDe(req))) : undefined });
}));

app.post('/api/contato', usuarioOpcional, limite(5, 15 * 60000), rota(async (req, res) => {
  res.status(201).json(await s.registrarContato(req.usuario, req.body));
}));

// Notificações do Mercado Pago. Responde 200 rápido; erros vão para o log.
app.post('/api/webhooks/mercadopago', express.json({ limit: '50kb' }), async (req, res) => {
  const tipo = req.query.type || req.query.topic || (req.body && req.body.type);
  const dataId = req.query['data.id'] || (req.body && req.body.data && req.body.data.id) || req.query.id;
  if (tipo !== 'payment' || !dataId) return res.sendStatus(200);
  if (!pagamento.assinaturaValida(req, dataId)) return res.sendStatus(401);
  try {
    await s.processarWebhook(dataId);
    res.sendStatus(200);
  } catch (erro) {
    console.error('[webhook] %s', erro.message);
    res.sendStatus(500); // o Mercado Pago tenta de novo
  }
});

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

/* ---------- Site ---------- */

// O site servido por aqui usa esta mesma API (apiUrl '').
app.get('/js/config.js', (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-cache');
  res.send("window.SC_CONFIG = { apiUrl: '' };\n");
});
app.use(
  express.static(path.join(__dirname, '..', 'www'), {
    setHeaders: (res) => res.set('Cache-Control', 'no-cache'),
  })
);

module.exports = { app, PORTA, SITE_URL };
