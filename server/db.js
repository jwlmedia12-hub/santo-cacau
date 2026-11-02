// Banco de dados com uma interface única para dois motores:
// - PostgreSQL (ex.: Supabase gratuito), quando DATABASE_URL está definida;
// - SQLite embutido no Node.js (padrão local, sem configurar nada).
//
// As consultas usam "?" como marcador; no PostgreSQL ele vira $1, $2...
// Uso: await db.get(sql, ...p), db.all(...), db.run(...), transacao(async (tx) => ...)
const fs = require('node:fs');
const path = require('node:path');

const urlPostgres = process.env.DATABASE_URL || '';
const motor = urlPostgres ? 'postgres' : 'sqlite';

// Tabelas. TIPO_ID e TIPO_DINHEIRO mudam conforme o motor.
function esquema(tipoId, tipoDinheiro) {
  return [
    `CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      cpf TEXT NOT NULL UNIQUE,
      telefone TEXT NOT NULL,
      nascimento TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      criado_em TEXT NOT NULL,
      graos INTEGER NOT NULL DEFAULT 0,
      graos_total INTEGER NOT NULL DEFAULT 0,
      preferencias TEXT NOT NULL DEFAULT '{}',
      consentimentos TEXT NOT NULL DEFAULT '{}',
      enderecos TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado_em TEXT NOT NULL,
      expira_em TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS redefinicoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira_em TEXT NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS extrato (
      id ${tipoId},
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      descricao TEXT NOT NULL,
      graos INTEGER NOT NULL,
      icone TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS resgates (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      recompensa_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      data TEXT NOT NULL,
      codigo TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agendamentos (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      experiencia TEXT NOT NULL,
      nome TEXT NOT NULL,
      boutique TEXT NOT NULL,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      necessidades TEXT NOT NULL DEFAULT '',
      graos INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL
    )`,
    // Pedidos não têm chave estrangeira para usuarios: ao excluir a conta,
    // o pedido continua guardado (exigência fiscal), mas anonimizado.
    `CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      usuario_id TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      status TEXT NOT NULL,
      dados TEXT NOT NULL,
      pagamento TEXT NOT NULL,
      total ${tipoDinheiro} NOT NULL,
      graos_ganhos INTEGER NOT NULL DEFAULT 0,
      graos_creditados INTEGER NOT NULL DEFAULT 0,
      graos_resgatados INTEGER NOT NULL DEFAULT 0,
      graos_estornados INTEGER NOT NULL DEFAULT 0,
      consultado_em TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS pedidos_usuario ON pedidos(usuario_id)`,
    `CREATE TABLE IF NOT EXISTS contatos (
      protocolo TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      usuario_id TEXT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      assunto TEXT NOT NULL,
      pedido TEXT,
      mensagem TEXT NOT NULL,
      canal TEXT NOT NULL
    )`,
  ];
}
const TABELAS = ['usuarios', 'sessoes', 'redefinicoes', 'extrato', 'resgates', 'agendamentos', 'pedidos', 'contatos'];

// Linhas sem protótipo especial e contagens como número.
const limpa = (linha) => (linha ? { ...linha } : linha);

/* ---------- PostgreSQL (Supabase) ---------- */

function criarPostgres() {
  const { Pool } = require('pg');
  // Schema próprio: fora do "public", que o Supabase expõe pela API REST.
  const SCHEMA = process.env.DB_SCHEMA || 'santo_cacau';
  const ssl = /localhost|127\.0\.0\.1/.test(urlPostgres)
    ? false
    : process.env.DB_SSL_CA
      ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') }
      : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: urlPostgres, ssl, max: Number(process.env.DB_POOL_MAX || 5) });
  pool.on('connect', (cliente) => cliente.query(`SET search_path TO ${SCHEMA}`));
  pool.on('error', (erro) => console.error('[banco] conexão perdida: %s', erro.message));

  const converte = (sql) => {
    let n = 0;
    return sql.replace(/\?/g, () => '$' + ++n);
  };
  const executor = (alvo) => ({
    get: async (sql, ...p) => limpa((await alvo.query(converte(sql), p)).rows[0]),
    all: async (sql, ...p) => (await alvo.query(converte(sql), p)).rows.map(limpa),
    run: async (sql, ...p) => {
      await alvo.query(converte(sql), p);
    },
  });

  return {
    ...executor(pool),
    async transacao(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await fn(executor(cliente));
        await cliente.query('COMMIT');
        return resultado;
      } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw erro;
      } finally {
        cliente.release();
      }
    },
    async iniciar() {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
      for (const sql of esquema('BIGSERIAL PRIMARY KEY', 'DOUBLE PRECISION')) await pool.query(sql);
      // RLS sem políticas: só o servidor (dono das tabelas) acessa os dados.
      for (const t of TABELAS) await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    },
    descricao: 'PostgreSQL (schema ' + SCHEMA + ')',
  };
}

/* ---------- SQLite (local) ---------- */

function criarSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const arquivo = process.env.DB_PATH || path.join(__dirname, 'dados', 'santo-cacau.db');
  if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const banco = new DatabaseSync(arquivo);
  // SQLite trava o arquivo inteiro na transação; "FOR UPDATE" não existe nele.
  const ajusta = (sql) => sql.replace(/\s+FOR UPDATE/gi, '');
  const executor = {
    get: async (sql, ...p) => limpa(banco.prepare(ajusta(sql)).get(...p)),
    all: async (sql, ...p) => banco.prepare(ajusta(sql)).all(...p).map(limpa),
    run: async (sql, ...p) => {
      banco.prepare(ajusta(sql)).run(...p);
    },
  };
  // Uma transação por vez (o SQLite só tem uma conexão).
  let fila = Promise.resolve();
  return {
    ...executor,
    transacao(fn) {
      const vez = fila.then(async () => {
        banco.exec('BEGIN IMMEDIATE');
        try {
          const resultado = await fn(executor);
          banco.exec('COMMIT');
          return resultado;
        } catch (erro) {
          banco.exec('ROLLBACK');
          throw erro;
        }
      });
      fila = vez.catch(() => {});
      return vez;
    },
    async iniciar() {
      banco.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      for (const sql of esquema('INTEGER PRIMARY KEY AUTOINCREMENT', 'REAL')) banco.exec(sql);
    },
    descricao: 'SQLite (' + arquivo + ')',
  };
}

const db = motor === 'postgres' ? criarPostgres() : criarSqlite();

module.exports = { db, transacao: (fn) => db.transacao(fn), iniciar: () => db.iniciar(), motor, descricao: db.descricao };
