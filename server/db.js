// Banco de dados SQLite (embutido no Node.js 22.13+, sem dependências).
// O arquivo fica em DB_PATH (padrão: server/dados/santo-cacau.db).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const arquivo = process.env.DB_PATH || path.join(__dirname, 'dados', 'santo-cacau.db');
if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(arquivo), { recursive: true });

const db = new DatabaseSync(arquivo);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
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
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL,
    expira_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS redefinicoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_em TEXT NOT NULL,
    usado INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS extrato (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    descricao TEXT NOT NULL,
    graos INTEGER NOT NULL,
    icone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resgates (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    recompensa_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    data TEXT NOT NULL,
    codigo TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
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
  );

  -- Pedidos não têm chave estrangeira para usuarios: ao excluir a conta,
  -- o pedido continua guardado (exigência fiscal), mas anonimizado.
  CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    usuario_id TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    status TEXT NOT NULL,
    dados TEXT NOT NULL,
    pagamento TEXT NOT NULL,
    total REAL NOT NULL,
    graos_ganhos INTEGER NOT NULL DEFAULT 0,
    graos_creditados INTEGER NOT NULL DEFAULT 0,
    graos_resgatados INTEGER NOT NULL DEFAULT 0,
    graos_estornados INTEGER NOT NULL DEFAULT 0,
    consultado_em TEXT
  );
  CREATE INDEX IF NOT EXISTS pedidos_usuario ON pedidos(usuario_id);

  CREATE TABLE IF NOT EXISTS contatos (
    protocolo TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    usuario_id TEXT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    assunto TEXT NOT NULL,
    pedido TEXT,
    mensagem TEXT NOT NULL,
    canal TEXT NOT NULL
  );
`);

// Executa várias operações como uma só (tudo ou nada).
function transacao(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

module.exports = { db, transacao, arquivo };
