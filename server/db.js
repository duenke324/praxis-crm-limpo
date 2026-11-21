// Praxis CRM — base de dados (SQLite nativo do Node.js)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_FILE = path.join(DATA_DIR, 'praxis.db');

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// ---------- utilitários ----------
const pad = (n) => String(n).padStart(2, '0');
export function fmtDateTime(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function fmtDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const now = () => fmtDateTime();
export const today = () => fmtDate();
export function addDays(dateStr, days) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}
export function addYears(dateStr, years) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  d.setFullYear(d.getFullYear() + years);
  return fmtDate(d);
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const h = crypto.scryptSync(String(pw), salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
}
export function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// Validação do NIF português (dígito de controlo)
export function validNif(nif) {
  const s = String(nif || '').trim();
  if (!/^\d{9}$/.test(s)) return false;
  if (!'1235689'.includes(s[0]) && !['45', '70', '71', '72', '74', '75', '77', '79', '90', '91', '98', '99'].includes(s.slice(0, 2))) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(s[i]) * (9 - i);
  const r = sum % 11;
  const check = r < 2 ? 0 : 11 - r;
  return check === Number(s[8]);
}

// Gera o próximo número sequencial com base num contador persistido
export function nextSeq(name, start) {
  db.prepare('INSERT OR IGNORE INTO counters(name, value) VALUES (?, ?)').run(name, start);
  db.prepare('UPDATE counters SET value = value + 1 WHERE name = ?').run(name);
  return db.prepare('SELECT value FROM counters WHERE name = ?').get(name).value;
}

// ---------- esquema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin','direcao','admin','supervisor','agente')),
  team TEXT,
  job_title TEXT,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  agent_status TEXT NOT NULL DEFAULT 'Indisponível',
  created_at TEXT NOT NULL,
  created_by INTEGER,
  last_login TEXT,
  last_seen TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  nif TEXT UNIQUE,
  birth_date TEXT,
  gender TEXT,
  marital_status TEXT,
  profession TEXT,
  activity TEXT,
  employees INTEGER,
  driver_license TEXT,
  license_date TEXT,
  eni INTEGER NOT NULL DEFAULT 0,
  gestual INTEGER NOT NULL DEFAULT 0,
  death_date TEXT,
  brand TEXT NOT NULL DEFAULT 'OK! teleseguros',
  digital INTEGER NOT NULL DEFAULT 0,
  registered INTEGER NOT NULL DEFAULT 0,
  register_channel TEXT,
  register_email TEXT,
  area_email TEXT,
  last_login_area TEXT,
  last_login_app TEXT,
  digital_docs_at TEXT,
  cisa_by_mail INTEGER NOT NULL DEFAULT 0,
  cisa_updated_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Residência',
  description TEXT NOT NULL,
  postal_code TEXT,
  city TEXT,
  main INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Telemóvel','Telefone','Email')),
  value TEXT NOT NULL,
  main INTEGER NOT NULL DEFAULT 0,
  schedule TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  plate TEXT,
  driver_name TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  product TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Em Vigor',
  annual_value REAL NOT NULL DEFAULT 0,
  protocol TEXT,
  campaign TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  start_date TEXT NOT NULL,
  accepted_at TEXT,
  accepted_via TEXT,
  last_sent_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  product TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  plate TEXT,
  protocol TEXT,
  campaign TEXT,
  premium REAL NOT NULL DEFAULT 0,
  family INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'Praxis',
  policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  edited_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  branch TEXT NOT NULL,
  plate TEXT,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aberto',
  type TEXT NOT NULL,
  responsibility TEXT NOT NULL DEFAULT 'Por apurar',
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  branch TEXT,
  type TEXT NOT NULL,
  context TEXT,
  filename TEXT NOT NULL,
  channel TEXT,
  origin TEXT NOT NULL DEFAULT 'Praxis',
  created_at TEXT NOT NULL,
  last_print TEXT,
  retained INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS processes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  branch TEXT,
  process_type TEXT NOT NULL,
  task TEXT NOT NULL,
  task_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aberto',
  priority TEXT NOT NULL DEFAULT 'Normal',
  notes TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'Enviada',
  recipient TEXT,
  subject TEXT,
  body TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Aceite','Recusado','Pendente')),
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (client_id, type)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS call_closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_id INTEGER REFERENCES access_log(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  origin TEXT,
  subjects TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS client_campaigns (
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  protocol TEXT,
  PRIMARY KEY (client_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  scheduled_at TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'Por agendar',
  result TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  method TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups (
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, value)
);

CREATE INDEX IF NOT EXISTS ix_policies_client ON policies(client_id);
CREATE INDEX IF NOT EXISTS ix_policies_plate ON policies(plate);
CREATE INDEX IF NOT EXISTS ix_terms_policy ON policy_terms(policy_id);
CREATE INDEX IF NOT EXISTS ix_contacts_value ON contacts(value);
CREATE INDEX IF NOT EXISTS ix_audit_created ON audit(created_at);
CREATE INDEX IF NOT EXISTS ix_access_client ON access_log(client_id);
CREATE INDEX IF NOT EXISTS ix_closures_client ON call_closures(client_id);
CREATE INDEX IF NOT EXISTS ix_closures_created ON call_closures(created_at);
CREATE INDEX IF NOT EXISTS ix_processes_status ON processes(status);
`);

// ---------- migrações (acrescenta colunas a bases de dados de versões anteriores) ----------
function addColumn(table, col, def) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
// Perfis "direcao" e "superadmin" (acesso total): a tabela users antiga só aceitava admin/supervisor/agente,
// por isso é reconstruída (mantendo todos os utilizadores e ids) — procedimento recomendado pelo SQLite
(function migrateUserRoles() {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()?.sql || '';
  if (sql.includes('superadmin')) return;
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin','direcao','admin','supervisor','agente')),
  team TEXT,
  job_title TEXT,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  agent_status TEXT NOT NULL DEFAULT 'Indisponível',
  created_at TEXT NOT NULL,
  created_by INTEGER,
  last_login TEXT,
  last_seen TEXT
    )`);
    db.exec(`INSERT INTO users_new (id, username, name, email, role, team, password_hash, active, must_change_password, agent_status, created_at, created_by, last_login, last_seen)
      SELECT id, username, name, email, role, team, password_hash, active, must_change_password, agent_status, created_at, created_by, last_login, last_seen FROM users`);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.exec('PRAGMA foreign_keys = ON'); }
})();

// Simulações do tarifador ok! auto: dados introduzidos, plano e decomposição do preço (JSON)
addColumn('simulations', 'details', 'TEXT');
// Produtos Automóvel antigos passam para os planos ok! auto (corre uma vez)
(function migrateAutoProducts() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'okauto-products-v1'").get()) return;
  const map = { 'Responsabilidade Civil': 'ok! auto simple', 'DP Base': 'ok! auto safe', 'DP Essencial': 'ok! auto smart', 'Danos Próprios Total': 'ok! auto premium' };
  db.exec('BEGIN');
  try {
    for (const [from, to] of Object.entries(map)) {
      db.prepare("UPDATE policies SET product = ? WHERE branch = 'Automóvel' AND product = ?").run(to, from);
      db.prepare("UPDATE simulations SET product = ? WHERE branch = 'Automóvel' AND product = ?").run(to, from);
    }
    db.prepare("INSERT OR IGNORE INTO counters (name, value) VALUES ('okauto-products-v1', 1)").run();
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
})();

// Permissão de conceder o perfil "Acesso total" (só quem a tem pode dar/tirar esse perfil e esta permissão)
addColumn('users', 'can_grant_top', 'INTEGER NOT NULL DEFAULT 0');

// Dados da apólice
addColumn('policies', 'formalized_at', 'TEXT');
addColumn('policies', 'mediation_account', 'TEXT');
addColumn('policies', 'bonus_table', 'TEXT');
addColumn('policies', 'collection_account', 'TEXT');
addColumn('policies', 'iban', 'TEXT');
addColumn('policies', 'renewal_term', 'INTEGER NOT NULL DEFAULT 12');
addColumn('policies', 'renewal_mode', "TEXT NOT NULL DEFAULT 'Automático'");
addColumn('policies', 'no_renew', 'TEXT');
addColumn('policies', 'fractioning', "TEXT NOT NULL DEFAULT 'Anual'");
addColumn('policies', 'channel', 'TEXT');
addColumn('policies', 'info_source', 'TEXT');
// Alteração de apólice: condutor, veículo, desconto, bónus/malus, versão de tarifa
addColumn('policies', 'driver_birth_date', 'TEXT');
addColumn('policies', 'driver_license', 'TEXT');
addColumn('policies', 'driver_license_date', 'TEXT');
addColumn('policies', 'vehicle_make', 'TEXT');
addColumn('policies', 'vehicle_model', 'TEXT');
addColumn('policies', 'vehicle_version', 'TEXT');
addColumn('policies', 'vehicle_first_reg', 'TEXT');
addColumn('policies', 'vehicle_use', 'TEXT');
addColumn('policies', 'vehicle_value', 'REAL');
addColumn('policies', 'commercial_discount', 'REAL NOT NULL DEFAULT 0');
addColumn('policies', 'bonus_malus', 'INTEGER NOT NULL DEFAULT 0');
addColumn('policies', 'tariff_version', 'TEXT');
addColumn('policy_terms', 'subscription_code', 'TEXT');
addColumn('policy_terms', 'premium_before', 'REAL');
addColumn('policy_terms', 'premium_after', 'REAL');
// Fatura-recibo (numeração própria, atribuída quando o recibo é pago)
addColumn('payments', 'invoice_number', 'TEXT');
addColumn('payments', 'invoice_issued_at', 'TEXT');
// Comentários: tipo, fixado, edição e apólice relacionada
addColumn('comments', 'category', "TEXT NOT NULL DEFAULT 'Nota'");
addColumn('comments', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
addColumn('comments', 'policy_number', 'TEXT');
addColumn('comments', 'edited_at', 'TEXT');
addColumn('comments', 'edited_by', 'TEXT');
export const COMMENT_CATEGORIES = ['Nota', 'Contacto', 'Pedido', 'Reclamação', 'Alerta'];
// Anulação / não renovação
addColumn('policies', 'cancel_date', 'TEXT');
addColumn('policies', 'cancel_mode', 'TEXT');
addColumn('policies', 'cancel_refund_type', 'TEXT');
addColumn('policies', 'cancel_scheduled_date', 'TEXT');
addColumn('policies', 'cancel_notes', 'TEXT');
addColumn('policies', 'cancelled_by', 'TEXT');
// Suspensão de cobertura por falta de pagamento (recibo em atraso há mais de 1 mês e 10 dias)
addColumn('policies', 'suspended_at', 'TEXT');
addColumn('policies', 'suspended_reason', 'TEXT');

// Motivos de anulação, agrupados (o 1.º passo do painel mostra-os em caixas)
// proof: comprovativo a pedir ao cliente · imm: sugere anulação imediata · nr: sugere não renovação · notes: obriga a observações
export const CANCEL_REASONS = [
  { group: 'Dados do veículo', icon: 'car', branches: ['Automóvel'], items: [
    { r: 'Venda do veículo', proof: 'Declaração de venda ou registo de propriedade do novo dono', imm: true },
    { r: 'Abate / desmantelamento do veículo', proof: 'Certificado de destruição ou desmantelamento', imm: true },
    { r: 'Furto ou roubo do veículo', proof: 'Auto de denúncia às autoridades', imm: true },
    { r: 'Perda total em sinistro', imm: true },
    { r: 'Cancelamento de matrícula / exportação', proof: 'Comprovativo do cancelamento da matrícula', imm: true },
  ] },
  { group: 'Bem seguro', icon: 'home', branches: ['Multirriscos Habitação'], items: [
    { r: 'Venda do bem seguro', proof: 'Escritura ou contrato de compra e venda', imm: true },
    { r: 'Fim do contrato de arrendamento', proof: 'Comprovativo do fim do contrato', imm: true },
  ] },
  { group: 'Pedido do cliente', icon: 'user', items: [
    { r: 'Pedido do cliente' },
    { r: 'Transferência para outra seguradora' },
    { r: 'Insatisfação com o preço', nr: true },
    { r: 'Óbito do tomador', proof: 'Certidão de óbito', imm: true },
    { r: 'Mudança de residência para o estrangeiro', proof: 'Comprovativo de residência no estrangeiro' },
  ] },
  { group: 'Seguradora / cobrança', icon: 'euro', items: [
    { r: 'Falta de pagamento', imm: true },
    { r: 'Sinistralidade elevada', nr: true },
    { r: 'Falsas declarações', imm: true },
    { r: 'Decisão da seguradora', nr: true },
  ] },
  { group: 'Outro', icon: 'help', items: [{ r: 'Outro motivo', notes: true }] },
];
export const cancelReasonsFor = (branch) => CANCEL_REASONS.filter((g) => !g.branches || g.branches.includes(branch));
export const findCancelReason = (branch, r) => cancelReasonsFor(branch).flatMap((g) => g.items).find((x) => x.r === r);

export const TARIFF_VERSION = 'v21.03';

export const POLICY_OPTIONS = {
  fractioning: ['Anual', 'Semestral', 'Trimestral', 'Mensal'],
  renewalMode: ['Automático', 'Manual'],
  noRenew: ['Pedido do cliente', 'Transferência para outra seguradora', 'Insatisfação com o preço', 'Sinistralidade elevada', 'Decisão da seguradora', 'Falta de pagamento',
    'Venda do veículo', 'Venda do bem seguro', 'Mudança de residência para o estrangeiro', 'Outro motivo'],
  collection: ['430035 - EFT', '430036 - Multibanco', '430037 - Cartão de Crédito', '430038 - MB WAY'],
  channel: ['Portal Ok!', 'Telefone', 'APP', 'Site Via Directa', 'Parceiro'],
  infoSource: ['Recomendação', 'Pesquisa na Internet', 'Comparador', 'Publicidade TV / Rádio', 'Redes Sociais', 'Cliente anterior'],
  bonusTables: ['TBM001', 'TBM002', 'TBM003'],
  termsAccept: ['Área de Cliente', 'Gravação de chamada', 'Email', 'Assinatura digital'],
  vehicleUse: ['Particular', 'Profissional'],
  alterationKinds: ['Alteração', 'Correcção'],
};
export const FRACTION_N = { Anual: 1, Semestral: 2, Trimestral: 4, Mensal: 12 };
export const MEDIATION_ACCOUNT = '411101';

// IBAN: validação mod 97 (ISO 13616) e geração de IBAN PT fictício mas válido
const mod97 = (digits) => { let m = 0; for (const ch of digits) m = (m * 10 + Number(ch)) % 97; return m; };
const ibanDigits = (s) => s.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
export function normIban(v) { return String(v || '').replace(/\s+/g, '').toUpperCase(); }
export function validIban(v) {
  const s = normIban(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  if (s.startsWith('PT') && s.length !== 25) return false;
  return mod97(ibanDigits(s.slice(4) + s.slice(0, 4))) === 1;
}
function makeIbanPT(rand) {
  const bank = ['0033', '0035', '0007', '0010', '0018', '0036', '0269'][Math.floor(rand() * 7)];
  let body = bank;
  while (body.length < 19) body += Math.floor(rand() * 10);
  const nib = body + String(98 - mod97(body + '00')).padStart(2, '0');
  const check = 98 - mod97(ibanDigits(nib + 'PT00'));
  return 'PT' + String(check).padStart(2, '0') + nib;
}

// Assuntos possíveis da chamada, pedidos ao fechar a ficha de cliente (agrupados)
export const CALL_SUBJECTS = [
  ['Simulações e vendas', ['Pedido de simulação', 'Contratação de seguro', 'Esclarecimento de proposta']],
  ['Apólices', ['Alteração de dados pessoais', 'Alteração de apólice / coberturas', 'Renovação', 'Anulação de apólice', 'Pedido de documentos (carta verde, certificados)']],
  ['Sinistros', ['Participação de sinistro', 'Acompanhamento de sinistro', 'Assistência em viagem / reboque', 'Vistoria']],
  ['Pagamentos', ['Pagamentos e recibos', 'Alteração da forma de pagamento', 'Reembolso / estorno']],
  ['Outros', ['Acesso à área de cliente / password', 'Consentimentos / RGPD', 'Reclamação', 'Pedido de informação geral', 'Chamada sem efeito / engano', 'Outro']],
];
export const CALL_SUBJECT_LIST = CALL_SUBJECTS.flatMap(([, list]) => list);

export const CONSENT_TYPES = ['Acompanhamento Comercial', 'Consentimento Marketing VD', 'Consentimento Saúde'];

export const PRODUCTS = {
  // planos ok! auto — prémio anual de referência (exemplos publicados em okteleseguros.pt; o preço real vem do tarifador server/okauto.js)
  'Automóvel': { 'ok! auto simple': 139.56, 'ok! auto safe': 168.24, 'ok! auto smart': 206.28, 'ok! auto care': 381.72, 'ok! auto premium': 349.56 },
  'Multirriscos Habitação': { 'Casa Base': 120, 'Casa Plus': 210 },
  'Acidentes Pessoais': { 'AP Individual': 85, 'AP Família': 160 },
  'Saúde': { 'Saúde Essencial': 240, 'Saúde Plus': 420 },
};
export const BRANCHES = Object.keys(PRODUCTS);

export function computePremium(branch, product, client) {
  const base = PRODUCTS[branch]?.[product];
  if (base == null) return null;
  let factor = 1;
  if (client?.birth_date) {
    const age = (Date.now() - new Date(client.birth_date + 'T00:00:00')) / (365.25 * 864e5);
    if (branch === 'Automóvel') factor *= age < 25 ? 1.6 : age > 70 ? 1.25 : 1;
    if (branch === 'Saúde') factor *= age > 60 ? 1.45 : age > 45 ? 1.2 : 1;
  }
  if (branch === 'Automóvel' && client?.license_date) {
    const yrs = (Date.now() - new Date(client.license_date + 'T00:00:00')) / (365.25 * 864e5);
    if (yrs < 3) factor *= 1.3; else if (yrs > 10) factor *= 0.92;
  }
  return Math.round(base * factor * 100) / 100;
}

// ---------- dados de demonstração (fictícios) ----------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNif(rand) {
  const d = [rand() < 0.5 ? 1 : 2];
  for (let i = 1; i < 8; i++) d.push(Math.floor(rand() * 10));
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += d[i] * (9 - i);
  const r = sum % 11;
  d.push(r < 2 ? 0 : 11 - r);
  return d.join('');
}

export function seedDemo() {
  const rand = mulberry32(20261118);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const ts = now();

  const first = { F: ['Ana', 'Beatriz', 'Carla', 'Daniela', 'Inês', 'Joana', 'Leonor', 'Mariana', 'Rita', 'Sofia', 'Teresa', 'Helena', 'Catarina', 'Patrícia'],
                  M: ['André', 'Bruno', 'Carlos', 'Diogo', 'Eduardo', 'Filipe', 'Gonçalo', 'João', 'Miguel', 'Nuno', 'Pedro', 'Rui', 'Tiago', 'Vasco'] };
  const last = ['Almeida', 'Barbosa', 'Cardoso', 'Correia', 'Fernandes', 'Ferreira', 'Gomes', 'Lopes', 'Marques', 'Martins', 'Mendes', 'Monteiro', 'Pereira', 'Pinto', 'Ribeiro', 'Rocha', 'Santos', 'Sousa', 'Teixeira', 'Vieira'];
  const streets = ['Rua das Flores', 'Av. da Liberdade', 'Rua do Sol', 'Rua Nova', 'Av. da República', 'Rua da Paz', 'Travessa do Carmo', 'Rua Direita', 'Av. Central', 'Rua dos Lírios'];
  const cities = [['1000', 'LISBOA'], ['1100', 'LISBOA'], ['4000', 'PORTO'], ['4400', 'VILA NOVA DE GAIA'], ['3000', 'COIMBRA'], ['4700', 'BRAGA'], ['8000', 'FARO'], ['2750', 'CASCAIS'], ['2800', 'ALMADA'], ['3800', 'AVEIRO']];
  const professions = ['Professor', 'Engenheiro', 'Enfermeiro', 'Comercial', 'Médico', 'Advogado', 'Designer', 'Contabilista', 'Estudante', 'Reformado', 'Empresário', 'Técnico de Informática'];
  const marital = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'União de Facto', 'Viúvo(a)'];
  const letters = 'ABCDEFGHIJLMNOPRSTUVXZ';
  const plate = () => `${int(10, 99)}-${letters[int(0, 21)]}${letters[int(0, 21)]}-${int(10, 99)}`;
  const date = (y1, y2) => `${int(y1, y2)}-${pad(int(1, 12))}-${pad(int(1, 28))}`;

  db.exec('BEGIN');
  try {
    const camp = db.prepare('INSERT OR IGNORE INTO campaigns(name, active) VALUES (?, ?)');
    ['Black Month 2026', 'Verão Seguro 2026', 'Leve 2 Pague Menos', 'Regresso às Aulas'].forEach((c, i) => camp.run(c, i < 2 ? 1 : 0));
    const campaignIds = db.prepare('SELECT id, name FROM campaigns').all();

    const insClient = db.prepare(`INSERT INTO clients (entity_number, name, short_name, nif, birth_date, gender, marital_status, profession,
      driver_license, license_date, brand, digital, registered, register_channel, register_email, area_email, last_login_area,
      digital_docs_at, cisa_by_mail, cisa_updated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insAddr = db.prepare('INSERT INTO addresses (client_id, type, description, postal_code, city, main, created_at) VALUES (?,?,?,?,?,?,?)');
    const insContact = db.prepare('INSERT INTO contacts (client_id, type, value, main, created_at) VALUES (?,?,?,?,?)');
    const insPolicy = db.prepare(`INSERT INTO policies (number, client_id, branch, plate, driver_name, start_date, end_date, product, status, annual_value, campaign, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insClaim = db.prepare('INSERT INTO claims (number, client_id, policy_id, branch, plate, date, status, type, responsibility, description, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const insDoc = db.prepare('INSERT INTO documents (client_id, policy_id, branch, type, context, filename, channel, created_at, last_print) VALUES (?,?,?,?,?,?,?,?,?)');
    const insConsent = db.prepare('INSERT INTO consents (client_id, type, status, updated_at, updated_by) VALUES (?,?,?,?,?)');
    const insPay = db.prepare('INSERT INTO payments (client_id, policy_id, reference, amount, due_date, status, method, paid_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
    const insSim = db.prepare('INSERT INTO simulations (number, client_id, branch, product, status, plate, campaign, premium, source, edited_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const insProc = db.prepare(`INSERT INTO processes (number, client_id, policy_id, branch, process_type, task, task_number, status, priority, notes, created_at, expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insInsp = db.prepare('INSERT INTO inspections (client_id, policy_id, scheduled_at, location, status, notes, created_at) VALUES (?,?,?,?,?,?,?)');
    const insCC = db.prepare('INSERT OR IGNORE INTO client_campaigns (client_id, campaign_id) VALUES (?,?)');

    const usedNif = new Set();
    for (let i = 0; i < 40; i++) {
      const gender = rand() < 0.5 ? 'F' : 'M';
      const fn = pick(first[gender]);
      const l1 = pick(last), l2 = pick(last);
      const name = `${fn} ${l1} ${l2}`;
      let nif; do { nif = makeNif(rand); } while (usedNif.has(nif)); usedNif.add(nif);
      const entity = String(nextSeq('entity', 4001050000 + int(0, 900) * 10));
      const birth = date(1950, 2003);
      const created = date(2008, 2025) + ' ' + `${pad(int(8, 20))}:${pad(int(0, 59))}:${pad(int(0, 59))}`;
      const email = `${fn}.${l2}${int(1, 99)}@exemplo.pt`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const digital = rand() < 0.65 ? 1 : 0;
      const [cp, city] = pick(cities);
      const res = insClient.run(entity, name, `${fn} ${l2}`.toUpperCase(), nif, birth, gender === 'F' ? 'Feminino' : 'Masculino', pick(marital), pick(professions),
        `L-${int(1000000, 9999999)} ${int(0, 9)}`, addYears(birth, int(18, 30)), rand() < 0.7 ? 'OK! teleseguros' : 'Via Directa', digital, digital,
        digital ? pick(['Área de Clientes', 'APP', 'Site']) : null, digital ? email : null, digital ? email : null,
        digital ? date(2026, 2026) + ' 12:00:00' : null, digital ? created : null, 0, created, created);
      const cid = Number(res.lastInsertRowid);

      insAddr.run(cid, 'Residência', `${pick(streets)} ${int(1, 220)}, ${int(1, 9)}º ${pick(['Esq', 'Dto', 'A', 'B'])}`, `${cp}-${pad(int(0, 999)).padStart(3, '0')}`, city, 1, created);
      insContact.run(cid, 'Telemóvel', `9${pick(['1', '2', '3', '6'])}${int(1000000, 9999999)}`, 1, created);
      insContact.run(cid, 'Email', email, 1, created);
      if (rand() < 0.3) insContact.run(cid, 'Telefone', `21${int(1000000, 9999999)}`, 0, created);

      CONSENT_TYPES.forEach((t) => insConsent.run(cid, t, pick(['Aceite', 'Aceite', 'Recusado', 'Pendente']), created, 'Sistema'));
      if (rand() < 0.4) insCC.run(cid, pick(campaignIds).id);

      // apólices
      const nPol = int(1, 3);
      for (let p = 0; p < nPol; p++) {
        const branch = p === 0 ? 'Automóvel' : pick(BRANCHES);
        const product = pick(Object.keys(PRODUCTS[branch]));
        const start = date(2025, 2026);
        const status = rand() < 0.85 ? 'Em Vigor' : 'Anulada';
        const value = computePremium(branch, product, { birth_date: birth }) ?? 200;
        const pl = branch === 'Automóvel' ? plate() : null;
        const polNum = String(nextSeq('policy', 900110000));
        const pr = insPolicy.run(polNum, cid, branch, pl, branch === 'Automóvel' ? `${fn} ${l2}` : null, start, addYears(start, 1), product, status, value,
          rand() < 0.2 ? pick(campaignIds).name : null, start + ' 10:00:00');
        const pid = Number(pr.lastInsertRowid);

        const docBase = `OK_02_#_${cp}_${entity}_${polNum}`;
        if (branch === 'Automóvel') insDoc.run(cid, pid, branch, 'Carta Verde', 'Renovação', `${docBase}_VDCVERDE_0000_${int(10000000, 99999999)}.pdf`, 'Email', start + ' 16:02:31', start + ' 08:45:21');
        insDoc.run(cid, pid, branch, 'Fatura', 'Renovação', `${docBase}_VD_FATR_AVR_0000_${int(10000000, 99999999)}.pdf`, 'Email', start + ' 16:50:59', start + ' 10:13:20');

        // recibos
        const paid = rand() < 0.75;
        insPay.run(cid, pid, `REC${polNum}${pad(1)}`, value, start, paid ? 'Pago' : 'Pendente', paid ? pick(['Multibanco', 'Débito Direto', 'MB WAY', 'Cartão']) : null, paid ? start + ' 09:00:00' : null, start + ' 08:00:00');
        if (status === 'Em Vigor' && rand() < 0.35) insPay.run(cid, pid, `REC${polNum}${pad(2)}`, Math.round(value / 2 * 100) / 100, addDays(today(), int(-10, 30)), 'Pendente', null, null, ts);

        if (rand() < 0.3) {
          const cn = `${String(int(23, 26))}AA${int(100000, 999999)}`;
          insClaim.run(cn, cid, pid, branch, pl, date(2023, 2026), pick(['Aberto', 'Em Análise', 'Encerrado', 'Encerrado']),
            branch === 'Automóvel' ? pick(['Colisão', 'Quebra Isolada de Vidros', 'Furto', 'Assistência em Viagem']) : pick(['Danos por Água', 'Fenómenos Naturais', 'Despesas Médicas']),
            pick(['Por apurar', 'Sem responsabilidade', 'Responsabilidade total', 'Responsabilidade parcial']), 'Participação registada na carga inicial de dados.', ts);
        }
        if (branch === 'Automóvel' && rand() < 0.2) {
          insInsp.run(cid, pid, rand() < 0.5 ? addDays(today(), int(1, 15)) + ' 10:30' : null, `${pick(streets)}, ${city}`, pick(['Por agendar', 'Agendada', 'Realizada']), 'Vistoria de adesão.', ts);
        }
      }

      if (rand() < 0.5) {
        const branch = pick(BRANCHES);
        const product = pick(Object.keys(PRODUCTS[branch]));
        insSim.run(`S${nextSeq('simulation', 26000000)}`, cid, branch, product, pick(['Pendente', 'Rejeitada', 'Pendente']), branch === 'Automóvel' ? plate() : null,
          null, computePremium(branch, product, { birth_date: birth }), pick(['Praxis', 'Site']), addDays(today(), -int(0, 40)) + ' 15:00:00');
      }
      if (rand() < 0.35) {
        const pol = db.prepare('SELECT id, branch FROM policies WHERE client_id = ? LIMIT 1').get(cid);
        const t = pick([['Alteração de Dados', 'Validar documentos'], ['Renovação', 'Contactar cliente'], ['Sinistro', 'Analisar participação'], ['Reclamação', 'Responder ao cliente'], ['Anulação', 'Confirmar anulação']]);
        const created2 = addDays(today(), -int(0, 10)) + ' 11:00:00';
        insProc.run(`PR${nextSeq('process', 7000000)}`, cid, pol.id, pol.branch, t[0], t[1], `T${nextSeq('task', 9000000)}`, pick(['Aberto', 'Aberto', 'Em Curso']), pick(['Normal', 'Normal', 'Alta']),
          null, created2, addDays(created2, int(2, 10)));
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Cria o administrador inicial na primeira execução
export function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return null;
  const password = randomPassword(14);
  db.prepare(`INSERT INTO users (username, name, email, role, team, password_hash, active, must_change_password, created_at)
              VALUES ('admin', 'Administrador', NULL, 'admin', 'Administração', ?, 1, 1, ?)`).run(hashPassword(password), now());
  const file = path.join(DATA_DIR, 'ADMIN-PASSWORD-INICIAL.txt');
  fs.writeFileSync(file,
    `Praxis CRM — credenciais iniciais do administrador\n\nUtilizador: admin\nPassword temporária: ${password}\n\n` +
    `No primeiro login vai ser pedido para definir uma nova password.\nApague este ficheiro depois de entrar.\n`, 'utf8');
  return file;
}

export function ensureSeed() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM clients').get().n;
  if (n === 0) seedDemo();
  backfillPolicies();
  backfillPolicyRisk();
  backfillClientHistory();
  ensureLookups();
  ensureLookupsV2();
  const file = ensureDirectionAccounts();
  ensureGrantOwner();
  renameLoginsToFmex();
  return file;
}

// Passa os logins existentes (exceto o "admin" inicial) para o formato FM\EX + número — corre uma vez
function renameLoginsToFmex() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'rename-fmex-v1'").get()) return;
  const users = db.prepare("SELECT id, username FROM users WHERE username != 'admin' ORDER BY id").all().filter((u) => !FMEX_RE.test(u.username));
  const renames = [];
  db.exec('BEGIN');
  try {
    for (const u of users) {
      const login = nextFmexUsername();
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(login, u.id);
      // registos que mostram o autor pelo login (o histórico de auditoria fica como estava)
      for (const t of ['comments', 'access_log', 'call_closures']) db.prepare(`UPDATE ${t} SET username = ? WHERE user_id = ?`).run(login, u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
      renames.push([u.username, login]);
    }
    db.prepare("INSERT INTO counters (name, value) VALUES ('rename-fmex-v1', 1)").run();
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  // atualizar o ficheiro de credenciais da Direção, se existir
  const file = path.join(DATA_DIR, 'CONTAS-DIRECAO.txt');
  if (renames.length && fs.existsSync(file)) {
    let t = fs.readFileSync(file, 'utf8');
    for (const [from, to] of renames) t = t.split(`Utilizador: ${from}\n`).join(`Utilizador: ${to}\n`);
    fs.writeFileSync(file, t, 'utf8');
  }
  if (renames.length) console.log('  Logins convertidos para FM\\EX: ' + renames.map(([a, b]) => `${a} → ${b}`).join(', '));
}

// A conta "admin" (do responsável pelo sistema) recebe a permissão de conceder "Acesso total" — corre uma vez
function ensureGrantOwner() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'grant-top-v1'").get()) return;
  const owner = db.prepare("SELECT id FROM users WHERE username = 'admin'").get()
    || db.prepare("SELECT id FROM users WHERE role = 'superadmin' ORDER BY id LIMIT 1").get();
  if (owner) db.prepare('UPDATE users SET can_grant_top = 1 WHERE id = ?').run(owner.id);
  db.prepare("INSERT INTO counters (name, value) VALUES ('grant-top-v1', 1)").run();
}

// Contas da Direção (nomes fictícios). A Presidente Executiva tem o perfil "Acesso total" (cargo máximo).
// Equipas e cargos predefinidos (selecionáveis na criação/edição de contas; geríveis em Utilizadores › Equipas e cargos)
export const DEFAULT_TEAMS = ['OK CL AUTO', 'OK CL MHR', 'OK CL SAÚDE', 'OK CL AP', 'OK VENDAS AUTO', 'OK VENDAS MHR', 'OK SINISTROS AUTO', 'OK SINISTROS MHR',
  'OK COBRANÇAS', 'OK RETENÇÃO', 'OK BACKOFFICE', 'OK QUALIDADE', 'OK REAVALIAÇÃO DE VALORES', 'Supervisão', 'Administração', 'Direção'];
export const DEFAULT_JOBS = ['Assistente de Apoio ao Cliente', 'Assistente Comercial', 'Gestor(a) de Sinistros', 'Técnico(a) de Backoffice', 'Técnico(a) de Cobranças',
  'Técnico(a) de Retenção', 'Analista de Qualidade', 'Formador(a)', 'Supervisor(a) de Equipa', 'Coordenador(a) de Área', 'Administrador(a) de Sistemas',
  'Diretor(a) de Sistemas de Informação', 'Diretor(a) de Sinistros', 'Diretor(a) Financeiro(a) (CFO)', 'Diretor(a) Comercial e de Marketing',
  'Diretor(a)-Geral de Operações', 'Presidente Executivo(a) (CEO)'];
export const lookupList = (kind) => db.prepare('SELECT value FROM lookups WHERE kind = ? ORDER BY sort, value').all(kind).map((r) => r.value);
function ensureLookups() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'seed-lookups-v1'").get()) return;
  const ins = db.prepare('INSERT OR IGNORE INTO lookups (kind, value, sort) VALUES (?,?,?)');
  DEFAULT_TEAMS.forEach((v, i) => ins.run('team', v, i));
  DEFAULT_JOBS.forEach((v, i) => ins.run('job', v, i));
  db.prepare("INSERT INTO counters (name, value) VALUES ('seed-lookups-v1', 1)").run();
}
// v2: nova equipa "OK REAVALIAÇÃO DE VALORES" (logo a seguir a OK QUALIDADE) em bases que já tinham as listas
function ensureLookupsV2() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'seed-lookups-v2'").get()) return;
  const v = 'OK REAVALIAÇÃO DE VALORES';
  if (!db.prepare("SELECT 1 FROM lookups WHERE kind = 'team' AND value = ?").get(v)) {
    const ref = db.prepare("SELECT sort FROM lookups WHERE kind = 'team' AND value = 'OK QUALIDADE'").get();
    const pos = ref ? ref.sort + 1 : (db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM lookups WHERE kind = 'team'").get().s);
    db.prepare("UPDATE lookups SET sort = sort + 1 WHERE kind = 'team' AND sort >= ?").run(pos);
    db.prepare("INSERT INTO lookups (kind, value, sort) VALUES ('team', ?, ?)").run(v, pos);
  }
  db.prepare("INSERT INTO counters (name, value) VALUES ('seed-lookups-v2', 1)").run();
}

// Logins no formato do sistema antigo: FM\EX + número (ex.: FM\EX12471)
export const FMEX_PREFIX = 'FM\\EX';
export const FMEX_RE = /^FM\\EX(\d{4,6})$/i;
export function nextFmexUsername() {
  const max = db.prepare('SELECT username FROM users').all().map((u) => FMEX_RE.exec(u.username)).filter(Boolean)
    .reduce((m, x) => Math.max(m, Number(x[1])), 12470);
  return `${FMEX_PREFIX}${max + 1}`;
}

export const DIRECTION_ACCOUNTS = [
  { username: 'helena.vasconcelos', name: 'Helena Vasconcelos', job: 'Presidente Executivo(a) (CEO)', role: 'superadmin' },
  { username: 'rui.montenegro', name: 'Rui Montenegro', job: 'Diretor(a)-Geral de Operações', role: 'direcao' },
  { username: 'marta.albuquerque', name: 'Marta Albuquerque', job: 'Diretor(a) Comercial e de Marketing', role: 'direcao' },
  { username: 'ines.carvalhal', name: 'Inês Carvalhal', job: 'Diretor(a) Financeiro(a) (CFO)', role: 'direcao' },
  { username: 'tiago.sampaio', name: 'Tiago Sampaio', job: 'Diretor(a) de Sinistros', role: 'direcao' },
  { username: 'paulo.brandao', name: 'Paulo Brandão', job: 'Diretor(a) de Sistemas de Informação', role: 'direcao' },
];
function ensureDirectionAccounts() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'seed-direcao-v1'").get()) return null;
  const lines = [];
  for (const a of DIRECTION_ACCOUNTS) {
    if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(a.name)) continue;
    const pw = randomPassword(14);
    const login = nextFmexUsername();
    db.prepare(`INSERT INTO users (username, name, email, role, team, job_title, password_hash, active, must_change_password, created_at)
      VALUES (?,?,?,?, 'Direção', ?, ?, 1, 1, ?)`).run(login, a.name, `${a.username}@direcao.exemplo.pt`, a.role, a.job, hashPassword(pw), now());
    lines.push(`${a.name}\n  Cargo: ${a.job}\n  Perfil: ${a.role === 'superadmin' ? 'Acesso total (cargo máximo)' : 'Direção'}\n  Utilizador: ${login}\n  Password temporária: ${pw}\n`);
  }
  db.prepare("INSERT INTO counters (name, value) VALUES ('seed-direcao-v1', 1)").run();
  if (!lines.length) return null;
  const file = path.join(DATA_DIR, 'CONTAS-DIRECAO.txt');
  fs.writeFileSync(file, 'Praxis CRM — contas da Direção (nomes fictícios, ambiente de teste local)\n\n' + lines.join('\n') +
    '\nNo primeiro login cada pessoa tem de definir uma password nova.\n' +
    'O perfil "Acesso total" pode alterar tudo em qualquer utilizador (incluindo Direção e Administradores).\n' +
    'Apague este ficheiro depois de entregar as passwords.\n', 'utf8');
  return file;
}

// Dados de demonstração: comentários e últimas operações em todos os clientes que ainda não os têm (corre uma vez)
function backfillClientHistory() {
  if (db.prepare("SELECT 1 FROM counters WHERE name = 'seed-history-v1'").get()) return;
  const rand = mulberry32(88123);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const users = db.prepare('SELECT id, username FROM users ORDER BY id').all();
  const who = () => pick(users);
  const at = (date) => `${date} ${String(int(9, 19)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}`;
  const NOTES = [
    ['Contacto', (p) => `Cliente ligou a pedir a 2.ª via da carta verde da apólice ${p}. Enviada por email.`],
    ['Pedido', (p) => `Cônjuge do tomador contactou a solicitar a revisão (RV) da apólice ${p}; informado de que o pedido tem de ser feito pelo tomador.`],
    ['Contacto', (p) => `Pediu informação sobre o valor da próxima prestação da apólice ${p}. Esclarecido.`],
    ['Nota', () => 'Prefere ser contactado ao fim da tarde, depois das 18h.'],
    ['Pedido', (p) => `Solicitou alteração do IBAN para débito direto da apólice ${p}. Aguarda comprovativo.`],
    ['Reclamação', (p) => `Reclamou do aumento do prémio na renovação da apólice ${p}. Encaminhado para a equipa comercial.`],
    ['Alerta', () => 'Cliente com recibo em atraso. Confirmar pagamento antes de qualquer alteração.'],
    ['Contacto', () => 'Atualizou o email de contacto e aderiu à Área de Cliente.'],
  ];
  const insC = db.prepare('INSERT INTO comments (client_id, user_id, username, text, created_at, category, pinned, policy_number) VALUES (?,?,?,?,?,?,?,?)');
  const insA = db.prepare('INSERT INTO audit (client_id, user_id, username, action, details, created_at) VALUES (?,?,?,?,?,?)');
  const clients = db.prepare('SELECT id, created_at FROM clients').all();
  db.exec('BEGIN');
  try {
    for (const c of clients) {
      const pols = db.prepare('SELECT number, branch, product, formalized_at, created_at FROM policies WHERE client_id = ? ORDER BY created_at').all(c.id);
      if (!db.prepare('SELECT 1 FROM comments WHERE client_id = ? LIMIT 1').get(c.id)) {
        const n = int(1, 3);
        let day = addDays(today(), -int(60, 400));
        for (let i = 0; i < n; i++) {
          const [cat, fn] = pick(NOTES);
          const pol = pols.length ? pick(pols).number : null;
          const u = who();
          insC.run(c.id, u.id, u.username, fn(pol || '—'), at(day), cat, cat === 'Alerta' ? 1 : 0, fn.length && pol ? pol : null);
          day = addDays(day, int(10, 90));
          if (day > today()) day = today();
        }
      }
      if (!db.prepare('SELECT 1 FROM audit WHERE client_id = ? LIMIT 1').get(c.id)) {
        insA.run(c.id, null, 'Sistema', 'Cliente criado', 'Carga inicial de dados', c.created_at);
        for (const p of pols) insA.run(c.id, null, 'Sistema', 'Apólice emitida', `${p.number} · ${p.branch} · ${p.product}`, p.formalized_at || p.created_at);
      }
    }
    db.prepare("INSERT INTO counters (name, value) VALUES ('seed-history-v1', 1)").run();
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// Completa os dados de condutor/veículo, desconto, bónus/malus e versão de tarifa em falta
function backfillPolicyRisk() {
  const rand = mulberry32(55021);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const CARS = [['Renault', 'Clio', '1.0 TCe'], ['Peugeot', '208', '1.2 PureTech'], ['Volkswagen', 'Golf', '2.0 TDI'], ['Seat', 'Ibiza', '1.0 TSI'],
    ['Toyota', 'Yaris', '1.5 Hybrid'], ['BMW', 'Série 1', '118d'], ['Mercedes-Benz', 'Classe A', 'A 180 d'], ['Fiat', '500', '1.0 Hybrid'], ['Tesla', 'Model 3', 'Long Range']];
  const pols = db.prepare('SELECT p.*, c.birth_date AS c_birth, c.driver_license AS c_license, c.license_date AS c_license_date FROM policies p JOIN clients c ON c.id = p.client_id WHERE p.tariff_version IS NULL').all();
  if (!pols.length) return;
  const upd = db.prepare(`UPDATE policies SET driver_birth_date = ?, driver_license = ?, driver_license_date = ?, vehicle_make = ?, vehicle_model = ?, vehicle_version = ?,
    vehicle_first_reg = ?, vehicle_use = ?, vehicle_value = ?, commercial_discount = ?, bonus_malus = ?, tariff_version = ? WHERE id = ?`);
  db.exec('BEGIN');
  try {
    for (const p of pols) {
      const auto = p.branch === 'Automóvel';
      const car = pick(CARS);
      upd.run(auto ? p.c_birth : null, auto ? p.c_license : null, auto ? p.c_license_date : null, auto ? car[0] : null, auto ? car[1] : null, auto ? car[2] : null,
        auto ? `${int(2008, 2024)}-${pad(int(1, 12))}-${pad(int(1, 28))}` : null, auto ? (rand() < 0.9 ? 'Particular' : 'Profissional') : null,
        auto ? int(6, 45) * 1000 : null, pick([0, 0, 0, 5, 10]), auto ? pick([-50, -40, -30, -20, -10, 0, 0, 10, 25]) : 0,
        pick(['v20.11', 'v20.11', TARIFF_VERSION]), p.id);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// Completa os "Dados da Apólice" e a aceitação de termos das apólices que ainda não os têm
function backfillPolicies() {
  const rand = mulberry32(73191);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const time = () => `${pad(int(8, 22))}:${pad(int(0, 59))}:${pad(int(0, 59))}`;
  const addMin = (ts, m) => fmtDateTime(new Date(new Date(ts.replace(' ', 'T')).getTime() + m * 60e3));
  const METHOD = { 'Débito Direto': '430035 - EFT', Multibanco: '430036 - Multibanco', 'Cartão': '430037 - Cartão de Crédito', 'MB WAY': '430038 - MB WAY' };
  const PROTOCOLS = [() => `DECO PROTeste - ${int(1000000, 9999999)}-${int(10, 99)}`, () => `ACP - ${int(100000, 999999)}`, () => `Ordem dos Engenheiros - ${int(10000, 99999)}`];
  const CHANGES = ['Alteração do fracionamento', 'Atualização do IBAN de cobrança', 'Alteração do condutor habitual', 'Alteração de coberturas', 'Alteração da morada de risco'];
  const pols = db.prepare('SELECT * FROM policies WHERE formalized_at IS NULL').all();
  if (!pols.length) return;
  const upd = db.prepare(`UPDATE policies SET formalized_at = ?, mediation_account = ?, bonus_table = ?, collection_account = ?, iban = ?, renewal_mode = ?,
    no_renew = ?, fractioning = ?, channel = ?, info_source = ?, protocol = COALESCE(protocol, ?) WHERE id = ?`);
  const insTerm = db.prepare('INSERT INTO policy_terms (policy_id, type, description, created_at, start_date, accepted_at, accepted_via, created_by) VALUES (?,?,?,?,?,?,?,?)');
  const hasTerms = db.prepare('SELECT 1 FROM policy_terms WHERE policy_id = ? LIMIT 1');
  const lastMethod = db.prepare("SELECT method FROM payments WHERE policy_id = ? AND method IS NOT NULL ORDER BY due_date DESC LIMIT 1");
  db.exec('BEGIN');
  try {
    for (const p of pols) {
      const formalized = p.created_at.slice(0, 10) < p.start_date ? p.created_at : `${addDays(p.start_date, -int(1, 3))} ${time()}`;
      const collection = METHOD[lastMethod.get(p.id)?.method] || (rand() < 0.7 ? '430035 - EFT' : pick(POLICY_OPTIONS.collection));
      const r = rand();
      const fractioning = r < 0.45 ? 'Anual' : r < 0.75 ? 'Semestral' : r < 0.9 || !collection.endsWith('EFT') ? 'Trimestral' : 'Mensal';
      upd.run(formalized, MEDIATION_ACCOUNT, p.branch === 'Automóvel' ? pick(['TBM001', 'TBM001', 'TBM002', 'TBM003']) : null, collection,
        collection.endsWith('EFT') ? makeIbanPT(rand) : null, rand() < 0.88 ? 'Automático' : 'Manual',
        p.status === 'Em Vigor' && rand() < 0.06 ? pick(POLICY_OPTIONS.noRenew) : null, fractioning, pick(POLICY_OPTIONS.channel),
        rand() < 0.55 ? pick(POLICY_OPTIONS.infoSource) : null, rand() < 0.3 ? pick(PROTOCOLS)() : null, p.id);
      if (hasTerms.get(p.id)) continue;
      const created = addMin(formalized, int(1, 4));
      insTerm.run(p.id, 'Novo Negócio', `Contratação ${p.branch} · ${p.product}`, created, p.start_date, addMin(created, int(2, 30)), pick(['Área de Cliente', 'Gravação de chamada', 'Email']), 'Sistema');
      // alterações posteriores (algumas ainda por aceitar)
      let day = addDays(p.start_date, int(20, 120));
      for (let k = 0, nAlt = int(0, 3); k < nAlt && day < today(); k++) {
        const createdAlt = `${day} ${time()}`;
        const accDay = addDays(day, int(0, 30));
        const pending = (k === nAlt - 1 && rand() < 0.3) || accDay > today();
        insTerm.run(p.id, 'Alteração', pick(CHANGES), createdAlt, addDays(day, int(0, 30)), pending ? null : `${accDay} ${time()}`,
          pending ? null : pick(POLICY_OPTIONS.termsAccept), 'Sistema');
        day = addDays(day, int(30, 160));
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
