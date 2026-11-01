// Regras de negócio: contas, Grãos Dourados, pedidos e pagamentos.
// Toda alteração de saldo acontece aqui, dentro de transações.
const crypto = require('node:crypto');
const { db, transacao } = require('./db');
const catalogo = require('./catalogo');
const pagamento = require('./pagamento');
const email = require('./email');

const { DATA, EMPRESA } = catalogo;
const agora = () => new Date().toISOString();
const json = (v) => JSON.stringify(v);
const parse = (v, padrao) => {
  try {
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
};

class ErroNegocio extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

const id = (prefixo) => prefixo + crypto.randomBytes(6).toString('hex').toUpperCase();
const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');
const digitos = (v) => String(v || '').replace(/\D/g, '');

/* ---------- Validações ---------- */

const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
function cpfValido(valor) {
  const cpf = digitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[t])) return false;
  }
  return true;
}
function idade(iso) {
  const n = new Date(iso);
  if (isNaN(n)) return 0;
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  return a;
}
const senhaForte = (s) => typeof s === 'string' && s.length >= 8 && s.length <= 200 && /\d/.test(s) && /[A-Za-zÀ-ÿ]/.test(s);
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/* ---------- Senhas e sessões ---------- */

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, sal, 64).toString('hex');
  return 'scrypt:' + sal + ':' + hash;
}
function confereSenha(senha, guardado) {
  const [, sal, hash] = String(guardado).split(':');
  if (!sal || !hash) return false;
  const calculado = crypto.scryptSync(String(senha), sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}

const DIAS_SESSAO = 30;
function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DIAS_SESSAO * 86400000).toISOString();
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)').run(sha256(token), usuarioId, agora(), expira);
  return token;
}
function usuarioDoToken(token) {
  if (!token) return null;
  const s = db.prepare('SELECT usuario_id, expira_em FROM sessoes WHERE token_hash = ?').get(sha256(token));
  if (!s) return null;
  if (s.expira_em < agora()) {
    db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(sha256(token));
    return null;
  }
  return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(s.usuario_id) || null;
}
function encerrarSessao(token) {
  db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(sha256(token || ''));
}

/* ---------- Usuário público (mesmo formato do site) ---------- */

function usuarioPublico(u) {
  if (!u) return null;
  const extrato = db.prepare('SELECT data, descricao, graos, icone FROM extrato WHERE usuario_id = ? ORDER BY id DESC LIMIT 50').all(u.id);
  const resgates = db.prepare('SELECT recompensa_id AS id, nome, data, codigo FROM resgates WHERE usuario_id = ? ORDER BY data DESC').all(u.id);
  const agendamentos = db
    .prepare('SELECT id, experiencia, nome, boutique, data, hora, necessidades, graos FROM agendamentos WHERE usuario_id = ? ORDER BY data, hora')
    .all(u.id);
  const pedidosCount = db.prepare('SELECT COUNT(*) AS n FROM pedidos WHERE usuario_id = ?').get(u.id).n;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: u.cpf,
    telefone: u.telefone,
    nascimento: u.nascimento,
    criadoEm: u.criado_em,
    graos: u.graos,
    graosTotal: u.graos_total,
    extrato: extrato.map((e) => ({ ...e })),
    resgates: resgates.map((r) => ({ ...r })),
    agendamentos: agendamentos.map((a) => ({ ...a })),
    enderecos: parse(u.enderecos, []),
    preferencias: parse(u.preferencias, { dietas: [], avisos: false }),
    consentimentos: parse(u.consentimentos, {}),
    pedidosCount,
  };
}
const recarregar = (usuarioId) => db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);

function lancarGraos(usuarioId, graos, descricao, icone) {
  db.prepare('UPDATE usuarios SET graos = graos + ?, graos_total = graos_total + ? WHERE id = ?').run(graos, graos > 0 ? graos : 0, usuarioId);
  db.prepare('INSERT INTO extrato (usuario_id, data, descricao, graos, icone) VALUES (?, ?, ?, ?, ?)').run(usuarioId, agora(), descricao, graos, icone);
}

/* ---------- Conta ---------- */

function cadastrar(d) {
  const nome = texto(d.nome, 120);
  const mail = texto(d.email, 200).toLowerCase();
  if (nome.split(/\s+/).length < 2) throw new ErroNegocio('Informe nome e sobrenome.');
  if (!emailValido(mail)) throw new ErroNegocio('Informe um e-mail válido.');
  if (!cpfValido(d.cpf)) throw new ErroNegocio('CPF inválido.');
  if (digitos(d.telefone).length < 10) throw new ErroNegocio('Informe o celular com DDD.');
  if (idade(d.nascimento) < 18) throw new ErroNegocio('O cadastro é permitido apenas para maiores de 18 anos.');
  if (!senhaForte(d.senha)) throw new ErroNegocio('A senha precisa de 8 caracteres, com letras e números.');
  const cpf = digitos(d.cpf);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ? OR cpf = ?').get(mail, cpf)) {
    throw new ErroNegocio('Já existe uma conta com este e-mail ou CPF.', 409);
  }
  const usuarioId = id('U');
  const data = agora();
  const bonus = DATA.regras.bonusCadastro;
  const consentimentos = {
    termos: { aceito: true, data, versao: EMPRESA.atualizacaoPoliticas },
    privacidade: { aceito: true, data, versao: EMPRESA.atualizacaoPoliticas },
    marketing: { aceito: !!d.marketing, data },
  };
  transacao(() => {
    db.prepare(
      `INSERT INTO usuarios (id, nome, email, cpf, telefone, nascimento, senha_hash, criado_em, preferencias, consentimentos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(usuarioId, nome, mail, cpf, digitos(d.telefone), texto(d.nascimento, 10), hashSenha(d.senha), data, json({ dietas: [], avisos: !!d.marketing }), json(consentimentos));
    lancarGraos(usuarioId, bonus, 'Bônus de boas-vindas', 'celebration');
  });
  return { token: criarSessao(usuarioId), usuario: usuarioPublico(recarregar(usuarioId)) };
}

function entrar(identificador, senha) {
  const valor = texto(identificador, 200).toLowerCase();
  const cpf = digitos(identificador);
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ? OR (? <> \'\' AND cpf = ?)').get(valor, cpf.length === 11 ? cpf : '', cpf);
  // Mesma mensagem nos dois casos: não revela quais e-mails existem.
  if (!u || !confereSenha(senha, u.senha_hash)) throw new ErroNegocio('E-mail/CPF ou senha incorretos.', 401);
  return { token: criarSessao(u.id), usuario: usuarioPublico(u) };
}

function trocarSenha(u, atual, nova) {
  if (!confereSenha(atual, u.senha_hash)) throw new ErroNegocio('Senha atual incorreta.');
  if (!senhaForte(nova)) throw new ErroNegocio('A nova senha precisa de 8 caracteres, com letras e números.');
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(nova), u.id);
}

async function pedirRedefinicao(mail, siteUrl) {
  const u = db.prepare('SELECT id, nome, email FROM usuarios WHERE email = ?').get(texto(mail, 200).toLowerCase());
  if (!u) return; // resposta neutra
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + 3600000).toISOString();
  db.prepare('INSERT INTO redefinicoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)').run(sha256(token), u.id, expira);
  const link = siteUrl + '/html/login.html?redefinir=' + encodeURIComponent(token);
  await email.enviar({
    para: u.email,
    assunto: 'Santo Cacau — crie uma nova senha',
    texto: `Olá, ${u.nome.split(' ')[0]}!\n\nPara criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n${link}\n\nSe você não pediu, ignore este e-mail.\n\nSanto Cacau`,
  });
}

function redefinirSenha(token, nova) {
  if (!senhaForte(nova)) throw new ErroNegocio('A senha precisa de 8 caracteres, com letras e números.');
  const r = db.prepare('SELECT * FROM redefinicoes WHERE token_hash = ?').get(sha256(String(token || '')));
  if (!r || r.usado || r.expira_em < agora()) throw new ErroNegocio('Link inválido ou expirado. Peça um novo.');
  transacao(() => {
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(nova), r.usuario_id);
    db.prepare('UPDATE redefinicoes SET usado = 1 WHERE token_hash = ?').run(r.token_hash);
    // Por segurança, encerra as sessões abertas.
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(r.usuario_id);
  });
}

function atualizarPerfil(u, d) {
  const prefs = parse(u.preferencias, { dietas: [], avisos: false });
  const campos = {};
  if (d.nome !== undefined) {
    const nome = texto(d.nome, 120);
    if (nome.split(/\s+/).length < 2) throw new ErroNegocio('Informe nome e sobrenome.');
    campos.nome = nome;
  }
  if (d.telefone !== undefined) {
    if (digitos(d.telefone).length < 10) throw new ErroNegocio('Informe o celular com DDD.');
    campos.telefone = digitos(d.telefone);
  }
  if (Array.isArray(d.dietas)) {
    prefs.dietas = d.dietas.filter((x) => DATA.dietas.some((di) => di.id === x));
    campos.preferencias = json(prefs);
  }
  if (d.endereco) campos.enderecos = json([limparEndereco(d.endereco)]);
  const chaves = Object.keys(campos);
  if (chaves.length) {
    db.prepare('UPDATE usuarios SET ' + chaves.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?').run(...chaves.map((k) => campos[k]), u.id);
  }
  return usuarioPublico(recarregar(u.id));
}

function marketing(u, aceito) {
  const consent = parse(u.consentimentos, {});
  consent.marketing = { aceito: !!aceito, data: agora() };
  const prefs = parse(u.preferencias, {});
  prefs.avisos = !!aceito;
  db.prepare('UPDATE usuarios SET consentimentos = ?, preferencias = ? WHERE id = ?').run(json(consent), json(prefs), u.id);
  return usuarioPublico(recarregar(u.id));
}

function resgatar(u, recompensaId) {
  const rec = DATA.recompensas.find((r) => r.id === recompensaId);
  if (!rec) throw new ErroNegocio('Recompensa não encontrada.', 404);
  const codigo = 'R' + crypto.randomBytes(3).toString('hex').toUpperCase();
  transacao(() => {
    if (recarregar(u.id).graos < rec.graos) throw new ErroNegocio('Saldo de Grãos insuficiente.');
    lancarGraos(u.id, -rec.graos, 'Resgate: ' + rec.nome, 'redeem');
    db.prepare('INSERT INTO resgates (id, usuario_id, recompensa_id, nome, data, codigo) VALUES (?, ?, ?, ?, ?, ?)').run(id('G'), u.id, rec.id, rec.nome, agora(), codigo);
  });
  return { usuario: usuarioPublico(recarregar(u.id)), codigo };
}

function agendar(u, d) {
  const x = DATA.experiencias.find((e) => e.id === d.experienciaId);
  if (!x) throw new ErroNegocio('Experiência não encontrada.', 404);
  const boutique = DATA.boutiques.find((b) => b.nome === d.boutique || b.id === d.boutique);
  if (!boutique) throw new ErroNegocio('Escolha uma boutique.');
  const data = texto(d.data, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < amanha) throw new ErroNegocio('Escolha uma data a partir de amanhã.');
  const hora = texto(d.hora, 5);
  if (!['11:00', '15:00', '17:30'].includes(hora)) throw new ErroNegocio('Escolha um horário disponível.');
  transacao(() => {
    const atual = recarregar(u.id);
    if (catalogo.nivel(atual.graos_total).indice < catalogo.nivelIndice(x.nivelMin)) throw new ErroNegocio('Seu nível ainda não libera esta experiência.');
    if (atual.graos < x.graos) throw new ErroNegocio('Saldo de Grãos insuficiente.');
    if (x.graos) lancarGraos(u.id, -x.graos, 'Agendamento: ' + x.nome, 'event');
    db.prepare(
      'INSERT INTO agendamentos (id, usuario_id, experiencia, nome, boutique, data, hora, necessidades, graos, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id('A'), u.id, x.id, x.nome, boutique.nome, data, hora, texto(d.necessidades, 200), x.graos, agora());
  });
  return usuarioPublico(recarregar(u.id));
}

function cancelarAgendamento(u, agendamentoId) {
  transacao(() => {
    const ag = db.prepare('SELECT * FROM agendamentos WHERE id = ? AND usuario_id = ?').get(agendamentoId, u.id);
    if (!ag) throw new ErroNegocio('Agendamento não encontrado.', 404);
    db.prepare('DELETE FROM agendamentos WHERE id = ?').run(ag.id);
    if (ag.graos) lancarGraos(u.id, ag.graos, 'Estorno: ' + ag.nome, 'undo');
  });
  return usuarioPublico(recarregar(u.id));
}

// LGPD art. 18: acesso e portabilidade.
function exportar(u) {
  return {
    geradoEm: agora(),
    controlador: EMPRESA.razaoSocial + ' — CNPJ ' + EMPRESA.cnpj,
    encarregado: EMPRESA.encarregadoEmail,
    titular: usuarioPublico(u),
    pedidos: listarPedidos(u.id),
    contatos: db.prepare('SELECT protocolo, data, assunto, mensagem FROM contatos WHERE usuario_id = ?').all(u.id).map((c) => ({ ...c })),
  };
}

// LGPD art. 18, VI: elimina a conta; pedidos ficam sem dados pessoais (fiscal).
function excluirConta(u) {
  transacao(() => {
    const pedidos = db.prepare('SELECT id, dados FROM pedidos WHERE usuario_id = ?').all(u.id);
    for (const p of pedidos) {
      const dados = parse(p.dados, {});
      dados.cliente = { nome: 'Titular removido', email: null, cpf: null, telefone: null };
      if (dados.entrega && dados.entrega.endereco) dados.entrega.endereco = { cidade: dados.entrega.endereco.cidade, uf: dados.entrega.endereco.uf };
      dados.observacoes = '';
      db.prepare('UPDATE pedidos SET usuario_id = NULL, dados = ? WHERE id = ?').run(json(dados), p.id);
    }
    db.prepare('UPDATE contatos SET usuario_id = NULL, nome = ?, email = ? WHERE usuario_id = ?').run('Titular removido', '', u.id);
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(u.id);
  });
}

/* ---------- Pedidos ---------- */

function limparEndereco(e) {
  return {
    cep: texto(e.cep, 9),
    logradouro: texto(e.logradouro, 150),
    numero: texto(e.numero, 20),
    complemento: texto(e.complemento, 80),
    bairro: texto(e.bairro, 80),
    cidade: texto(e.cidade, 80),
    uf: texto(e.uf, 2).toUpperCase(),
  };
}

function pedidoPublico(linha, incluirToken) {
  const dados = parse(linha.dados, {});
  const pag = parse(linha.pagamento, {});
  delete pag.idExterno;
  const p = {
    id: linha.id,
    criadoEm: linha.criado_em,
    userId: linha.usuario_id,
    status: linha.status,
    ...dados,
    pagamento: pag,
    graosGanhos: linha.graos_ganhos,
  };
  if (incluirToken) p.token = linha.token;
  return p;
}

function listarPedidos(usuarioId) {
  return db.prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC').all(usuarioId).map((l) => pedidoPublico(l));
}

function buscarPedido(pedidoId, usuario, token) {
  const linha = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(String(pedidoId || ''));
  if (!linha) return null;
  const dono = usuario && linha.usuario_id === usuario.id;
  const comToken = token && token.length === linha.token.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(linha.token));
  return dono || comToken ? linha : null;
}

async function criarPedido(usuario, d, siteUrl) {
  const itensEntrada = Array.isArray(d.itens) ? d.itens.slice(0, 50) : [];
  const itens = itensEntrada
    .map((i) => ({ id: i.id, qtd: Math.max(1, Math.min(99, parseInt(i.qtd, 10) || 1)), presente: !!i.presente, produto: catalogo.produto(i.id) }))
    .filter((i) => i.produto);
  if (!itens.length) throw new ErroNegocio('Sua sacola está vazia.');

  const opts = d.opts || {};
  const metodo = d.pagamento && d.pagamento.metodo === 'cartao' ? 'cartao' : 'pix';
  const pedidosAnteriores = usuario ? db.prepare('SELECT COUNT(*) AS n FROM pedidos WHERE usuario_id = ?').get(usuario.id).n : 0;
  const user = usuario ? { graos: usuario.graos, graosTotal: usuario.graos_total } : null;
  const r = catalogo.calcular(itens, opts, user, pedidosAnteriores);
  if (r.avisos.length) throw new ErroNegocio(r.avisos[0].msg);
  if (r.total < 1) throw new ErroNegocio('Valor do pedido inválido.');

  // Cliente
  let cliente;
  if (usuario) {
    cliente = { nome: usuario.nome, email: usuario.email, cpf: usuario.cpf, telefone: usuario.telefone };
  } else {
    const c = d.cliente || {};
    cliente = { nome: texto(c.nome, 120), email: texto(c.email, 200).toLowerCase(), cpf: digitos(c.cpf), telefone: digitos(c.telefone) };
    if (cliente.nome.split(/\s+/).length < 2) throw new ErroNegocio('Informe nome e sobrenome.');
    if (!emailValido(cliente.email)) throw new ErroNegocio('Informe um e-mail válido.');
    if (!cpfValido(cliente.cpf)) throw new ErroNegocio('CPF inválido.');
    if (cliente.telefone.length < 10) throw new ErroNegocio('Informe o celular com DDD.');
  }

  // Entrega
  let endereco = null;
  if (r.entrega !== 'retirada') {
    endereco = limparEndereco(d.endereco || {});
    if (digitos(endereco.cep).length !== 8 || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !/^[A-Z]{2}$/.test(endereco.uf)) {
      throw new ErroNegocio('Endereço de entrega incompleto.');
    }
    if (r.entrega === 'expressa' && !catalogo.isCapitalSP(endereco.cep)) throw new ErroNegocio('A entrega expressa atende apenas a capital de São Paulo.');
  }
  if (itens.some((i) => i.produto.alcool) && !d.confirmaMaioridade) throw new ErroNegocio('Confirme que você tem 18 anos ou mais.');
  if (!d.aceiteTermos) throw new ErroNegocio('É preciso aceitar os termos para concluir.');

  const pedidoId = 'SC' + Date.now().toString().slice(-6) + crypto.randomBytes(2).toString('hex').toUpperCase();
  const token = crypto.randomBytes(24).toString('base64url');
  const dados = {
    cliente,
    entrega: { modo: r.entrega, nome: r.freteRegra.nome, prazo: r.freteRegra.prazo, endereco },
    itens: r.itens.map((i) => ({ id: i.id, nome: i.produto.nome, qtd: i.qtd, preco: i.produto.preco, presente: i.presente, img: i.produto.img })),
    valores: { subtotal: r.subtotal, embalagem: r.embalagem, frete: r.frete, descontoCupom: r.descontoCupom, descontoGraos: r.descontoGraos, total: r.total, parcelas: 1 },
    cupom: r.cupom ? r.cupom.codigo : null,
    observacoes: texto(d.observacoes, 300),
  };
  const graosResgatados = r.usarGraos ? DATA.regras.resgateGraos.graos : 0;

  // Grava o pedido e debita os Grãos usados antes de falar com o pagamento.
  transacao(() => {
    if (usuario && graosResgatados) {
      if (recarregar(usuario.id).graos < graosResgatados) throw new ErroNegocio('Saldo de Grãos insuficiente.');
      lancarGraos(usuario.id, -graosResgatados, 'Resgate no pedido #' + pedidoId, 'redeem');
    }
    db.prepare(
      `INSERT INTO pedidos (id, token, usuario_id, criado_em, atualizado_em, status, dados, pagamento, total, graos_ganhos, graos_resgatados)
       VALUES (?, ?, ?, ?, ?, 'aguardando', ?, ?, ?, ?, ?)`
    ).run(pedidoId, token, usuario ? usuario.id : null, agora(), agora(), json(dados), json({ metodo, provedor: pagamento.provedor }), r.total, usuario ? r.graosGanhos : 0, graosResgatados);
  });

  const urlRetorno = siteUrl + '/html/pedido.html?id=' + encodeURIComponent(pedidoId) + '&token=' + encodeURIComponent(token) + '&novo=1';
  let pag;
  try {
    pag =
      metodo === 'pix'
        ? await pagamento.criarPix({ id: pedidoId, total: r.total, cliente, itens: dados.itens })
        : await pagamento.criarCheckoutCartao({ id: pedidoId, total: r.total, cliente, itens: dados.itens }, urlRetorno, r.parcelas);
  } catch (erro) {
    console.error('[pagamento] %s', erro.message);
    atualizarStatus(pedidoId, 'cancelado');
    throw new ErroNegocio('Não foi possível iniciar o pagamento agora. Nenhum valor foi cobrado. Tente novamente em instantes.', 502);
  }
  db.prepare('UPDATE pedidos SET pagamento = ? WHERE id = ?').run(json(pag), pedidoId);

  // Cartão no modo simulado: aprovado na hora.
  if (metodo === 'cartao' && pagamento.provedor === 'simulado') atualizarStatus(pedidoId, 'pago');
  else {
    email.enviar({
      para: cliente.email,
      assunto: 'Santo Cacau — recebemos seu pedido #' + pedidoId,
      texto: `Olá, ${cliente.nome.split(' ')[0]}!\n\nRecebemos seu pedido #${pedidoId} no valor de R$ ${r.total.toFixed(2).replace('.', ',')}.\nAcompanhe em: ${urlRetorno.replace('&novo=1', '')}\n\nSanto Cacau`,
    });
  }

  const linha = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
  return {
    pedido: pedidoPublico(linha, true),
    pagamento: { checkoutUrl: pag.checkoutUrl },
    usuario: usuario ? usuarioPublico(recarregar(usuario.id)) : undefined,
  };
}

/**
 * Muda o status do pedido. Idempotente: Grãos são creditados uma única vez
 * no pagamento aprovado, e os Grãos usados voltam se o pagamento falhar.
 */
function atualizarStatus(pedidoId, status, extra) {
  let aprovado = false;
  transacao(() => {
    const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    if (!p) return;
    // Pedido pago não volta para "aguardando".
    if (p.status === 'pago' && status === 'aguardando') return;
    const pag = parse(p.pagamento, {});
    if (extra && extra.parcelas) {
      pag.parcelas = extra.parcelas;
      const dados = parse(p.dados, {});
      dados.valores.parcelas = extra.parcelas;
      db.prepare('UPDATE pedidos SET dados = ? WHERE id = ?').run(json(dados), p.id);
    }
    if (extra && extra.final) pag.final = extra.final;
    if (extra && extra.paymentId) pag.idExterno = extra.paymentId;
    db.prepare('UPDATE pedidos SET status = ?, pagamento = ?, atualizado_em = ? WHERE id = ?').run(status, json(pag), agora(), p.id);

    if (status === 'pago' && p.status !== 'pago') aprovado = true;
    if (status === 'pago' && p.usuario_id && p.graos_ganhos && !p.graos_creditados) {
      lancarGraos(p.usuario_id, p.graos_ganhos, 'Pedido #' + p.id, 'shopping_bag');
      db.prepare('UPDATE pedidos SET graos_creditados = 1 WHERE id = ?').run(p.id);
    }
    if (['recusado', 'cancelado', 'expirado'].includes(status) && p.usuario_id && p.graos_resgatados && !p.graos_estornados) {
      lancarGraos(p.usuario_id, p.graos_resgatados, 'Estorno do pedido #' + p.id, 'undo');
      db.prepare('UPDATE pedidos SET graos_estornados = 1 WHERE id = ?').run(p.id);
    }
  });
  if (aprovado) {
    const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const dados = parse(p.dados, {});
    email.enviar({
      para: dados.cliente && dados.cliente.email,
      assunto: 'Santo Cacau — pagamento aprovado (#' + p.id + ')',
      texto: `Pagamento do pedido #${p.id} aprovado! Seus chocolates já vão para o ateliê.\n\nSanto Cacau`,
    });
  }
}

// Consulta o Mercado Pago (no máximo a cada 10 s por pedido) enquanto aguarda.
async function sincronizar(linha) {
  if (linha.status !== 'aguardando' || pagamento.provedor === 'simulado') return linha;
  if (linha.consultado_em && Date.now() - new Date(linha.consultado_em).getTime() < 10000) return linha;
  db.prepare('UPDATE pedidos SET consultado_em = ? WHERE id = ?').run(agora(), linha.id);
  try {
    const info = await pagamento.consultarPedido(linha.id);
    if (info && info.status !== linha.status) atualizarStatus(linha.id, info.status, info);
    else if (!info && parse(linha.pagamento, {}).pix) expirarPixVencido(linha);
  } catch (erro) {
    console.error('[pagamento] consulta falhou: %s', erro.message);
  }
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(linha.id);
}

function expirarPixVencido(linha) {
  const pix = parse(linha.pagamento, {}).pix;
  if (pix && pix.expiraEm && new Date(pix.expiraEm).getTime() < Date.now() - 60000) atualizarStatus(linha.id, 'expirado');
}

// Webhook: busca o pagamento no Mercado Pago (não confia no corpo recebido).
async function processarWebhook(paymentId) {
  const info = await pagamento.consultarPagamento(paymentId);
  if (info && info.pedidoId) atualizarStatus(info.pedidoId, info.status, info);
  return info;
}

/* ---------- Contato ---------- */

async function registrarContato(usuario, d) {
  const dados = {
    nome: texto(d.nome, 120),
    email: texto(d.email, 200),
    assunto: texto(d.assunto, 80),
    pedido: texto(d.pedido, 30),
    mensagem: texto(d.mensagem, 2000),
    canal: texto(d.canal, 40) || 'E-mail',
  };
  if (!dados.nome) throw new ErroNegocio('Informe seu nome.');
  if (!emailValido(dados.email)) throw new ErroNegocio('Informe um e-mail válido.');
  if (!dados.assunto) throw new ErroNegocio('Escolha um assunto.');
  if (dados.mensagem.length < 10) throw new ErroNegocio('Escreva sua mensagem (mínimo de 10 caracteres).');
  const protocolo = 'AT' + Date.now().toString().slice(-6) + crypto.randomBytes(2).toString('hex').toUpperCase();
  db.prepare('INSERT INTO contatos (protocolo, data, usuario_id, nome, email, assunto, pedido, mensagem, canal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    protocolo, agora(), usuario ? usuario.id : null, dados.nome, dados.email, dados.assunto, dados.pedido, dados.mensagem, dados.canal
  );
  const destino = /LGPD/i.test(dados.assunto) ? EMPRESA.encarregadoEmail : EMPRESA.email;
  email.enviar({
    para: destino,
    assunto: `[${protocolo}] ${dados.assunto}`,
    texto: `Nome: ${dados.nome}\nE-mail: ${dados.email}\nPedido: ${dados.pedido || '-'}\nResposta preferida: ${dados.canal}\n\n${dados.mensagem}`,
  });
  return { protocolo };
}

module.exports = {
  ErroNegocio,
  usuarioDoToken,
  encerrarSessao,
  usuarioPublico,
  cadastrar,
  entrar,
  trocarSenha,
  pedirRedefinicao,
  redefinirSenha,
  atualizarPerfil,
  marketing,
  resgatar,
  agendar,
  cancelarAgendamento,
  exportar,
  excluirConta,
  listarPedidos,
  buscarPedido,
  pedidoPublico,
  criarPedido,
  atualizarStatus,
  sincronizar,
  processarWebhook,
  registrarContato,
};
