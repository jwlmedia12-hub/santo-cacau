// Regras de negócio: contas, Grãos Dourados, pedidos e pagamentos.
// Toda alteração de saldo acontece aqui, dentro de transações; o saldo é
// travado (FOR UPDATE) para dois pedidos simultâneos não gastarem os mesmos Grãos.
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
async function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DIAS_SESSAO * 86400000).toISOString();
  await db.run('INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)', sha256(token), usuarioId, agora(), expira);
  return token;
}
async function usuarioDoToken(token) {
  if (!token) return null;
  const s = await db.get('SELECT usuario_id, expira_em FROM sessoes WHERE token_hash = ?', sha256(token));
  if (!s) return null;
  if (s.expira_em < agora()) {
    await db.run('DELETE FROM sessoes WHERE token_hash = ?', sha256(token));
    return null;
  }
  return (await db.get('SELECT * FROM usuarios WHERE id = ?', s.usuario_id)) || null;
}
async function encerrarSessao(token) {
  await db.run('DELETE FROM sessoes WHERE token_hash = ?', sha256(token || ''));
}

/* ---------- Usuário público (mesmo formato do site) ---------- */

async function usuarioPublico(u) {
  if (!u) return null;
  const [extrato, resgates, agendamentos, contagem] = await Promise.all([
    db.all('SELECT data, descricao, graos, icone FROM extrato WHERE usuario_id = ? ORDER BY id DESC LIMIT 50', u.id),
    db.all('SELECT recompensa_id AS id, nome, data, codigo FROM resgates WHERE usuario_id = ? ORDER BY data DESC', u.id),
    db.all('SELECT id, experiencia, nome, boutique, data, hora, necessidades, graos FROM agendamentos WHERE usuario_id = ? ORDER BY data, hora', u.id),
    db.get('SELECT COUNT(*) AS n FROM pedidos WHERE usuario_id = ?', u.id),
  ]);
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: u.cpf,
    telefone: u.telefone,
    nascimento: u.nascimento,
    criadoEm: u.criado_em,
    graos: Number(u.graos),
    graosTotal: Number(u.graos_total),
    extrato: extrato.map((e) => ({ ...e, graos: Number(e.graos) })),
    resgates,
    agendamentos: agendamentos.map((a) => ({ ...a, graos: Number(a.graos) })),
    enderecos: parse(u.enderecos, []),
    preferencias: parse(u.preferencias, { dietas: [], avisos: false }),
    consentimentos: parse(u.consentimentos, {}),
    pedidosCount: Number(contagem.n),
  };
}
const recarregar = (usuarioId, tx = db) => tx.get('SELECT * FROM usuarios WHERE id = ?', usuarioId);
// Lê o usuário travando a linha até o fim da transação.
const travar = (tx, usuarioId) => tx.get('SELECT * FROM usuarios WHERE id = ? FOR UPDATE', usuarioId);

async function lancarGraos(tx, usuarioId, graos, descricao, icone) {
  await tx.run('UPDATE usuarios SET graos = graos + ?, graos_total = graos_total + ? WHERE id = ?', graos, graos > 0 ? graos : 0, usuarioId);
  await tx.run('INSERT INTO extrato (usuario_id, data, descricao, graos, icone) VALUES (?, ?, ?, ?, ?)', usuarioId, agora(), descricao, graos, icone);
}

/* ---------- Conta ---------- */

async function cadastrar(d) {
  const nome = texto(d.nome, 120);
  const mail = texto(d.email, 200).toLowerCase();
  if (nome.split(/\s+/).length < 2) throw new ErroNegocio('Informe nome e sobrenome.');
  if (!emailValido(mail)) throw new ErroNegocio('Informe um e-mail válido.');
  if (!cpfValido(d.cpf)) throw new ErroNegocio('CPF inválido.');
  if (digitos(d.telefone).length < 10) throw new ErroNegocio('Informe o celular com DDD.');
  if (idade(d.nascimento) < 18) throw new ErroNegocio('O cadastro é permitido apenas para maiores de 18 anos.');
  if (!senhaForte(d.senha)) throw new ErroNegocio('A senha precisa de 8 caracteres, com letras e números.');
  const cpf = digitos(d.cpf);
  if (await db.get('SELECT 1 AS existe FROM usuarios WHERE email = ? OR cpf = ?', mail, cpf)) {
    throw new ErroNegocio('Já existe uma conta com este e-mail ou CPF.', 409);
  }
  const usuarioId = id('U');
  const data = agora();
  const consentimentos = {
    termos: { aceito: true, data, versao: EMPRESA.atualizacaoPoliticas },
    privacidade: { aceito: true, data, versao: EMPRESA.atualizacaoPoliticas },
    marketing: { aceito: !!d.marketing, data },
  };
  try {
    await transacao(async (tx) => {
      await tx.run(
        `INSERT INTO usuarios (id, nome, email, cpf, telefone, nascimento, senha_hash, criado_em, preferencias, consentimentos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        usuarioId, nome, mail, cpf, digitos(d.telefone), texto(d.nascimento, 10), hashSenha(d.senha), data,
        json({ dietas: [], avisos: !!d.marketing }), json(consentimentos)
      );
      await lancarGraos(tx, usuarioId, DATA.regras.bonusCadastro, 'Bônus de boas-vindas', 'celebration');
    });
  } catch (erro) {
    // Dois cadastros iguais ao mesmo tempo: o banco recusa o segundo.
    if (/unique|duplicate/i.test(erro.message)) throw new ErroNegocio('Já existe uma conta com este e-mail ou CPF.', 409);
    throw erro;
  }
  return { token: await criarSessao(usuarioId), usuario: await usuarioPublico(await recarregar(usuarioId)) };
}

async function entrar(identificador, senha) {
  const valor = texto(identificador, 200).toLowerCase();
  const cpf = digitos(identificador);
  const u = cpf.length === 11
    ? await db.get('SELECT * FROM usuarios WHERE email = ? OR cpf = ?', valor, cpf)
    : await db.get('SELECT * FROM usuarios WHERE email = ?', valor);
  // Mesma mensagem nos dois casos: não revela quais e-mails existem.
  if (!u || !confereSenha(senha, u.senha_hash)) throw new ErroNegocio('E-mail/CPF ou senha incorretos.', 401);
  return { token: await criarSessao(u.id), usuario: await usuarioPublico(u) };
}

async function trocarSenha(u, atual, nova) {
  if (!confereSenha(atual, u.senha_hash)) throw new ErroNegocio('Senha atual incorreta.');
  if (!senhaForte(nova)) throw new ErroNegocio('A nova senha precisa de 8 caracteres, com letras e números.');
  await db.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', hashSenha(nova), u.id);
}

async function pedirRedefinicao(mail, siteUrl) {
  const u = await db.get('SELECT id, nome, email FROM usuarios WHERE email = ?', texto(mail, 200).toLowerCase());
  if (!u) return; // resposta neutra
  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + 3600000).toISOString();
  await db.run('INSERT INTO redefinicoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)', sha256(token), u.id, expira);
  const link = siteUrl + '/html/login.html?redefinir=' + encodeURIComponent(token);
  await email.enviar({
    para: u.email,
    assunto: 'Santo Cacau — crie uma nova senha',
    texto: `Olá, ${u.nome.split(' ')[0]}!\n\nPara criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n${link}\n\nSe você não pediu, ignore este e-mail.\n\nSanto Cacau`,
  });
}

async function redefinirSenha(token, nova) {
  if (!senhaForte(nova)) throw new ErroNegocio('A senha precisa de 8 caracteres, com letras e números.');
  await transacao(async (tx) => {
    const r = await tx.get('SELECT * FROM redefinicoes WHERE token_hash = ? FOR UPDATE', sha256(String(token || '')));
    if (!r || Number(r.usado) || r.expira_em < agora()) throw new ErroNegocio('Link inválido ou expirado. Peça um novo.');
    await tx.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', hashSenha(nova), r.usuario_id);
    await tx.run('UPDATE redefinicoes SET usado = 1 WHERE token_hash = ?', r.token_hash);
    // Por segurança, encerra as sessões abertas.
    await tx.run('DELETE FROM sessoes WHERE usuario_id = ?', r.usuario_id);
  });
}

async function atualizarPerfil(u, d) {
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
    await db.run('UPDATE usuarios SET ' + chaves.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?', ...chaves.map((k) => campos[k]), u.id);
  }
  return usuarioPublico(await recarregar(u.id));
}

async function marketing(u, aceito) {
  const consent = parse(u.consentimentos, {});
  consent.marketing = { aceito: !!aceito, data: agora() };
  const prefs = parse(u.preferencias, {});
  prefs.avisos = !!aceito;
  await db.run('UPDATE usuarios SET consentimentos = ?, preferencias = ? WHERE id = ?', json(consent), json(prefs), u.id);
  return usuarioPublico(await recarregar(u.id));
}

async function resgatar(u, recompensaId) {
  const rec = DATA.recompensas.find((r) => r.id === recompensaId);
  if (!rec) throw new ErroNegocio('Recompensa não encontrada.', 404);
  const codigo = 'R' + crypto.randomBytes(3).toString('hex').toUpperCase();
  await transacao(async (tx) => {
    if (Number((await travar(tx, u.id)).graos) < rec.graos) throw new ErroNegocio('Saldo de Grãos insuficiente.');
    await lancarGraos(tx, u.id, -rec.graos, 'Resgate: ' + rec.nome, 'redeem');
    await tx.run('INSERT INTO resgates (id, usuario_id, recompensa_id, nome, data, codigo) VALUES (?, ?, ?, ?, ?, ?)', id('G'), u.id, rec.id, rec.nome, agora(), codigo);
  });
  return { usuario: await usuarioPublico(await recarregar(u.id)), codigo };
}

async function agendar(u, d) {
  const x = DATA.experiencias.find((e) => e.id === d.experienciaId);
  if (!x) throw new ErroNegocio('Experiência não encontrada.', 404);
  const boutique = DATA.boutiques.find((b) => b.nome === d.boutique || b.id === d.boutique);
  if (!boutique) throw new ErroNegocio('Escolha uma boutique.');
  const data = texto(d.data, 10);
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < amanha) throw new ErroNegocio('Escolha uma data a partir de amanhã.');
  const hora = texto(d.hora, 5);
  if (!['11:00', '15:00', '17:30'].includes(hora)) throw new ErroNegocio('Escolha um horário disponível.');
  await transacao(async (tx) => {
    const atual = await travar(tx, u.id);
    if (catalogo.nivel(Number(atual.graos_total)).indice < catalogo.nivelIndice(x.nivelMin)) throw new ErroNegocio('Seu nível ainda não libera esta experiência.');
    if (Number(atual.graos) < x.graos) throw new ErroNegocio('Saldo de Grãos insuficiente.');
    if (x.graos) await lancarGraos(tx, u.id, -x.graos, 'Agendamento: ' + x.nome, 'event');
    await tx.run(
      'INSERT INTO agendamentos (id, usuario_id, experiencia, nome, boutique, data, hora, necessidades, graos, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id('A'), u.id, x.id, x.nome, boutique.nome, data, hora, texto(d.necessidades, 200), x.graos, agora()
    );
  });
  return usuarioPublico(await recarregar(u.id));
}

async function cancelarAgendamento(u, agendamentoId) {
  await transacao(async (tx) => {
    const ag = await tx.get('SELECT * FROM agendamentos WHERE id = ? AND usuario_id = ? FOR UPDATE', agendamentoId, u.id);
    if (!ag) throw new ErroNegocio('Agendamento não encontrado.', 404);
    await tx.run('DELETE FROM agendamentos WHERE id = ?', ag.id);
    if (Number(ag.graos)) await lancarGraos(tx, u.id, Number(ag.graos), 'Estorno: ' + ag.nome, 'undo');
  });
  return usuarioPublico(await recarregar(u.id));
}

// LGPD art. 18: acesso e portabilidade.
async function exportar(u) {
  return {
    geradoEm: agora(),
    controlador: EMPRESA.razaoSocial + ' — CNPJ ' + EMPRESA.cnpj,
    encarregado: EMPRESA.encarregadoEmail,
    titular: await usuarioPublico(u),
    pedidos: await listarPedidos(u.id),
    contatos: await db.all('SELECT protocolo, data, assunto, mensagem FROM contatos WHERE usuario_id = ?', u.id),
  };
}

// LGPD art. 18, VI: elimina a conta; pedidos ficam sem dados pessoais (fiscal).
async function excluirConta(u) {
  await transacao(async (tx) => {
    const pedidos = await tx.all('SELECT id, dados FROM pedidos WHERE usuario_id = ?', u.id);
    for (const p of pedidos) {
      const dados = parse(p.dados, {});
      dados.cliente = { nome: 'Titular removido', email: null, cpf: null, telefone: null };
      if (dados.entrega && dados.entrega.endereco) dados.entrega.endereco = { cidade: dados.entrega.endereco.cidade, uf: dados.entrega.endereco.uf };
      dados.observacoes = '';
      await tx.run('UPDATE pedidos SET usuario_id = NULL, dados = ? WHERE id = ?', json(dados), p.id);
    }
    await tx.run('UPDATE contatos SET usuario_id = NULL, nome = ?, email = ? WHERE usuario_id = ?', 'Titular removido', '', u.id);
    await tx.run('DELETE FROM usuarios WHERE id = ?', u.id);
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
    graosGanhos: Number(linha.graos_ganhos),
  };
  if (incluirToken) p.token = linha.token;
  return p;
}

async function listarPedidos(usuarioId) {
  return (await db.all('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC', usuarioId)).map((l) => pedidoPublico(l));
}

const buscarLinha = (pedidoId, tx = db) => tx.get('SELECT * FROM pedidos WHERE id = ?', String(pedidoId || ''));

async function buscarPedido(pedidoId, usuario, token) {
  const linha = await buscarLinha(pedidoId);
  if (!linha) return null;
  const dono = usuario && linha.usuario_id === usuario.id;
  const comToken = typeof token === 'string' && token.length === linha.token.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(linha.token));
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
  const pedidosAnteriores = usuario ? Number((await db.get('SELECT COUNT(*) AS n FROM pedidos WHERE usuario_id = ?', usuario.id)).n) : 0;
  const user = usuario ? { graos: Number(usuario.graos), graosTotal: Number(usuario.graos_total) } : null;
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
  await transacao(async (tx) => {
    if (usuario && graosResgatados) {
      if (Number((await travar(tx, usuario.id)).graos) < graosResgatados) throw new ErroNegocio('Saldo de Grãos insuficiente.');
      await lancarGraos(tx, usuario.id, -graosResgatados, 'Resgate no pedido #' + pedidoId, 'redeem');
    }
    await tx.run(
      `INSERT INTO pedidos (id, token, usuario_id, criado_em, atualizado_em, status, dados, pagamento, total, graos_ganhos, graos_resgatados)
       VALUES (?, ?, ?, ?, ?, 'aguardando', ?, ?, ?, ?, ?)`,
      pedidoId, token, usuario ? usuario.id : null, agora(), agora(), json(dados), json({ metodo, provedor: pagamento.provedor }), r.total,
      usuario ? r.graosGanhos : 0, graosResgatados
    );
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
    await atualizarStatus(pedidoId, 'cancelado');
    throw new ErroNegocio('Não foi possível iniciar o pagamento agora. Nenhum valor foi cobrado. Tente novamente em instantes.', 502);
  }
  await db.run('UPDATE pedidos SET pagamento = ? WHERE id = ?', json(pag), pedidoId);

  // Cartão no modo simulado: aprovado na hora.
  if (metodo === 'cartao' && pagamento.provedor === 'simulado') await atualizarStatus(pedidoId, 'pago');
  else {
    email.enviar({
      para: cliente.email,
      assunto: 'Santo Cacau — recebemos seu pedido #' + pedidoId,
      texto: `Olá, ${cliente.nome.split(' ')[0]}!\n\nRecebemos seu pedido #${pedidoId} no valor de R$ ${r.total.toFixed(2).replace('.', ',')}.\nAcompanhe em: ${urlRetorno.replace('&novo=1', '')}\n\nSanto Cacau`,
    });
  }

  return {
    pedido: pedidoPublico(await buscarLinha(pedidoId), true),
    pagamento: { checkoutUrl: pag.checkoutUrl },
    usuario: usuario ? await usuarioPublico(await recarregar(usuario.id)) : undefined,
  };
}

/**
 * Muda o status do pedido. Idempotente: Grãos são creditados uma única vez
 * no pagamento aprovado, e os Grãos usados voltam se o pagamento falhar.
 */
async function atualizarStatus(pedidoId, status, extra) {
  let aprovado = false;
  await transacao(async (tx) => {
    const p = await tx.get('SELECT * FROM pedidos WHERE id = ? FOR UPDATE', pedidoId);
    if (!p) return;
    // Pedido pago não volta para "aguardando".
    if (p.status === 'pago' && status === 'aguardando') return;
    const pag = parse(p.pagamento, {});
    const dados = parse(p.dados, {});
    if (extra && extra.parcelas) {
      pag.parcelas = extra.parcelas;
      dados.valores.parcelas = extra.parcelas;
    }
    if (extra && extra.final) pag.final = extra.final;
    if (extra && extra.paymentId) pag.idExterno = extra.paymentId;
    await tx.run('UPDATE pedidos SET status = ?, pagamento = ?, dados = ?, atualizado_em = ? WHERE id = ?', status, json(pag), json(dados), agora(), p.id);

    if (status === 'pago' && p.status !== 'pago') aprovado = true;
    if (status === 'pago' && p.usuario_id && Number(p.graos_ganhos) && !Number(p.graos_creditados)) {
      await lancarGraos(tx, p.usuario_id, Number(p.graos_ganhos), 'Pedido #' + p.id, 'shopping_bag');
      await tx.run('UPDATE pedidos SET graos_creditados = 1 WHERE id = ?', p.id);
    }
    if (['recusado', 'cancelado', 'expirado'].includes(status) && p.usuario_id && Number(p.graos_resgatados) && !Number(p.graos_estornados)) {
      await lancarGraos(tx, p.usuario_id, Number(p.graos_resgatados), 'Estorno do pedido #' + p.id, 'undo');
      await tx.run('UPDATE pedidos SET graos_estornados = 1 WHERE id = ?', p.id);
    }
  });
  if (aprovado) {
    const dados = parse((await buscarLinha(pedidoId)).dados, {});
    email.enviar({
      para: dados.cliente && dados.cliente.email,
      assunto: 'Santo Cacau — pagamento aprovado (#' + pedidoId + ')',
      texto: `Pagamento do pedido #${pedidoId} aprovado! Seus chocolates já vão para o ateliê.\n\nSanto Cacau`,
    });
  }
}

// Consulta o Mercado Pago (no máximo a cada 10 s por pedido) enquanto aguarda.
async function sincronizar(linha) {
  if (linha.status !== 'aguardando' || pagamento.provedor === 'simulado') return linha;
  if (linha.consultado_em && Date.now() - new Date(linha.consultado_em).getTime() < 10000) return linha;
  await db.run('UPDATE pedidos SET consultado_em = ? WHERE id = ?', agora(), linha.id);
  try {
    const info = await pagamento.consultarPedido(linha.id);
    if (info && info.status !== linha.status) await atualizarStatus(linha.id, info.status, info);
    else if (!info) await expirarPixVencido(linha);
  } catch (erro) {
    console.error('[pagamento] consulta falhou: %s', erro.message);
  }
  return buscarLinha(linha.id);
}

async function expirarPixVencido(linha) {
  const pix = parse(linha.pagamento, {}).pix;
  if (pix && pix.expiraEm && new Date(pix.expiraEm).getTime() < Date.now() - 60000) await atualizarStatus(linha.id, 'expirado');
}

// Webhook: busca o pagamento no Mercado Pago (não confia no corpo recebido).
async function processarWebhook(paymentId) {
  const info = await pagamento.consultarPagamento(paymentId);
  if (info && info.pedidoId) await atualizarStatus(info.pedidoId, info.status, info);
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
  await db.run(
    'INSERT INTO contatos (protocolo, data, usuario_id, nome, email, assunto, pedido, mensagem, canal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
