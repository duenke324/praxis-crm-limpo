// Praxis CRM — servidor HTTP + API REST (sem dependências externas)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PdfPage, buildPdf, textWidth } from './pdf.js';
import { companyFor } from './company.js';
import * as OK from './okauto.js';
import {
  db, now, today, addDays, addYears, fmtDateTime, hashPassword, verifyPassword, randomPassword, validNif, nextSeq,
  computePremium, PRODUCTS, BRANCHES, CONSENT_TYPES, CALL_SUBJECTS, CALL_SUBJECT_LIST, POLICY_OPTIONS, FRACTION_N, MEDIATION_ACCOUNT, TARIFF_VERSION, COMMENT_CATEGORIES, CANCEL_REASONS, cancelReasonsFor, findCancelReason, lookupList, nextFmexUsername, validIban, normIban, ensureAdmin, ensureSeed,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 9090);
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_HOURS = 10;

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
const fail = (status, message, code) => { throw new HttpError(status, message, code); };
const need = (cond, message = 'Pedido inválido') => { if (!cond) fail(400, message); };
const str = (v) => (v == null ? null : String(v).trim() || null);
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

// ---------- router ----------
const routes = [];
function route(method, pattern, roles, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, roles, handler });
}
const ANY = 'auth';
const STAFF = ['superadmin', 'direcao', 'admin', 'supervisor', 'agente'];
const MANAGERS = ['superadmin', 'direcao', 'admin', 'supervisor'];
const ADMIN = ['superadmin', 'direcao', 'admin'];

// ---------- sessão ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function getUser(req) {
  const token = parseCookies(req).praxis_session;
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                          WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`).get(sha(token), now());
  if (row) db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now(), row.id);
  return row || null;
}
function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

// tentativas falhadas de login (proteção contra força bruta)
const failures = new Map();
function checkLock(key) {
  const f = failures.get(key);
  if (f && f.count >= 5 && Date.now() - f.last < 5 * 60e3) fail(429, 'Demasiadas tentativas falhadas. Tente novamente dentro de 5 minutos.');
}
function registerFailure(key) {
  const f = failures.get(key) || { count: 0, last: 0 };
  if (Date.now() - f.last > 5 * 60e3) f.count = 0;
  f.count++; f.last = Date.now();
  failures.set(key, f);
}

function audit(user, clientId, action, details) {
  db.prepare('INSERT INTO audit (client_id, user_id, username, action, details, created_at) VALUES (?,?,?,?,?,?)')
    .run(clientId ?? null, user?.id ?? null, user?.username ?? 'Sistema', action, details ?? null, now());
}

function updateFields(table, id, body, allowed) {
  const sets = [], vals = [];
  for (const [key, conv] of Object.entries(allowed)) {
    if (key in body) { sets.push(`${key} = ?`); vals.push(conv(body[key])); }
  }
  if (!sets.length) return 0;
  vals.push(id);
  return db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...vals).changes;
}

function getClient(id) {
  const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));
  if (!c) fail(404, 'Cliente não encontrado');
  return c;
}
function getRow(table, id, label) {
  const r = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
  if (!r) fail(404, `${label} não encontrado(a)`);
  return r;
}
function whereBuilder() {
  const w = [], v = [];
  return {
    add(cond, val) { if (val !== undefined && val !== null && val !== '') { w.push(cond); v.push(val); } },
    raw(cond) { w.push(cond); },
    sql() { return w.length ? ' WHERE ' + w.join(' AND ') : ''; },
    vals: v,
  };
}
const money = (n) => Math.round(Number(n) * 100) / 100;

// =====================================================================
// AUTENTICAÇÃO
// =====================================================================
route('POST', '/api/login', null, ({ body, req, res }) => {
  const username = str(body.username), password = String(body.password || '');
  need(username && password, 'Indique o utilizador e a password');
  const key = `${username.toLowerCase()}|${req.socket.remoteAddress}`;
  checkLock(key);
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !verifyPassword(password, u.password_hash)) { registerFailure(key); fail(401, 'Utilizador ou password incorretos'); }
  if (!u.active) fail(403, 'Esta conta está desativada. Contacte o administrador.');
  failures.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  const exp = fmtDateTime(new Date(Date.now() + SESSION_HOURS * 3600e3));
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)').run(sha(token), u.id, now(), exp);
  db.prepare("UPDATE users SET last_login = ?, last_seen = ?, agent_status = 'Disponível' WHERE id = ?").run(now(), now(), u.id);
  res.setHeader('Set-Cookie', `praxis_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`);
  audit(u, null, 'Login', null);
  return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) };
});

route('POST', '/api/logout', null, ({ req, res, user }) => {
  const token = parseCookies(req).praxis_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  if (user) { db.prepare("UPDATE users SET agent_status = 'Indisponível' WHERE id = ?").run(user.id); audit(user, null, 'Logout', null); }
  res.setHeader('Set-Cookie', 'praxis_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  return { ok: true };
});

route('GET', '/api/me', ANY, ({ user }) => ({ user: publicUser(user) }));

route('POST', '/api/me/password', ANY, ({ user, body }) => {
  const cur = String(body.current || ''), nw = String(body.password || '');
  if (!verifyPassword(cur, user.password_hash)) fail(400, 'A password atual está incorreta');
  need(nw.length >= 8, 'A nova password tem de ter pelo menos 8 caracteres');
  need(/[A-Za-z]/.test(nw) && /\d/.test(nw), 'A nova password tem de ter letras e números');
  need(nw !== cur, 'A nova password tem de ser diferente da atual');
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(nw), user.id);
  audit(user, null, 'Alteração de password', null);
  return { ok: true };
});

route('POST', '/api/me/status', ANY, ({ user, body }) => {
  const s = str(body.status);
  need(['Disponível', 'Em chamada', 'Pausa', 'Indisponível'].includes(s), 'Estado inválido');
  db.prepare('UPDATE users SET agent_status = ? WHERE id = ?').run(s, user.id);
  return { ok: true, status: s };
});

route('GET', '/api/meta', ANY, () => ({
  branches: BRANCHES, products: PRODUCTS, consentTypes: CONSENT_TYPES, callSubjects: CALL_SUBJECTS, policyOptions: POLICY_OPTIONS, fractionN: FRACTION_N, tariffVersion: TARIFF_VERSION, alterationSections: ALT_SECTIONS, commentCategories: COMMENT_CATEGORIES, cancelReasons: CANCEL_REASONS,
  campaigns: db.prepare('SELECT * FROM campaigns ORDER BY active DESC, name').all(),
  users: db.prepare('SELECT id, username, name FROM users WHERE active = 1 ORDER BY name').all(),
  teams: lookupList('team'), jobTitles: lookupList('job'),
}));

// =====================================================================
// ADMINISTRAÇÃO DE UTILIZADORES
// Hierarquia: Acesso total (cargo máximo) > Direção > Administrador > Supervisor > Agente.
// Cada perfil gere apenas utilizadores de nível inferior e só atribui perfis inferiores ao seu.
// O "Acesso total" altera tudo em qualquer utilizador (incluindo Direção, Administradores e a própria conta).
// =====================================================================
const ROLES = ['superadmin', 'direcao', 'admin', 'supervisor', 'agente'];
const LEVEL = { agente: 1, supervisor: 2, admin: 3, direcao: 4, superadmin: 5 };
// "Pode conceder Acesso total": quem tem esta permissão gere todos os utilizadores e é o único que dá/tira o perfil "Acesso total"
const canGrant = (u) => !!u?.can_grant_top;
const isTop = (u) => u?.role === 'superadmin' || canGrant(u);
const canManage = (actor, target) => isTop(actor) || (actor.id !== target.id && LEVEL[actor.role] > LEVEL[target.role]);
const canAssign = (actor, role) => (role === 'superadmin' ? canGrant(actor) : isTop(actor) || LEVEL[role] < LEVEL[actor.role]);
const activeGranters = (excludeId) => db.prepare('SELECT COUNT(*) AS n FROM users WHERE can_grant_top = 1 AND active = 1 AND id != ?').get(excludeId ?? -1).n;
const USERNAME_RE = /^[A-Za-z0-9._\\-]{3,40}$/;
const activeTop = (excludeId) => db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND active = 1 AND id != ?").get(excludeId ?? -1).n;
// nunca deixar o sistema sem pelo menos uma conta de acesso total ativa
function guardLastTop(target, stillTop) {
  if (target.role === 'superadmin' && target.active && !stillTop && activeTop(target.id) === 0) fail(400, 'Tem de existir pelo menos uma conta de "Acesso total" ativa. Atribua esse perfil a outra pessoa primeiro.');
}
function manageable(user, target) {
  if (!canManage(user, target)) fail(403, target.id === user.id ? 'Para alterar a sua própria conta use "O meu perfil"' : 'Não tem permissão sobre este utilizador (perfil igual ou superior ao seu)');
}
// várias equipas por pessoa: guardadas no campo "team" separadas por "; "
const splitTeams = (v) => (Array.isArray(v) ? v : String(v ?? '').split(';')).map((x) => String(x).trim()).filter(Boolean);
function teamsField(value, current = []) {
  const list = [...new Set(splitTeams(value))];
  need(list.length <= 10, 'No máximo 10 equipas por pessoa');
  const allowed = lookupList('team');
  need(list.every((t) => allowed.includes(t) || current.includes(t)), 'Escolha as equipas da lista');
  return list.length ? list.join('; ') : null;
}
const isLocked = (username) => [...failures.entries()].some(([k, f]) => k.startsWith(username.toLowerCase() + '|') && f.count >= 5 && Date.now() - f.last < 5 * 60e3);

route('GET', '/api/users', ADMIN, ({ user }) => {
  const sessions = Object.fromEntries(db.prepare('SELECT user_id, COUNT(*) AS n FROM sessions WHERE expires_at > ? GROUP BY user_id').all(now()).map((r) => [r.user_id, r.n]));
  return {
    users: db.prepare(`SELECT u.id, u.username, u.name, u.email, u.role, u.team, u.job_title, u.active, u.must_change_password, u.agent_status, u.can_grant_top,
      u.created_at, u.last_login, u.last_seen, c.username AS created_by_username
      FROM users u LEFT JOIN users c ON c.id = u.created_by ORDER BY u.active DESC, u.name`).all()
      .map((u) => ({ ...u, can_manage: canManage(user, u), sessions: sessions[u.id] || 0, locked: isLocked(u.username) })),
    assignableRoles: ROLES.filter((r) => canAssign(user, r)),
    isTop: isTop(user), canGrant: canGrant(user),
  };
});

route('GET', '/api/users/next-username', ADMIN, () => ({ username: nextFmexUsername() }));

route('POST', '/api/users', ADMIN, ({ user, body }) => {
  const username = str(body.username) || nextFmexUsername(), name = str(body.name), role = str(body.role) || 'agente';
  need(username && USERNAME_RE.test(username), 'O nome de utilizador deve ter 3–40 caracteres (letras, números, . _ - \\)');
  need(name, 'Indique o nome completo');
  need(ROLES.includes(role), 'Perfil inválido');
  need(canAssign(user, role), role === 'superadmin' ? 'Só quem tem a permissão "Pode conceder Acesso total" pode criar contas com esse perfil' : 'Não pode criar contas com um perfil igual ou superior ao seu');
  const email = str(body.email);
  if (email) need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'Email inválido');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, 'Já existe um utilizador com esse nome');
  let password = String(body.password || '');
  const generated = !password;
  if (generated) password = randomPassword(12);
  need(password.length >= 8, 'A password tem de ter pelo menos 8 caracteres');
  const teams = teamsField(body.team);
  need(!str(body.job_title) || lookupList('job').includes(str(body.job_title)), 'Escolha um cargo da lista');
  const r = db.prepare(`INSERT INTO users (username, name, email, role, team, job_title, password_hash, active, must_change_password, created_at, created_by)
    VALUES (?,?,?,?,?,?,?,1,1,?,?)`).run(username, name, email, role, teams, str(body.job_title), hashPassword(password), now(), user.id);
  audit(user, null, 'Utilizador criado', `${username} (${role})`);
  return { id: Number(r.lastInsertRowid), temporaryPassword: password, generated };
});

route('PUT', '/api/users/:id', ADMIN, ({ user, params, body }) => {
  const target = getRow('users', params.id, 'Utilizador');
  manageable(user, target);
  const changes = [];
  const next = {};
  if ('username' in body) {
    const u = str(body.username);
    need(u && USERNAME_RE.test(u), 'O nome de utilizador deve ter 3–40 caracteres (letras, números, . _ - \\)');
    if (u.toLowerCase() !== target.username.toLowerCase()) need(!db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(u, target.id), 'Já existe um utilizador com esse nome');
    next.username = u;
  }
  if ('name' in body) { need(str(body.name), 'Indique o nome'); next.name = str(body.name); }
  if ('email' in body) { const e = str(body.email); if (e) need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e), 'Email inválido'); next.email = e; }
  if ('team' in body) next.team = teamsField(body.team, splitTeams(target.team));
  if ('job_title' in body) { const j2 = str(body.job_title); need(!j2 || j2 === target.job_title || lookupList('job').includes(j2), 'Escolha um cargo da lista'); next.job_title = j2; }
  if ('role' in body) {
    need(ROLES.includes(body.role), 'Perfil inválido');
    if (body.role !== target.role) {
      if (body.role === 'superadmin' || target.role === 'superadmin') need(canGrant(user), 'Só quem tem a permissão "Pode conceder Acesso total" pode dar ou tirar esse perfil');
      else need(canAssign(user, body.role), 'Não pode atribuir um perfil igual ou superior ao seu');
    }
    next.role = body.role;
  }
  if ('can_grant_top' in body && bool(body.can_grant_top) !== (target.can_grant_top ? 1 : 0)) {
    need(canGrant(user), 'Só quem tem a permissão "Pode conceder Acesso total" a pode dar ou tirar');
    if (!bool(body.can_grant_top)) need(activeGranters(target.id) > 0, 'Tem de existir pelo menos uma pessoa ativa com a permissão "Pode conceder Acesso total"');
    next.can_grant_top = bool(body.can_grant_top);
  }
  if ('active' in body) next.active = bool(body.active);
  if ('must_change_password' in body) next.must_change_password = bool(body.must_change_password);
  if ('agent_status' in body) { need(['Disponível', 'Em chamada', 'Pausa', 'Indisponível'].includes(body.agent_status), 'Estado inválido'); next.agent_status = body.agent_status; }
  guardLastTop(target, (next.role ?? target.role) === 'superadmin' && (next.active ?? target.active) === 1);
  if (target.id === user.id && next.active === 0) need(activeTop(user.id) > 0, 'Não pode desativar a sua própria conta');
  if (target.can_grant_top && next.active === 0) need(activeGranters(target.id) > 0, 'Tem de existir pelo menos uma pessoa ativa com a permissão "Pode conceder Acesso total"');
  for (const [k, v] of Object.entries(next)) if (String(target[k] ?? '') !== String(v ?? '')) changes.push(`${k}: ${target[k] ?? '-'} → ${v ?? '-'}`);
  if (!changes.length) return { ok: true, changed: 0 };
  updateFields('users', target.id, next, Object.fromEntries(Object.keys(next).map((k) => [k, (v) => v])));
  if (next.active === 0 || 'username' in next || ('role' in next && next.role !== target.role)) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
  audit(user, null, 'Utilizador alterado', `${target.username} · ${changes.join('; ')}`);
  return { ok: true, changed: changes.length };
});

// repor password: gerada (temporária) ou definida por quem gere; o "Acesso total" pode dispensar a troca no 1.º login
route('POST', '/api/users/:id/reset-password', ADMIN, ({ user, params, body }) => {
  const target = getRow('users', params.id, 'Utilizador');
  manageable(user, target);
  let password = String(body.password || '');
  const generated = !password;
  if (generated) password = randomPassword(12);
  need(password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password), 'A password tem de ter pelo menos 8 caracteres, com letras e números');
  const mustChange = isTop(user) && 'must_change' in body ? bool(body.must_change) : 1;
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?').run(hashPassword(password), mustChange, target.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
  audit(user, null, 'Password reposta', `${target.username}${generated ? '' : ' · definida manualmente'}${mustChange ? '' : ' · sem troca obrigatória'}`);
  return { temporaryPassword: generated ? password : null, mustChange: !!mustChange };
});
route('POST', '/api/users/:id/end-sessions', ADMIN, ({ user, params }) => {
  const target = getRow('users', params.id, 'Utilizador');
  manageable(user, target);
  const n = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id).changes;
  audit(user, null, 'Sessões terminadas', `${target.username} · ${n} sessão(ões)`);
  return { ok: true, ended: n };
});
route('POST', '/api/users/:id/unlock', ADMIN, ({ user, params }) => {
  const target = getRow('users', params.id, 'Utilizador');
  manageable(user, target);
  for (const k of [...failures.keys()]) if (k.startsWith(target.username.toLowerCase() + '|')) failures.delete(k);
  audit(user, null, 'Conta desbloqueada', target.username);
  return { ok: true };
});

route('PUT', '/api/lookups/:kind', ADMIN, ({ user, params, body }) => {
  const kind = params.kind === 'team' || params.kind === 'job' ? params.kind : null;
  need(kind, 'Lista inválida');
  const values = Array.isArray(body.values) ? body.values.map((v) => String(v).trim()).filter(Boolean) : [];
  need(values.length >= 1 && values.length <= 80, 'A lista tem de ter entre 1 e 80 opções');
  need(values.every((v) => v.length <= 60), 'Cada opção pode ter no máximo 60 caracteres');
  if (kind === 'team') need(values.every((v) => !v.includes(';')), 'O nome de uma equipa não pode ter ";"');
  need(new Set(values.map((v) => v.toLowerCase())).size === values.length, 'Há opções repetidas');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM lookups WHERE kind = ?').run(kind);
    const ins = db.prepare('INSERT INTO lookups (kind, value, sort) VALUES (?,?,?)');
    values.forEach((v, i) => ins.run(kind, v, i));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  audit(user, null, kind === 'team' ? 'Lista de equipas alterada' : 'Lista de cargos alterada', `${values.length} opções`);
  return { ok: true, values };
});

route('DELETE', '/api/users/:id', ADMIN, ({ user, params }) => {
  const target = getRow('users', params.id, 'Utilizador');
  if (target.id === user.id && !isTop(user)) fail(400, 'Não pode eliminar a sua própria conta');
  manageable(user, target);
  guardLastTop(target, false);
  if (target.role === 'superadmin') need(canGrant(user), 'Só quem tem a permissão "Pode conceder Acesso total" pode eliminar contas com esse perfil');
  if (target.can_grant_top) need(activeGranters(target.id) > 0, 'Tem de existir pelo menos uma pessoa ativa com a permissão "Pode conceder Acesso total"');
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  audit(user, null, 'Utilizador eliminado', `${target.username} (${target.role})`);
  return { ok: true, self: target.id === user.id };
});

// =====================================================================
// PAINEL INICIAL
// =====================================================================
route('GET', '/api/dashboard', ANY, ({ user }) => {
  processPaymentSuspensions();
  const month = today().slice(0, 7);
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  return {
    kpis: {
      clients: one('SELECT COUNT(*) n FROM clients').n,
      activePolicies: one("SELECT COUNT(*) n FROM policies WHERE status = 'Em Vigor'").n,
      premium: money(one("SELECT COALESCE(SUM(annual_value),0) s FROM policies WHERE status = 'Em Vigor'").s),
      openClaims: one("SELECT COUNT(*) n FROM claims WHERE status != 'Encerrado'").n,
      openProcesses: one("SELECT COUNT(*) n FROM processes WHERE status != 'Concluído'").n,
      myProcesses: one("SELECT COUNT(*) n FROM processes WHERE status != 'Concluído' AND assigned_to = ?", user.id).n,
      simsMonth: one("SELECT COUNT(*) n FROM simulations WHERE substr(edited_at,1,7) = ?", month).n,
      pendingPayments: one("SELECT COUNT(*) n FROM payments WHERE status = 'Pendente'").n,
      renewals30: one("SELECT COUNT(*) n FROM policies WHERE status = 'Em Vigor' AND end_date BETWEEN ? AND ?", today(), addDays(today(), 30)).n,
    },
    recentClients: db.prepare(`SELECT c.id, c.name, c.nif, c.entity_number, MAX(a.created_at) AS at FROM access_log a JOIN clients c ON c.id = a.client_id
      WHERE a.user_id = ? GROUP BY c.id ORDER BY at DESC LIMIT 6`).all(user.id),
    myTasks: db.prepare(`SELECT p.*, c.name AS client_name FROM processes p JOIN clients c ON c.id = p.client_id
      WHERE p.status != 'Concluído' AND (p.assigned_to = ? OR p.assigned_to IS NULL) ORDER BY p.assigned_to IS NULL, p.expires_at LIMIT 8`).all(user.id),
    activity: db.prepare(`SELECT a.*, c.name AS client_name FROM audit a LEFT JOIN clients c ON c.id = a.client_id
      ORDER BY a.id DESC LIMIT 10`).all(),
    // listas de trabalho do ecrã inicial
    renewals: {
      count: one("SELECT COUNT(*) n FROM policies WHERE status = 'Em Vigor' AND end_date BETWEEN ? AND ?", today(), addDays(today(), 30)).n,
      rows: db.prepare(`SELECT p.id, p.number, p.branch, p.product, p.plate, p.end_date, p.annual_value, p.no_renew, p.renewal_mode, c.id AS client_id, c.name AS client_name
        FROM policies p JOIN clients c ON c.id = p.client_id WHERE p.status = 'Em Vigor' AND p.end_date BETWEEN ? AND ? ORDER BY p.end_date LIMIT 7`).all(today(), addDays(today(), 30)),
    },
    overdue: {
      ...one("SELECT COUNT(*) n, COALESCE(SUM(amount), 0) total FROM payments WHERE status = 'Pendente' AND due_date < ?", today()),
      suspended: one("SELECT COUNT(*) n FROM policies WHERE status = 'Suspensa'").n,
      rows: db.prepare(`SELECT y.id, y.reference, y.amount, y.due_date, p.number AS policy_number, p.status AS policy_status, c.id AS client_id, c.name AS client_name
        FROM payments y JOIN clients c ON c.id = y.client_id LEFT JOIN policies p ON p.id = y.policy_id
        WHERE y.status = 'Pendente' AND y.due_date < ? ORDER BY y.due_date LIMIT 7`).all(today()),
    },
    pendingTerms: {
      count: one("SELECT COUNT(*) n FROM policy_terms t JOIN policies p ON p.id = t.policy_id WHERE t.accepted_at IS NULL AND p.status = 'Em Vigor'").n,
      rows: db.prepare(`SELECT t.id, t.type, t.created_at, t.start_date, t.last_sent_at, p.number AS policy_number, c.id AS client_id, c.name AS client_name
        FROM policy_terms t JOIN policies p ON p.id = t.policy_id JOIN clients c ON c.id = p.client_id
        WHERE t.accepted_at IS NULL AND p.status = 'Em Vigor' ORDER BY t.created_at LIMIT 6`).all(),
    },
    recentClaims: db.prepare(`SELECT k.id, k.number, k.type, k.status, k.date, k.created_at, c.id AS client_id, c.name AS client_name
      FROM claims k JOIN clients c ON c.id = k.client_id WHERE k.status != 'Encerrado' ORDER BY k.created_at DESC, k.id DESC LIMIT 6`).all(),
    alerts: db.prepare(`SELECT m.id, m.text, m.category, m.username, m.created_at, c.id AS client_id, c.name AS client_name
      FROM comments m JOIN clients c ON c.id = m.client_id WHERE m.pinned = 1 ORDER BY m.created_at DESC LIMIT 6`).all(),
    cancellations: db.prepare(`SELECT p.id, p.number, p.branch, p.end_date, p.cancel_scheduled_date, p.cancel_reason, p.no_renew, c.id AS client_id, c.name AS client_name
      FROM policies p JOIN clients c ON c.id = p.client_id WHERE p.status = 'Em Vigor' AND (p.cancel_scheduled_date IS NOT NULL OR p.no_renew IS NOT NULL)
      ORDER BY COALESCE(p.cancel_scheduled_date, p.end_date) LIMIT 6`).all(),
    myDay: (() => {
      const closures = db.prepare("SELECT subjects FROM call_closures WHERE user_id = ? AND substr(created_at,1,10) = ?").all(user.id, today());
      const count = {};
      for (const { subjects } of closures) for (const x of subjects.split('; ')) count[x] = (count[x] || 0) + 1;
      return {
        calls: closures.length,
        files: one('SELECT COUNT(*) n FROM access_log WHERE user_id = ? AND substr(created_at,1,10) = ?', user.id, today()).n,
        comments: one('SELECT COUNT(*) n FROM comments WHERE user_id = ? AND substr(created_at,1,10) = ?', user.id, today()).n,
        operations: one('SELECT COUNT(*) n FROM audit WHERE user_id = ? AND client_id IS NOT NULL AND substr(created_at,1,10) = ?', user.id, today()).n,
        topSubjects: Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([subject, n]) => ({ subject, n })),
      };
    })(),
  };
});

// pesquisa rápida (barra superior)
// Pesquisa de clientes: por NIF, por n.º de apólice ou em todos os campos (pesquisa rápida)
route('GET', '/api/search', ANY, ({ query }) => {
  const q = str(query.q);
  const by = ['nif', 'policy', 'all'].includes(query.by) ? query.by : 'all';
  if (!q || q.length < 2) return { results: [] };
  let where, args;
  if (by === 'nif') {
    need(/^\d{9}$/.test(q), 'O NIF tem 9 dígitos');
    where = 'c.nif = ?'; args = [q];
  } else if (by === 'policy') {
    need(/^\d{5,12}$/.test(q), 'Indique o número da apólice (apenas dígitos)');
    where = 'c.id IN (SELECT client_id FROM policies WHERE number = ?)'; args = [q];
  } else {
    const like = `%${q}%`;
    where = `c.name LIKE ? OR c.nif = ? OR c.entity_number = ?
      OR c.id IN (SELECT client_id FROM policies WHERE number = ? OR REPLACE(UPPER(plate),'-','') = REPLACE(UPPER(?),'-',''))
      OR c.id IN (SELECT client_id FROM contacts WHERE value LIKE ?)`;
    args = [like, q, q, q, q, like];
  }
  const rows = db.prepare(`SELECT c.id, c.name, c.nif, c.entity_number, c.brand FROM clients c WHERE ${where} ORDER BY c.name LIMIT 20`).all(...args);
  const pols = db.prepare("SELECT number, branch, status FROM policies WHERE client_id = ? ORDER BY status = 'Anulada', start_date DESC");
  return { results: rows.map((r) => ({ ...r, policies: pols.all(r.id) })) };
});

// =====================================================================
// CLIENTES
// =====================================================================
route('GET', '/api/clients', ANY, ({ query }) => {
  const w = whereBuilder();
  const joins = [];
  if (query.plate || query.policy) {
    joins.push('JOIN policies p ON p.client_id = c.id');
    w.add('p.branch = ?', query.branch);
    w.add("REPLACE(UPPER(p.plate),'-','') = REPLACE(UPPER(?),'-','')", str(query.plate));
    w.add('p.number = ?', str(query.policy));
  }
  w.add('c.nif = ?', str(query.nif));
  w.add('c.name LIKE ?', query.name ? `%${String(query.name).trim()}%` : null);
  w.add('c.entity_number = ?', str(query.entity));
  w.add('c.birth_date = ?', str(query.birth));
  w.add('c.brand = ?', str(query.brand));
  if (query.postal) { joins.push('JOIN addresses ad ON ad.client_id = c.id'); w.add('ad.postal_code LIKE ?', `${String(query.postal).trim()}%`); }
  if (query.phone || query.email) {
    joins.push('JOIN contacts k ON k.client_id = c.id');
    w.add('k.value = ?', str(query.phone));
    w.add('LOWER(k.value) = LOWER(?)', str(query.email));
  }
  const filtered = w.vals.length > 0;
  const rows = db.prepare(`SELECT DISTINCT c.id, c.name, c.short_name, c.nif, c.birth_date, c.entity_number, c.brand, c.digital,
      (SELECT postal_code FROM addresses WHERE client_id = c.id ORDER BY main DESC, id LIMIT 1) AS postal_code
      FROM clients c ${joins.join(' ')} ${w.sql()} ORDER BY ${filtered ? 'c.name' : 'c.id DESC'} LIMIT 100`).all(...w.vals);
  return { clients: rows, filtered };
});

const CLIENT_FIELDS = {
  name: str, short_name: str, nif: str, birth_date: str, gender: str, marital_status: str, profession: str, activity: str,
  employees: (v) => (v === '' || v == null ? null : Number(v)), driver_license: str, license_date: str, eni: bool, gestual: bool,
  death_date: str, brand: str,
};

route('POST', '/api/clients', ANY, ({ user, body }) => {
  const name = str(body.name);
  need(name, 'Indique o nome do cliente');
  const nif = str(body.nif);
  if (nif) {
    need(validNif(nif), 'NIF inválido');
    if (db.prepare('SELECT 1 FROM clients WHERE nif = ?').get(nif)) fail(409, 'Já existe um cliente com este NIF');
  }
  const entity = String(nextSeq('entity', 4001050000));
  db.exec('BEGIN');
  try {
    const r = db.prepare('INSERT INTO clients (entity_number, name, short_name, nif, created_at, brand) VALUES (?,?,?,?,?,?)')
      .run(entity, name, str(body.short_name) || name.split(' ').filter(Boolean).slice(0, 1).concat(name.split(' ').slice(-1)).join(' ').toUpperCase(), nif, now(), str(body.brand) || 'OK! teleseguros');
    const id = Number(r.lastInsertRowid);
    updateFields('clients', id, body, CLIENT_FIELDS);
    if (str(body.address)) db.prepare('INSERT INTO addresses (client_id, type, description, postal_code, city, main, created_at) VALUES (?,?,?,?,?,1,?)')
      .run(id, 'Residência', str(body.address), str(body.postal_code), str(body.city), now());
    if (str(body.phone)) db.prepare("INSERT INTO contacts (client_id, type, value, main, created_at) VALUES (?, 'Telemóvel', ?, 1, ?)").run(id, str(body.phone), now());
    if (str(body.email)) db.prepare("INSERT INTO contacts (client_id, type, value, main, created_at) VALUES (?, 'Email', ?, 1, ?)").run(id, str(body.email), now());
    for (const t of CONSENT_TYPES) db.prepare("INSERT INTO consents (client_id, type, status, updated_at, updated_by) VALUES (?, ?, 'Pendente', ?, ?)").run(id, t, now(), user.username);
    db.exec('COMMIT');
    audit(user, id, 'Cliente criado', name);
    return { id };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});

route('GET', '/api/clients/:id', ANY, ({ user, params, query }) => {
  processPaymentSuspensions();
  const c = getClient(params.id);
  let accessId = null;
  if (query.log === '1') {
    const origin = ['Inbound', 'Outbound', 'Pesquisa', 'DC', 'Email'].includes(query.origin) ? query.origin : 'Pesquisa';
    accessId = Number(db.prepare('INSERT INTO access_log (client_id, origin, user_id, username, created_at) VALUES (?,?,?,?,?)').run(c.id, origin, user.id, user.username, now()).lastInsertRowid);
  }
  const all = (sql) => db.prepare(sql).all(c.id);
  return {
    client: c, accessId,
    addresses: all('SELECT * FROM addresses WHERE client_id = ? ORDER BY main DESC, id'),
    contacts: all('SELECT * FROM contacts WHERE client_id = ? ORDER BY main DESC, id'),
    consents: all('SELECT * FROM consents WHERE client_id = ? ORDER BY id'),
    campaigns: all('SELECT cc.protocol, k.name, k.active FROM client_campaigns cc JOIN campaigns k ON k.id = cc.campaign_id WHERE cc.client_id = ?'),
    comments: all('SELECT * FROM comments WHERE client_id = ? ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 5'),
    suspended: all("SELECT id, number, branch, suspended_at, suspended_reason FROM policies WHERE client_id = ? AND status = 'Suspensa' ORDER BY suspended_at"),
    policyNumbers: all('SELECT number, branch, status FROM policies WHERE client_id = ? ORDER BY status = \'Anulada\', start_date DESC'),
    access: all('SELECT a.*, k.subjects, k.notes AS close_notes FROM access_log a LEFT JOIN call_closures k ON k.access_id = a.id WHERE a.client_id = ? ORDER BY a.id DESC LIMIT 8'),
    closures: all('SELECT * FROM call_closures WHERE client_id = ? ORDER BY id DESC LIMIT 5'),
    operations: all('SELECT * FROM audit WHERE client_id = ? ORDER BY id DESC LIMIT 8'),
    receipts: all(`SELECT y.*, p.number AS policy_number FROM payments y LEFT JOIN policies p ON p.id = y.policy_id
                   WHERE y.client_id = ? AND y.status = 'Pendente' ORDER BY y.due_date`),
    counts: db.prepare(`SELECT
      (SELECT COUNT(*) FROM simulations WHERE client_id = $id) AS simulations,
      (SELECT COUNT(*) FROM policies WHERE client_id = $id AND status = 'Em Vigor') AS policies,
      (SELECT COUNT(*) FROM claims WHERE client_id = $id AND status != 'Encerrado') AS claims,
      (SELECT COUNT(*) FROM documents WHERE client_id = $id) AS documents,
      (SELECT COUNT(*) FROM processes WHERE client_id = $id AND status != 'Concluído') AS processes,
      (SELECT COUNT(*) FROM messages WHERE client_id = $id) AS messages,
      (SELECT COUNT(*) FROM comments WHERE client_id = $id) AS comments`).get({ id: c.id }),
  };
});

// Fecho da ficha: registo obrigatório do(s) assunto(s) da chamada
route('POST', '/api/clients/:id/close', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const subjects = [...new Set(Array.isArray(body.subjects) ? body.subjects.map(String) : [])];
  need(subjects.length > 0, 'Indique pelo menos um assunto da chamada');
  need(subjects.length <= 10 && subjects.every((s) => CALL_SUBJECT_LIST.includes(s)), 'Assunto da chamada inválido');
  const notes = str(body.notes);
  need(!notes || notes.length <= 1000, 'As notas não podem ter mais de 1000 caracteres');
  need(!subjects.includes('Outro') || notes, 'Descreva o assunto nas notas quando escolhe "Outro"');
  let access = null;
  if (body.access_id) {
    access = db.prepare('SELECT * FROM access_log WHERE id = ? AND client_id = ? AND user_id = ?').get(Number(body.access_id), c.id, user.id);
    need(access, 'Acesso à ficha inválido');
    need(!db.prepare('SELECT 1 FROM call_closures WHERE access_id = ?').get(access.id), 'Esta ficha já foi fechada');
  }
  const r = db.prepare('INSERT INTO call_closures (client_id, access_id, user_id, username, origin, subjects, notes, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(c.id, access?.id ?? null, user.id, user.username, access?.origin ?? null, subjects.join('; '), notes, now());
  audit(user, c.id, 'Ficha fechada', subjects.join('; ') + (notes ? ' · ' + notes : ''));
  return { id: Number(r.lastInsertRowid) };
});

route('PUT', '/api/clients/:id', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  if ('name' in body) need(str(body.name), 'O nome não pode ficar vazio');
  if ('nif' in body && str(body.nif)) {
    need(validNif(body.nif), 'NIF inválido');
    const dup = db.prepare('SELECT id FROM clients WHERE nif = ? AND id != ?').get(str(body.nif), c.id);
    if (dup) fail(409, 'Já existe outro cliente com este NIF');
  }
  updateFields('clients', c.id, body, CLIENT_FIELDS);
  audit(user, c.id, 'Dados do cliente alterados', null);
  return { ok: true };
});

route('DELETE', '/api/clients/:id', ADMIN, ({ user, params }) => {
  const c = getClient(params.id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(c.id);
  audit(user, null, 'Cliente eliminado', `${c.name} (${c.entity_number})`);
  return { ok: true };
});

// --- moradas ---
route('POST', '/api/clients/:id/addresses', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  need(str(body.description), 'Indique a morada');
  need(!str(body.postal_code) || /^\d{4}-\d{3}$/.test(str(body.postal_code)), 'Código postal deve ter o formato 0000-000');
  if (bool(body.main)) db.prepare('UPDATE addresses SET main = 0 WHERE client_id = ?').run(c.id);
  const r = db.prepare('INSERT INTO addresses (client_id, type, description, postal_code, city, main, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(c.id, str(body.type) || 'Residência', str(body.description), str(body.postal_code), str(body.city), bool(body.main), now());
  audit(user, c.id, 'Morada adicionada', str(body.description));
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/addresses/:id', ANY, ({ user, params, body }) => {
  const a = getRow('addresses', params.id, 'Morada');
  if ('description' in body) need(str(body.description), 'Indique a morada');
  if ('postal_code' in body) need(!str(body.postal_code) || /^\d{4}-\d{3}$/.test(str(body.postal_code)), 'Código postal deve ter o formato 0000-000');
  if (bool(body.main)) db.prepare('UPDATE addresses SET main = 0 WHERE client_id = ?').run(a.client_id);
  updateFields('addresses', a.id, body, { type: str, description: str, postal_code: str, city: str, main: bool });
  audit(user, a.client_id, 'Morada alterada', str(body.description) || a.description);
  return { ok: true };
});
route('DELETE', '/api/addresses/:id', ANY, ({ user, params }) => {
  const a = getRow('addresses', params.id, 'Morada');
  db.prepare('DELETE FROM addresses WHERE id = ?').run(a.id);
  audit(user, a.client_id, 'Morada removida', a.description);
  return { ok: true };
});

// --- contactos ---
function validateContact(type, value) {
  need(['Telemóvel', 'Telefone', 'Email'].includes(type), 'Tipo de contacto inválido');
  need(value, 'Indique o contacto');
  if (type === 'Email') need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), 'Email inválido');
  else need(/^\+?\d{9,15}$/.test(value.replace(/\s/g, '')), 'Número de telefone inválido');
}
route('POST', '/api/clients/:id/contacts', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const type = str(body.type), value = str(body.value);
  validateContact(type, value);
  const r = db.prepare('INSERT INTO contacts (client_id, type, value, main, schedule, created_at) VALUES (?,?,?,?,?,?)')
    .run(c.id, type, type === 'Email' ? value : value.replace(/\s/g, ''), bool(body.main), str(body.schedule), now());
  audit(user, c.id, 'Contacto adicionado', `${type}: ${value}`);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/contacts/:id', ANY, ({ user, params, body }) => {
  const k = getRow('contacts', params.id, 'Contacto');
  validateContact(str(body.type) || k.type, str(body.value) || k.value);
  updateFields('contacts', k.id, body, { type: str, value: str, main: bool, schedule: str });
  audit(user, k.client_id, 'Contacto alterado', str(body.value) || k.value);
  return { ok: true };
});
route('DELETE', '/api/contacts/:id', ANY, ({ user, params }) => {
  const k = getRow('contacts', params.id, 'Contacto');
  db.prepare('DELETE FROM contacts WHERE id = ?').run(k.id);
  audit(user, k.client_id, 'Contacto removido', `${k.type}: ${k.value}`);
  return { ok: true };
});

// --- simulações / propostas ---
route('GET', '/api/clients/:id/simulations', ANY, ({ params, query }) => {
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('s.client_id = ?', c.id);
  w.add('s.branch = ?', str(query.branch));
  w.add('s.number = ?', str(query.number));
  w.add("REPLACE(UPPER(s.plate),'-','') = REPLACE(UPPER(?),'-','')", str(query.plate));
  w.add('s.status = ?', str(query.status));
  w.add('s.source = ?', str(query.source));
  w.add('substr(s.edited_at,1,10) >= ?', str(query.from));
  w.add('substr(s.edited_at,1,10) <= ?', str(query.to));
  return { simulations: db.prepare(`SELECT s.*, p.number AS policy_number FROM simulations s LEFT JOIN policies p ON p.id = s.policy_id ${w.sql()} ORDER BY s.edited_at DESC`).all(...w.vals) };
});
route('POST', '/api/clients/:id/simulations', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const branch = str(body.branch), product = str(body.product);
  need(BRANCHES.includes(branch), 'Ramo inválido');
  need(PRODUCTS[branch][product] != null, 'Produto inválido para este ramo');
  if (branch === 'Automóvel') need(str(body.plate), 'Indique a matrícula');
  let premium = computePremium(branch, product, c);
  if (bool(body.family)) premium = money(premium * 0.9);
  if (str(body.campaign)) premium = money(premium * 0.95);
  const number = `S${nextSeq('simulation', 26000000)}`;
  const r = db.prepare(`INSERT INTO simulations (number, client_id, branch, product, status, plate, protocol, campaign, premium, family, source, created_by, edited_at)
    VALUES (?,?,?,?, 'Pendente', ?,?,?,?,?, 'Praxis', ?, ?)`)
    .run(number, c.id, branch, product, str(body.plate)?.toUpperCase() ?? null, str(body.protocol), str(body.campaign), premium, bool(body.family), user.id, now());
  audit(user, c.id, bool(body.family) ? 'Simulação família criada' : 'Simulação criada', `${number} · ${product} · €${premium}`);
  return { id: Number(r.lastInsertRowid), number, premium };
});
// --- tarifador ok! auto ---
const okMeta = () => ({
  plans: OK.PLANS, planInfo: OK.PLAN_INFO, coverages: OK.COVERAGES, dpKeys: OK.DP_KEYS,
  optionals: OK.OPTIONALS.map(({ key, label, plans, choices, dp }) => ({ key, label, plans, choices, dp: !!dp })),
  vehicleTypes: OK.VEHICLE_TYPES, fuels: OK.FUELS, fractionings: OK.FRACTIONINGS, payments: OK.PAYMENT_METHODS,
  franchises: OK.FRANCHISES, careFranchises: OK.CARE_FRANCHISES, discounts: OK.DISCOUNTS.map(({ key, label }) => ({ key, label })),
  bonusMalus: OK.BONUS_MALUS, bonusEntry: OK.BONUS_ENTRY_LEVEL, guide: OK.GUIDE, calibration: OK.calibrationReport(today()),
});
route('GET', '/api/okauto/meta', ANY, () => okMeta());
route('POST', '/api/okauto/quote', ANY, ({ body }) => OK.quoteOkAuto(body || {}, { today: today() }));
route('POST', '/api/clients/:id/okauto/simulations', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const plan = str(body.plan);
  need(OK.PLANS.includes(plan), 'Plano inválido');
  const q = OK.quoteOkAuto(body.input || {}, { today: today() });
  need(q.ok, (q.errors || []).join(' ') || 'Dados incompletos');
  const pl = q.plans[plan];
  need(pl.available, pl.reasons.join(' '));
  const plate = str(body.input?.plate)?.toUpperCase().replace(/\s+/g, '') ?? null;
  need(plate && /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/.test(plate), 'Indique a matrícula (formato AA-00-AA)');
  const number = `S${nextSeq('simulation', 26000000)}`;
  const details = { input: { ...q.input, plate }, plan: pl, factors: q.factors, bonus: q.bonus, zone: q.zone, driverBirth: str(body.input?.driverBirth), licenseDate: str(body.input?.licenseDate), quotedAt: now() };
  const disc = q.input.discount ? OK.DISCOUNTS.find((x) => x.key === q.input.discount)?.label : null;
  const r = db.prepare(`INSERT INTO simulations (number, client_id, branch, product, status, plate, protocol, campaign, premium, family, source, created_by, edited_at, details)
    VALUES (?,?, 'Automóvel', ?, 'Pendente', ?,?,?,?, 0, 'Praxis', ?, ?, ?)`)
    .run(number, c.id, pl.product, plate, str(body.protocol), disc, pl.annualPaid, user.id, now(), JSON.stringify(details));
  audit(user, c.id, 'Simulação ok! auto criada', `${number} · ${pl.product} · ${pl.annualPaid.toFixed(2)} €/ano (${q.input.fractioning})`);
  return { id: Number(r.lastInsertRowid), number, premium: pl.annualPaid, plan: pl };
});

route('PUT', '/api/simulations/:id', ANY, ({ user, params, body }) => {
  const s = getRow('simulations', params.id, 'Simulação');
  if (s.status === 'Convertida') fail(400, 'Esta simulação já foi convertida em apólice');
  need(['Pendente', 'Aceite', 'Rejeitada'].includes(body.status), 'Estado inválido');
  db.prepare('UPDATE simulations SET status = ?, edited_at = ? WHERE id = ?').run(body.status, now(), s.id);
  audit(user, s.client_id, 'Simulação atualizada', `${s.number} → ${body.status}`);
  return { ok: true };
});
route('POST', '/api/simulations/:id/convert', ANY, ({ user, params, body }) => {
  const s = getRow('simulations', params.id, 'Simulação');
  if (s.status === 'Convertida') fail(400, 'Esta simulação já foi convertida');
  if (s.status === 'Rejeitada') fail(400, 'Não é possível converter uma simulação rejeitada');
  const c = getClient(s.client_id);
  const start = str(body.start_date) || today();
  need(/^\d{4}-\d{2}-\d{2}$/.test(start), 'Data de início inválida');
  const number = String(nextSeq('policy', 900110000));
  db.exec('BEGIN');
  try {
    const r = db.prepare(`INSERT INTO policies (number, client_id, branch, plate, driver_name, start_date, end_date, product, status, annual_value, protocol, campaign, created_at)
      VALUES (?,?,?,?,?,?,?,?, 'Em Vigor', ?,?,?,?)`).run(number, c.id, s.branch, s.plate, s.branch === 'Automóvel' ? (c.short_name || c.name) : null,
      start, addYears(start, 1), s.product, s.premium, s.protocol, s.campaign, now());
    const pid = Number(r.lastInsertRowid);
    const fractioning = POLICY_OPTIONS.fractioning.includes(body.fractioning) ? body.fractioning : 'Anual';
    db.prepare(`UPDATE policies SET formalized_at = ?, mediation_account = ?, bonus_table = ?, collection_account = '430036 - Multibanco', renewal_mode = 'Automático',
      fractioning = ?, channel = 'Telefone', tariff_version = ?, driver_birth_date = ?, driver_license = ?, driver_license_date = ?, vehicle_use = ? WHERE id = ?`)
      .run(now(), MEDIATION_ACCOUNT, s.branch === 'Automóvel' ? 'TBM001' : null, fractioning, TARIFF_VERSION,
        ...(s.branch === 'Automóvel' ? [c.birth_date, c.driver_license, c.license_date, 'Particular'] : [null, null, null, null]), pid);
    // simulação do tarifador ok! auto: veículo, condutor, bónus/malus, fracionamento, opcionais e vistoria
    const det = s.details ? JSON.parse(s.details) : null;
    let extraTerms = '', fractions = [[s.premium, start]];
    if (det?.input && OK.productPlan(s.product)) {
      const inp = det.input, pl = det.plan;
      db.prepare(`UPDATE policies SET vehicle_make = ?, vehicle_model = ?, vehicle_version = ?, vehicle_first_reg = ?, vehicle_value = ?, vehicle_use = 'Particular',
        driver_birth_date = COALESCE(?, driver_birth_date), driver_license_date = COALESCE(?, driver_license_date), bonus_malus = ?, fractioning = ?,
        collection_account = ? WHERE id = ?`).run(inp.make || null, inp.model || null, inp.version || null, inp.firstReg || null, inp.value || null,
        det.driverBirth || null, det.licenseDate || null, (det.bonus?.pct ?? 100) - 100, inp.fractioning,
        inp.payment === 'Débito direto' ? '430035 - EFT' : inp.payment === 'Cartão' ? '430037 - Cartão de Crédito' : '430036 - Multibanco', pid);
      extraTerms = `\nFranquia danos próprios: ${s.product.endsWith('care') ? inp.careFranchise : inp.franchise} € · Fracionamento ${inp.fractioning} · Bónus/Malus nível ${det.bonus?.level} (${det.bonus?.pct}%)`
        + pl.parts.filter((x) => x.label.startsWith('Opcional:')).map((x) => `\n${x.label}`).join('');
      fractions = Array.from({ length: pl.fractions }, (_, k) => [pl.perFraction, addMonthsStr(start, (12 / pl.fractions) * k)]);
      if (pl.needsInspection) {
        db.prepare("INSERT INTO inspections (client_id, policy_id, scheduled_at, location, status, notes, created_at) VALUES (?,?,NULL,'App AutoDigital','Por agendar',?,?)")
          .run(c.id, pid, 'Vistoria prévia obrigatória (coberturas de danos próprios, exceto 0 km). O cliente faz a vistoria na app AutoDigital; as coberturas de danos próprios só produzem efeitos após a vistoria.', now());
      }
    }
    addTerms(pid, 'Novo Negócio', `Contratação ${s.branch} · ${s.product} (simulação ${s.number})${extraTerms}`, start, user);
    db.prepare("UPDATE simulations SET status = 'Convertida', policy_id = ?, edited_at = ? WHERE id = ?").run(pid, now(), s.id);
    createDocument(c, { id: pid, number, branch: s.branch }, 'Condições Particulares', 'Nova Apólice');
    createDocument(c, { id: pid, number, branch: s.branch }, 'Fatura', 'Nova Apólice');
    if (s.branch === 'Automóvel') createDocument(c, { id: pid, number, branch: s.branch }, 'Carta Verde', 'Nova Apólice');
    fractions.forEach(([amount, due], k) => db.prepare("INSERT INTO payments (client_id, policy_id, reference, amount, due_date, status, created_at) VALUES (?,?,?,?,?, 'Pendente', ?)")
      .run(c.id, pid, `REC${number}${String(k + 1).padStart(2, '0')}`, amount, due, now()));
    db.exec('COMMIT');
    audit(user, c.id, 'Simulação convertida em apólice', `${s.number} → apólice ${number}${fractions.length > 1 ? ` · ${fractions.length} recibos` : ''}`);
    return { policyId: pid, number };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});

// --- apólices ---
route('GET', '/api/clients/:id/policies', ANY, ({ params, query }) => {
  processScheduledCancellations();
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('client_id = ?', c.id);
  w.add('branch = ?', str(query.branch));
  w.add('number = ?', str(query.number));
  w.add("REPLACE(UPPER(plate),'-','') = REPLACE(UPPER(?),'-','')", str(query.plate));
  if (query.status === 'Ativas') w.raw("status IN ('Em Vigor', 'Suspensa')"); else w.add('status = ?', str(query.status));
  return { policies: db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM policy_terms t WHERE t.policy_id = p.id AND t.accepted_at IS NULL) AS pending_terms
    FROM policies p ${w.sql()} ORDER BY start_date DESC`).all(...w.vals) };
});
route('GET', '/api/policies/:id', ANY, ({ params }) => {
  const p = getRow('policies', params.id, 'Apólice');
  return {
    policy: p,
    client: db.prepare('SELECT id, name, nif, entity_number FROM clients WHERE id = ?').get(p.client_id),
    payments: db.prepare('SELECT * FROM payments WHERE policy_id = ? ORDER BY due_date DESC').all(p.id),
    claims: db.prepare('SELECT * FROM claims WHERE policy_id = ? ORDER BY date DESC').all(p.id),
    terms: db.prepare('SELECT * FROM policy_terms WHERE policy_id = ? ORDER BY created_at DESC, id DESC').all(p.id),
  };
});
// --- aceitação de termos e condições ---
function addTerms(policyId, type, description, startDate, user, accepted = null) {
  const r = db.prepare('INSERT INTO policy_terms (policy_id, type, description, created_at, start_date, accepted_at, accepted_via, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(policyId, type, description, now(), startDate, accepted ? now() : null, accepted, user?.username ?? 'Sistema');
  return Number(r.lastInsertRowid);
}
const TERM_FIELDS = {
  product: 'Produto', plate: 'Matrícula', driver_name: 'Condutor', fractioning: 'Fracionamento', collection_account: 'Conta de cobrança', iban: 'IBAN',
  renewal_mode: 'Modo de renovação', no_renew: 'Não renova', bonus_table: 'Tabela de bónus', protocol: 'Protocolo', campaign: 'Campanha',
};
const maskIban = (v) => (v ? `${v.slice(0, 4)} •••• ${v.slice(-4)}` : '-');
const oneOf = (list, label) => (v) => { const x = str(v); need(x === null || list.includes(x), `${label} inválido(a)`); return x; };

route('PUT', '/api/policies/:id', ANY, ({ user, params, body }) => {
  const p = getRow('policies', params.id, 'Apólice');
  need(p.status !== 'Anulada', 'Não é possível alterar uma apólice anulada');
  if ('product' in body) need(PRODUCTS[p.branch][body.product] != null, 'Produto inválido para este ramo');
  if ('plate' in body && body.plate) body.plate = String(body.plate).toUpperCase();
  if ('iban' in body) {
    body.iban = normIban(body.iban) || null;
    need(!body.iban || validIban(body.iban), 'IBAN inválido (verifique os dígitos de controlo)');
  }
  const conv = {
    plate: str, driver_name: str, product: str, protocol: str, campaign: str, iban: str,
    fractioning: oneOf(POLICY_OPTIONS.fractioning, 'Fracionamento'), renewal_mode: oneOf(POLICY_OPTIONS.renewalMode, 'Modo de renovação'),
    no_renew: oneOf(POLICY_OPTIONS.noRenew, 'Motivo de não renovação'), collection_account: oneOf(POLICY_OPTIONS.collection, 'Conta de cobrança'),
    channel: oneOf(POLICY_OPTIONS.channel, 'Canal'), info_source: oneOf(POLICY_OPTIONS.infoSource, 'Fonte de informação'),
    bonus_table: oneOf(POLICY_OPTIONS.bonusTables, 'Tabela de bónus'),
  };
  const next = { ...p };
  for (const k of Object.keys(conv)) if (k in body) next[k] = conv[k](body[k]);
  need(next.fractioning, 'Indique o fracionamento');
  need(next.renewal_mode, 'Indique o modo de renovação');
  if (next.collection_account?.endsWith('EFT')) need(next.iban, 'A cobrança por EFT (débito direto) exige um IBAN');
  const start = str(body.effective_date) || today();
  need(/^\d{4}-\d{2}-\d{2}$/.test(start), 'Data de início da alteração inválida');
  const changes = Object.entries(TERM_FIELDS).filter(([k]) => (p[k] ?? null) !== (next[k] ?? null))
    .map(([k, label]) => (k === 'iban' ? `${label}: ${maskIban(p[k])} → ${maskIban(next[k])}` : `${label}: ${p[k] ?? '-'} → ${next[k] ?? '-'}`));
  db.exec('BEGIN');
  try {
    updateFields('policies', p.id, next, Object.fromEntries(Object.keys(conv).map((k) => [k, (v) => v])));
    const termsId = changes.length ? addTerms(p.id, 'Alteração', changes.join('\n'), start, user) : null;
    db.exec('COMMIT');
    audit(user, p.client_id, 'Apólice alterada', `${p.number}${changes.length ? ' · ' + changes.join('; ') : ''}`);
    return { ok: true, termsId };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});

function getTerms(id) {
  const t = getRow('policy_terms', id, 'Registo de termos');
  return { t, p: getRow('policies', t.policy_id, 'Apólice') };
}
route('POST', '/api/policy-terms/:id/accept', ANY, ({ user, params, body }) => {
  const { t, p } = getTerms(params.id);
  need(!t.accepted_at, 'Estes termos já foram aceites');
  const via = str(body.via);
  need(POLICY_OPTIONS.termsAccept.includes(via), 'Indique como foi feita a aceitação');
  db.prepare('UPDATE policy_terms SET accepted_at = ?, accepted_via = ? WHERE id = ?').run(now(), via, t.id);
  audit(user, p.client_id, 'Termos e condições aceites', `${p.number} · ${t.type} · ${via}`);
  return { ok: true };
});
route('POST', '/api/policy-terms/:id/send', ANY, ({ user, params, body }) => {
  const { t, p } = getTerms(params.id);
  need(!t.accepted_at, 'Estes termos já foram aceites');
  const channel = str(body.channel);
  need(['Email', 'SMS'].includes(channel), 'Canal inválido');
  const contact = db.prepare('SELECT value FROM contacts WHERE client_id = ? AND type = ? ORDER BY main DESC LIMIT 1').get(p.client_id, channel === 'Email' ? 'Email' : 'Telemóvel')?.value;
  need(contact, `O cliente não tem ${channel === 'Email' ? 'email' : 'telemóvel'} registado`);
  db.prepare('INSERT INTO messages (client_id, channel, direction, recipient, subject, body, user_id, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(p.client_id, channel, 'Enviada', contact, `Aceitação de Termos e Condições — apólice ${p.number}`,
      `Pedido de aceitação (${t.type}, início ${t.start_date}). Aceda à Área de Cliente para rever e aceitar as condições.${t.description ? '\n' + t.description : ''}`, user.id, now());
  db.prepare('UPDATE policy_terms SET last_sent_at = ? WHERE id = ?').run(now(), t.id);
  audit(user, p.client_id, 'Pedido de aceitação de termos enviado', `${p.number} · ${channel} para ${contact}`);
  return { ok: true, recipient: contact };
});
route('POST', '/api/policies/:id/renew', ANY, ({ user, params }) => {
  const p = getRow('policies', params.id, 'Apólice');
  if (p.status === 'Anulada') fail(400, 'Não é possível renovar uma apólice anulada');
  if (p.status === 'Suspensa') fail(400, suspendedMsg(p, 'a poder renovar'));
  if (p.no_renew) fail(400, `Esta apólice está marcada para não renovar (${p.no_renew}). Retire essa indicação em "Alterar" para a poder renovar.`);
  const c = getClient(p.client_id);
  const start = p.end_date, end = addYears(p.end_date, Math.max(1, Math.round((p.renewal_term || 12) / 12)));
  const value = money(p.annual_value * 1.02);
  db.prepare("UPDATE policies SET start_date = ?, end_date = ?, annual_value = ?, status = 'Em Vigor' WHERE id = ?").run(start, end, value, p.id);
  createDocument(c, p, 'Fatura', 'Renovação');
  if (p.branch === 'Automóvel') createDocument(c, p, 'Carta Verde', 'Renovação');
  db.prepare("INSERT OR IGNORE INTO payments (client_id, policy_id, reference, amount, due_date, status, created_at) VALUES (?,?,?,?,?, 'Pendente', ?)")
    .run(c.id, p.id, `REC${p.number}R${start.replace(/-/g, '')}`, value, start, now());
  addTerms(p.id, 'Renovação', `Renovação de ${start} a ${end} · prémio ${p.annual_value} € → ${value} €`, start, user, p.renewal_mode === 'Automático' ? 'Renovação automática' : null);
  audit(user, c.id, 'Apólice renovada', `${p.number} até ${end} · €${value}`);
  return { ok: true, end_date: end, annual_value: value };
});
// --- anulação / não renovação ---
const dayDiff = (a, b) => Math.round((new Date(b.slice(0, 10) + 'T12:00:00') - new Date(a.slice(0, 10) + 'T12:00:00')) / 864e5);
function refundCalc(p, date, refundType) {
  const total = Math.max(1, dayDiff(p.start_date, p.end_date));
  const usedDays = Math.min(total, Math.max(0, dayDiff(p.start_date, date)));
  const premiumUsed = money((p.annual_value * usedDays) / total);
  // pago na anuidade, descontando estornos já feitos (os estornos têm data = data de efeito da anulação)
  const paid = money(db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE policy_id = ? AND (status = 'Pago' OR status IN ('Estorno', 'Devolvido')) AND due_date >= ?").get(p.id, p.start_date).s);
  const sum = (op) => db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS s FROM payments WHERE policy_id = ? AND status = 'Pendente' AND due_date ${op} ?`).get(p.id, date);
  const after = sum('>'), before = sum('<=');
  // Pro-Rata: acerta-se o prémio pelos dias usados — anulam-se todos os recibos pendentes e o cliente recebe a diferença
  // (estorno) ou paga só o que falta do prémio consumido (novo recibo). Sem estorno: os recibos já vencidos mantêm-se em dívida.
  const proRata = refundType === 'Pro-Rata';
  const balance = money(paid - premiumUsed);
  return {
    usedDays, totalDays: total, premiumUsed, paid,
    refund: proRata ? Math.max(0, balance) : 0,
    owed: proRata ? Math.max(0, -balance) : 0,
    pendingCancelled: proRata ? { n: after.n + before.n, total: money(after.s + before.s) } : { n: after.n, total: money(after.s) },
    pendingKept: proRata ? { n: 0, total: 0 } : { n: before.n, total: money(before.s) },
  };
}
function planCancellation(p, body) {
  need(p.status === 'Em Vigor' || p.status === 'Suspensa', 'Só é possível anular apólices em vigor ou suspensas');
  const reason = str(body.reason);
  const def = findCancelReason(p.branch, reason);
  need(def, 'Escolha o motivo da anulação');
  const kind = body.kind === 'Não Renovação' ? 'Não Renovação' : 'Anulação';
  const mode = kind === 'Não Renovação' ? 'Não Renovação' : body.mode === 'Diferido' ? 'Diferido' : 'Imediato';
  need(!p.cancel_scheduled_date, `Esta apólice já tem uma anulação agendada para ${p.cancel_scheduled_date}. Desfaça-a primeiro.`);
  let date;
  if (kind === 'Não Renovação') {
    need(!p.no_renew, `A apólice já está marcada para não renovar (${p.no_renew})`);
    need(p.end_date > today(), `A apólice venceu a ${p.end_date}; use a anulação`);
    date = p.end_date;
  } else if (mode === 'Imediato') {
    // até hoje (ou até ao vencimento, se já passou); se a anuidade ainda não começou, anula-se desde o início
    let maxDate = p.end_date < today() ? p.end_date : today();
    if (maxDate < p.start_date) maxDate = p.start_date;
    date = str(body.date) || maxDate;
    need(isDate(date) && date >= p.start_date && date <= maxDate, maxDate === p.start_date
      ? `A anuidade ainda não começou: a anulação imediata produz efeitos desde o início (${p.start_date})`
      : `Na anulação imediata a data tem de estar entre ${p.start_date} e ${maxDate === today() ? 'hoje' : maxDate}`);
  } else {
    date = str(body.date);
    need(isDate(date) && date > today() && date < p.end_date, `Na anulação diferida a data tem de ser depois de hoje e antes de ${p.end_date}`);
  }
  const refundType = kind === 'Não Renovação' ? 'Sem estorno' : body.refund_type === 'Sem estorno' ? 'Sem estorno' : 'Pro-Rata';
  const notes = str(body.notes);
  need(!notes || notes.length <= 1000, 'As observações não podem ter mais de 1000 caracteres');
  if (def.notes) need(notes, 'Descreva o motivo nas observações');
  return { reason, def, kind, mode, date, refundType, notes, calc: refundCalc(p, date, refundType) };
}
// aplica a anulação (imediata, ou diferida quando chega a data)
function executeCancellation(p, { date, reason, refundType, mode, notes, user }) {
  const calc = refundCalc(p, date, refundType);
  db.prepare(`UPDATE policies SET status = 'Anulada', cancel_reason = ?, cancel_date = ?, cancel_mode = ?, cancel_refund_type = ?, cancel_notes = ?,
    cancel_scheduled_date = NULL, cancelled_by = ? WHERE id = ?`).run(reason, date, mode, refundType, notes ?? null, user?.username ?? 'Sistema', p.id);
  if (refundType === 'Pro-Rata') db.prepare("UPDATE payments SET status = 'Anulado' WHERE policy_id = ? AND status = 'Pendente'").run(p.id);
  else db.prepare("UPDATE payments SET status = 'Anulado' WHERE policy_id = ? AND status = 'Pendente' AND due_date > ?").run(p.id, date);
  const stamp = now().replace(/\D/g, '').slice(2, 14);
  let refundRef = null, owedRef = null;
  if (calc.refund > 0) {
    refundRef = `EST${p.number}${stamp}`;
    db.prepare("INSERT INTO payments (client_id, policy_id, reference, amount, due_date, status, created_at) VALUES (?,?,?,?,?, 'Estorno', ?)")
      .run(p.client_id, p.id, refundRef, -calc.refund, date, now());
  }
  if (calc.owed > 0) {
    owedRef = `REC${p.number}C${stamp}`;
    db.prepare("INSERT INTO payments (client_id, policy_id, reference, amount, due_date, status, created_at) VALUES (?,?,?,?,?, 'Pendente', ?)")
      .run(p.client_id, p.id, owedRef, calc.owed, today(), now());
  }
  return { ...calc, refundRef, owedRef };
}
// --- falta de pagamento: recibo por pagar há mais de 1 mês e 10 dias => apólice suspensa (sem cobertura) até pagar ---
function graceCutoff() {
  const d = new Date(today() + 'T12:00:00');
  d.setMonth(d.getMonth() - 1);
  d.setDate(d.getDate() - 10);
  return fmtDateTime(d).slice(0, 10); // recibos com vencimento ANTES desta data suspendem a apólice
}
function processPaymentSuspensions() {
  const cutoff = graceCutoff();
  const rows = db.prepare(`SELECT p.id, p.number, p.client_id,
      (SELECT reference FROM payments WHERE policy_id = p.id AND status = 'Pendente' AND due_date < ? ORDER BY due_date LIMIT 1) AS ref,
      (SELECT MIN(due_date) FROM payments WHERE policy_id = p.id AND status = 'Pendente' AND due_date < ?) AS oldest
    FROM policies p WHERE p.status = 'Em Vigor'
      AND EXISTS (SELECT 1 FROM payments y WHERE y.policy_id = p.id AND y.status = 'Pendente' AND y.due_date < ?)`).all(cutoff, cutoff, cutoff);
  for (const p of rows) {
    const reason = `Falta de pagamento: recibo ${p.ref} vencido a ${p.oldest}`;
    db.prepare("UPDATE policies SET status = 'Suspensa', suspended_at = ?, suspended_reason = ? WHERE id = ?").run(now(), reason, p.id);
    audit(null, p.client_id, 'Apólice suspensa — sem cobertura', `${p.number} · ${reason} (mais de 1 mês e 10 dias)`);
  }
  return rows.length;
}
// repõe a cobertura quando já não há recibos em atraso além do prazo
function restoreCoverageIfPaid(policyId, user) {
  const p = db.prepare('SELECT * FROM policies WHERE id = ?').get(policyId);
  if (!p || p.status !== 'Suspensa') return null;
  if (db.prepare("SELECT 1 FROM payments WHERE policy_id = ? AND status = 'Pendente' AND due_date < ?").get(p.id, graceCutoff())) return null;
  db.prepare("UPDATE policies SET status = 'Em Vigor', suspended_at = NULL, suspended_reason = NULL WHERE id = ?").run(p.id);
  audit(user, p.client_id, 'Cobertura reposta', `${p.number} · pagamento regularizado`);
  return p.number;
}
const suspendedMsg = (p, what) => `A apólice ${p.number} está sem cobertura por falta de pagamento (${(p.suspended_reason || '').replace(/^Falta de pagamento: /, '')}). Regularize o pagamento para ${what}.`;

// anulações diferidas que chegaram à data e apólices "não renova" que chegaram ao vencimento
function processScheduledCancellations() {
  processPaymentSuspensions();
  const due = db.prepare("SELECT * FROM policies WHERE status IN ('Em Vigor', 'Suspensa') AND cancel_scheduled_date IS NOT NULL AND cancel_scheduled_date <= ?").all(today());
  for (const p of due) {
    db.exec('BEGIN');
    try {
      const r = executeCancellation(p, { date: p.cancel_scheduled_date, reason: p.cancel_reason, refundType: p.cancel_refund_type || 'Pro-Rata', mode: 'Diferido', notes: p.cancel_notes, user: { username: p.cancelled_by || 'Sistema' } });
      db.exec('COMMIT');
      audit(null, p.client_id, 'Anulação diferida executada', `${p.number} · ${p.cancel_reason}${r.refund ? ` · estorno ${r.refund.toFixed(2)} €` : ''}`);
    } catch (e) { db.exec('ROLLBACK'); console.error(e); }
  }
  const lapsed = db.prepare("SELECT * FROM policies WHERE status IN ('Em Vigor', 'Suspensa') AND no_renew IS NOT NULL AND end_date <= ?").all(today());
  for (const p of lapsed) {
    db.prepare(`UPDATE policies SET status = 'Anulada', cancel_reason = ?, cancel_date = ?, cancel_mode = 'Não Renovação', cancel_refund_type = 'Sem estorno' WHERE id = ?`)
      .run(`Não renovação: ${p.no_renew}`, p.end_date, p.id);
    db.prepare("UPDATE payments SET status = 'Anulado' WHERE policy_id = ? AND status = 'Pendente' AND due_date >= ?").run(p.id, p.end_date);
    audit(null, p.client_id, 'Apólice terminada (não renovação)', `${p.number} · ${p.no_renew}`);
  }
}

route('POST', '/api/policies/:id/cancel/preview', ANY, ({ params, body }) => {
  const p = getRow('policies', params.id, 'Apólice');
  const r = planCancellation(p, body);
  return { kind: r.kind, mode: r.mode, date: r.date, refundType: r.refundType, proof: r.def.proof || null, ...r.calc };
});
route('POST', '/api/policies/:id/cancel', ANY, ({ user, params, body }) => {
  const p = getRow('policies', params.id, 'Apólice');
  const r = planCancellation(p, body);
  const c = getClient(p.client_id);
  let result = {};
  db.exec('BEGIN');
  try {
    if (r.kind === 'Não Renovação') {
      db.prepare('UPDATE policies SET no_renew = ?, cancel_notes = ?, cancelled_by = ? WHERE id = ?').run(r.reason, r.notes, user.username, p.id);
    } else if (r.mode === 'Diferido') {
      db.prepare(`UPDATE policies SET cancel_scheduled_date = ?, cancel_reason = ?, cancel_mode = 'Diferido', cancel_refund_type = ?, cancel_notes = ?, cancelled_by = ? WHERE id = ?`)
        .run(r.date, r.reason, r.refundType, r.notes, user.username, p.id);
    } else {
      result = executeCancellation(p, { date: r.date, reason: r.reason, refundType: r.refundType, mode: 'Imediato', notes: r.notes, user });
    }
    const context = r.kind === 'Não Renovação' ? 'Não Renovação' : r.mode === 'Diferido' ? 'Anulação diferida' : 'Anulação';
    const docs = [];
    const letter = createDocument(c, p, 'Carta de Cancelamento', context);
    if (bool(body.retain_letter)) db.prepare('UPDATE documents SET retained = 1 WHERE id = ?').run(letter);
    docs.push('Carta de Cancelamento' + (bool(body.retain_letter) ? ' (retida)' : ''));
    if (p.branch === 'Automóvel') {
      const cert = createDocument(c, p, 'Certificado de Tarifação', context);
      if (bool(body.retain_certificate)) db.prepare('UPDATE documents SET retained = 1 WHERE id = ?').run(cert);
      docs.push('Certificado de Tarifação' + (bool(body.retain_certificate) ? ' (retido)' : ''));
    }
    let processNumber = null;
    if (r.def.proof && !bool(body.proof_received)) {
      processNumber = `PR${nextSeq('process', 7000000)}`;
      db.prepare(`INSERT INTO processes (number, client_id, policy_id, branch, process_type, task, task_number, status, priority, notes, created_at, expires_at)
        VALUES (?,?,?,?, 'Anulação', ?, ?, 'Aberto', 'Normal', ?, ?, ?)`)
        .run(processNumber, c.id, p.id, p.branch, `Recolher comprovativo: ${r.def.proof}`, `T${nextSeq('task', 9000000)}`, `${r.kind} da apólice ${p.number} · ${r.reason}`, now(), addDays(today(), 10));
    }
    db.exec('COMMIT');
    const what = r.kind === 'Não Renovação' ? `Não renovação a ${r.date}` : r.mode === 'Diferido' ? `Anulação agendada para ${r.date}` : `Anulada a ${r.date}`;
    audit(user, c.id, r.kind === 'Não Renovação' ? 'Apólice marcada para não renovar' : r.mode === 'Diferido' ? 'Anulação de apólice agendada' : 'Apólice anulada',
      `${p.number} · ${r.reason} · ${what}${result.refund ? ` · estorno ${result.refund.toFixed(2)} €` : ''}`);
    return { ok: true, kind: r.kind, mode: r.mode, date: r.date, refund: result.refund || 0, refundRef: result.refundRef || null, owed: result.owed || 0, owedRef: result.owedRef || null, documents: docs, process: processNumber };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
route('POST', '/api/policies/:id/cancel/undo', ANY, ({ user, params }) => {
  const p = getRow('policies', params.id, 'Apólice');
  need(p.status === 'Em Vigor' || p.status === 'Suspensa', 'A apólice já está anulada. Para a repor use "Reativar" (supervisor).');
  if (p.cancel_scheduled_date) {
    db.prepare('UPDATE policies SET cancel_scheduled_date = NULL, cancel_reason = NULL, cancel_mode = NULL, cancel_refund_type = NULL, cancel_notes = NULL, cancelled_by = NULL WHERE id = ?').run(p.id);
    audit(user, p.client_id, 'Anulação agendada desfeita', `${p.number} · estava agendada para ${p.cancel_scheduled_date}`);
  } else if (p.no_renew) {
    db.prepare('UPDATE policies SET no_renew = NULL WHERE id = ?').run(p.id);
    audit(user, p.client_id, 'Não renovação desfeita', `${p.number} · ${p.no_renew}`);
  } else fail(400, 'Esta apólice não tem anulação agendada nem está marcada para não renovar');
  return { ok: true };
});
route('POST', '/api/policies/:id/reactivate', MANAGERS, ({ user, params }) => {
  const p = getRow('policies', params.id, 'Apólice');
  if (p.status !== 'Anulada') fail(400, 'A apólice não está anulada');
  db.prepare(`UPDATE policies SET status = 'Em Vigor', cancel_reason = NULL, cancel_date = NULL, cancel_mode = NULL, cancel_refund_type = NULL,
    cancel_notes = NULL, cancel_scheduled_date = NULL, cancelled_by = NULL, no_renew = NULL WHERE id = ?`).run(p.id);
  // desfaz os movimentos da anulação: estornos ainda não devolvidos, recibo de acerto da anulação e recibos anulados desta anuidade
  db.prepare("DELETE FROM payments WHERE policy_id = ? AND status = 'Estorno'").run(p.id);
  db.prepare("DELETE FROM payments WHERE policy_id = ? AND status = 'Pendente' AND reference LIKE ?").run(p.id, `REC${p.number}C%`);
  db.prepare("UPDATE payments SET status = 'Pendente' WHERE policy_id = ? AND status = 'Anulado' AND due_date >= ?").run(p.id, p.start_date);
  audit(user, p.client_id, 'Apólice reativada', p.number);
  return { ok: true };
});

// =====================================================================
// ALTERAÇÃO DE APÓLICE (seleção de alterações, retarifação, termos)
// =====================================================================
const ALT_SECTIONS = [
  { key: 'driver', label: 'Dados do Condutor Habitual', auto: true, fields: ['driver_name', 'driver_birth_date', 'driver_license', 'driver_license_date'] },
  { key: 'vehicle', label: 'Dados do Veículo', auto: true, fields: ['plate', 'vehicle_make', 'vehicle_model', 'vehicle_version', 'vehicle_first_reg', 'vehicle_use', 'vehicle_value'] },
  { key: 'product', label: 'Dados do Produto', fields: ['product'] },
  { key: 'payment', label: 'Dados do Pagamento', fields: ['collection_account', 'iban'] },
  { key: 'fractioning', label: 'Fracionamento da Apólice', fields: ['fractioning'] },
  { key: 'discount', label: 'Alteração de desconto comercial', fields: ['commercial_discount'] },
  { key: 'bonus', label: 'Bónus / Malus', auto: true, fields: ['bonus_table', 'bonus_malus'] },
  { key: 'renewal', label: 'Dados de Renovação', fields: ['renewal_mode', 'no_renew'] },
  { key: 'commercial', label: 'Protocolo / Campanha', fields: ['protocol', 'campaign'] },
  { key: 'other', label: 'Canal e Fonte de Informação', fields: ['channel', 'info_source'] },
];
const ALT_LABELS = {
  driver_name: 'Condutor habitual', driver_birth_date: 'Data de nascimento do condutor', driver_license: 'N.º carta de condução', driver_license_date: 'Data da carta de condução',
  plate: 'Matrícula', vehicle_make: 'Marca', vehicle_model: 'Modelo', vehicle_version: 'Versão', vehicle_first_reg: 'Data 1.ª matrícula', vehicle_use: 'Uso do veículo',
  vehicle_value: 'Valor do veículo', product: 'Produto', collection_account: 'Conta cobrança', iban: 'IBAN', fractioning: 'Fracionamento',
  commercial_discount: 'Desconto comercial (%)', bonus_table: 'Tabela de bónus', bonus_malus: 'Bónus/Malus (%)', renewal_mode: 'Modo de renovação', no_renew: 'Não renova',
  protocol: 'Protocolo', campaign: 'Campanha', channel: 'Canal', info_source: 'Fonte de informação',
};
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(new Date(v + 'T12:00:00').getTime());
const numOrNull = (v, label, min, max) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  need(Number.isFinite(n) && n >= min && n <= max, `${label}: valor entre ${min} e ${max}`);
  return n;
};
const yearsBetween = (a, b) => (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / (365.25 * 864e5);

// Tarifa da apólice (fórmula de exemplo): prémio base do produto × idade/carta do condutor × bónus/malus × uso × valor × desconto
function tariff(pol, client) {
  const auto = pol.branch === 'Automóvel';
  const who = auto ? { birth_date: pol.driver_birth_date || client.birth_date, license_date: pol.driver_license_date || client.license_date } : { birth_date: client.birth_date };
  let v = computePremium(pol.branch, pol.product, who);
  if (v == null) return null;
  if (auto) {
    v *= 1 + (Number(pol.bonus_malus) || 0) / 100;
    if (pol.vehicle_use === 'Profissional') v *= 1.15;
    if (Number(pol.vehicle_value) > 30000) v *= 1.1;
  }
  return v * (1 - (Number(pol.commercial_discount) || 0) / 100);
}

function planAlteration(p, body, user) {
  if (p.status === 'Suspensa') fail(400, suspendedMsg(p, 'a poder alterar'));
  need(p.status === 'Em Vigor', 'Só é possível alterar apólices em vigor');
  const c = getClient(p.client_id);
  const auto = p.branch === 'Automóvel';
  const kind = str(body.kind) || 'Alteração';
  need(POLICY_OPTIONS.alterationKinds.includes(kind), 'Tipo de alteração inválido');
  const keep = body.keep_tariff === true || body.keep_tariff === 'true' || body.keep_tariff === '1';
  const code = str(body.subscription_code);
  need(!code || /^[A-Za-z0-9-]{4,20}$/.test(code), 'Código de subscrição inválido (4 a 20 letras, números ou hífen)');
  // a correção corrige dados desde o início da anuidade; a alteração produz efeitos na data indicada
  const start = kind === 'Correcção' ? p.start_date : str(body.effective_date);
  need(isDate(start), 'Indique a data de início da alteração');
  need(start >= p.start_date && start < p.end_date, `A data de início tem de estar entre ${p.start_date} e ${p.end_date}`);
  const keys = [...new Set(Array.isArray(body.sections) ? body.sections.map(String) : [])];
  need(keys.length, 'Selecione pelo menos uma alteração');
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const next = { ...p };
  for (const k of keys) {
    const sec = ALT_SECTIONS.find((x) => x.key === k);
    need(sec, 'Alteração inválida');
    need(!sec.auto || auto, `"${sec.label}" só se aplica a apólices Automóvel`);
    for (const f of sec.fields) if (f in data) next[f] = data[f];
  }
  // normalização e validação de cada campo alterado
  const v = next;
  if (keys.includes('driver')) {
    v.driver_name = str(v.driver_name); v.driver_license = str(v.driver_license)?.toUpperCase() ?? null;
    v.driver_birth_date = str(v.driver_birth_date); v.driver_license_date = str(v.driver_license_date);
    need(v.driver_name, 'Indique o nome do condutor habitual');
    need(isDate(v.driver_birth_date), 'Indique a data de nascimento do condutor');
    need(yearsBetween(v.driver_birth_date, today()) >= 18, 'O condutor tem de ter pelo menos 18 anos');
    need(isDate(v.driver_license_date), 'Indique a data da carta de condução');
    need(yearsBetween(v.driver_birth_date, v.driver_license_date) >= 17 && v.driver_license_date <= today(), 'Data da carta de condução inválida');
  }
  if (keys.includes('vehicle')) {
    v.plate = str(v.plate)?.toUpperCase().replace(/\s+/g, '') ?? null;
    need(v.plate && /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/.test(v.plate), 'Matrícula inválida (formato AA-00-AA)');
    v.vehicle_make = str(v.vehicle_make); v.vehicle_model = str(v.vehicle_model); v.vehicle_version = str(v.vehicle_version);
    need(v.vehicle_make && v.vehicle_model, 'Indique a marca e o modelo do veículo');
    v.vehicle_first_reg = str(v.vehicle_first_reg);
    need(!v.vehicle_first_reg || (isDate(v.vehicle_first_reg) && v.vehicle_first_reg <= today()), 'Data da 1.ª matrícula inválida');
    v.vehicle_use = str(v.vehicle_use);
    need(POLICY_OPTIONS.vehicleUse.includes(v.vehicle_use), 'Indique o uso do veículo');
    v.vehicle_value = numOrNull(v.vehicle_value, 'Valor do veículo', 0, 500000);
  }
  if (keys.includes('product')) need(PRODUCTS[p.branch][v.product] != null, 'Produto inválido para este ramo');
  if (keys.includes('payment')) {
    v.collection_account = str(v.collection_account);
    need(POLICY_OPTIONS.collection.includes(v.collection_account), 'Indique a conta de cobrança');
    v.iban = normIban(v.iban) || null;
    need(!v.iban || validIban(v.iban), 'IBAN inválido (verifique os dígitos de controlo)');
  }
  if (keys.includes('fractioning')) need(POLICY_OPTIONS.fractioning.includes(v.fractioning), 'Fracionamento inválido');
  if (keys.includes('discount')) {
    v.commercial_discount = numOrNull(v.commercial_discount, 'Desconto comercial', 0, 30) ?? 0;
    if (v.commercial_discount > 10 && user.role === 'agente') need(code, 'Descontos comerciais acima de 10% exigem um código de subscrição do supervisor');
  }
  if (keys.includes('bonus')) {
    v.bonus_table = str(v.bonus_table);
    need(!v.bonus_table || POLICY_OPTIONS.bonusTables.includes(v.bonus_table), 'Tabela de bónus inválida');
    v.bonus_malus = numOrNull(v.bonus_malus, 'Bónus/Malus', -50, 150) ?? 0;
    need(Number.isInteger(v.bonus_malus), 'O bónus/malus é uma percentagem inteira');
  }
  if (keys.includes('renewal')) {
    v.renewal_mode = str(v.renewal_mode); v.no_renew = str(v.no_renew);
    need(POLICY_OPTIONS.renewalMode.includes(v.renewal_mode), 'Modo de renovação inválido');
    need(!v.no_renew || POLICY_OPTIONS.noRenew.includes(v.no_renew), 'Motivo de não renovação inválido');
  }
  if (keys.includes('commercial')) {
    v.protocol = str(v.protocol); v.campaign = str(v.campaign);
    need(!v.campaign || db.prepare('SELECT 1 FROM campaigns WHERE name = ?').get(v.campaign), 'Campanha inválida');
  }
  if (keys.includes('other')) {
    v.channel = str(v.channel); v.info_source = str(v.info_source);
    need(!v.channel || POLICY_OPTIONS.channel.includes(v.channel), 'Canal inválido');
    need(!v.info_source || POLICY_OPTIONS.infoSource.includes(v.info_source), 'Fonte de informação inválida');
  }
  // regras entre campos (só quando a alteração mexe na cobrança ou no fracionamento)
  if (keys.includes('payment') || keys.includes('fractioning')) {
    if (v.collection_account?.endsWith('EFT')) need(v.iban, 'A cobrança por EFT (débito direto) exige um IBAN');
    if (v.fractioning === 'Mensal') need(v.collection_account?.endsWith('EFT'), 'O fracionamento mensal exige cobrança por EFT (débito direto)');
  }

  const fields = ALT_SECTIONS.filter((x) => keys.includes(x.key)).flatMap((x) => x.fields);
  const show = (f, val) => (val == null || val === '' ? '-' : f === 'iban' ? maskIban(val) : String(val));
  const changes = fields.filter((f) => String(p[f] ?? '') !== String(v[f] ?? '')).map((f) => ({ field: f, label: ALT_LABELS[f], from: show(f, p[f]), to: show(f, v[f]) }));
  const tariffVersion = keep ? (p.tariff_version || TARIFF_VERSION) : TARIFF_VERSION;
  need(changes.length || tariffVersion !== p.tariff_version, 'Não há alterações: os dados indicados são iguais aos atuais');

  // retarifação: "manter versão" aplica só o efeito relativo das alterações sobre o prémio atual
  const before = money(p.annual_value);
  const tOld = tariff(p, c), tNew = tariff(v, c);
  const after = tNew == null ? before : keep ? money(tOld ? before * (tNew / tOld) : before) : money(tNew);
  const days = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const frac = Math.max(0, days(start, p.end_date)) / Math.max(1, days(p.start_date, p.end_date));
  const adjustment = money((after - before) * frac);
  return { c, kind, keep, code, start, keys, next: v, changes, before, after, adjustment, tariffVersion };
}

route('POST', '/api/policies/:id/alteration/preview', ANY, ({ user, params, body }) => {
  const p = getRow('policies', params.id, 'Apólice');
  const r = planAlteration(p, body, user);
  return { kind: r.kind, start: r.start, changes: r.changes, premiumBefore: r.before, premiumAfter: r.after, adjustment: r.adjustment, tariffVersion: r.tariffVersion };
});

route('POST', '/api/policies/:id/alteration', ANY, ({ user, params, body }) => {
  const p = getRow('policies', params.id, 'Apólice');
  const r = planAlteration(p, body, user);
  const fields = [...new Set(ALT_SECTIONS.filter((x) => r.keys.includes(x.key)).flatMap((x) => x.fields))];
  const lines = r.changes.map((x) => `${x.label}: ${x.from} → ${x.to}`);
  if (r.tariffVersion !== p.tariff_version) lines.push(`Versão de tarifa: ${p.tariff_version || '-'} → ${r.tariffVersion}`);
  if (r.after !== r.before) lines.push(`Prémio anual: ${r.before.toFixed(2)} € → ${r.after.toFixed(2)} €` +
    (r.adjustment > 0 ? ` · acerto a cobrar ${r.adjustment.toFixed(2)} €` : r.adjustment < 0 ? ` · estorno a devolver ${(-r.adjustment).toFixed(2)} €` : ''));
  db.exec('BEGIN');
  try {
    const sets = [...fields.map((f) => `${f} = ?`), 'annual_value = ?', 'tariff_version = ?'];
    db.prepare(`UPDATE policies SET ${sets.join(', ')} WHERE id = ?`).run(...fields.map((f) => r.next[f] ?? null), r.after, r.tariffVersion, p.id);
    const t = db.prepare(`INSERT INTO policy_terms (policy_id, type, description, created_at, start_date, created_by, subscription_code, premium_before, premium_after)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(p.id, r.kind, lines.join('\n'), now(), r.start, user.username, r.code, r.before, r.after);
    createDocument(r.c, p, 'Condições Particulares', r.kind);
    let receipt = null;
    if (r.adjustment > 0) {
      receipt = `REC${p.number}A${now().replace(/\D/g, '').slice(2, 14)}`;
      db.prepare("INSERT INTO payments (client_id, policy_id, reference, amount, due_date, status, created_at) VALUES (?,?,?,?,?, 'Pendente', ?)")
        .run(p.client_id, p.id, receipt, r.adjustment, r.start > today() ? r.start : today(), now());
    }
    db.exec('COMMIT');
    audit(user, p.client_id, r.kind === 'Correcção' ? 'Apólice corrigida' : 'Apólice alterada', `${p.number} · ${lines.join('; ')}`);
    return { ok: true, termsId: Number(t.lastInsertRowid), premiumBefore: r.before, premiumAfter: r.after, adjustment: r.adjustment, receipt };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});

// --- sinistros ---
route('GET', '/api/clients/:id/claims', ANY, ({ params, query }) => {
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('k.client_id = ?', c.id);
  w.add('k.branch = ?', str(query.branch));
  w.add('p.number = ?', str(query.policy));
  w.add('k.number = ?', str(query.number));
  w.add('k.status = ?', str(query.status));
  return { claims: db.prepare(`SELECT k.*, p.number AS policy_number FROM claims k LEFT JOIN policies p ON p.id = k.policy_id ${w.sql()} ORDER BY k.date DESC`).all(...w.vals) };
});
route('POST', '/api/clients/:id/claims', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const p = getRow('policies', body.policy_id, 'Apólice');
  need(p.client_id === c.id, 'A apólice não pertence a este cliente');
  if (p.status === 'Suspensa') fail(400, suspendedMsg(p, 'poder participar o sinistro'));
  need(p.status === 'Em Vigor', 'Só é possível participar sinistros em apólices em vigor');
  const date = str(body.date);
  need(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today(), 'Data do sinistro inválida');
  need(str(body.type), 'Indique o tipo de sinistro');
  const number = `${today().slice(2, 4)}AA${nextSeq('claim', 300000)}`;
  const r = db.prepare(`INSERT INTO claims (number, client_id, policy_id, branch, plate, date, status, type, responsibility, description, created_at)
    VALUES (?,?,?,?,?,?, 'Aberto', ?, 'Por apurar', ?, ?)`).run(number, c.id, p.id, p.branch, p.plate, date, str(body.type), str(body.description), now());
  const pn = `PR${nextSeq('process', 7000000)}`;
  db.prepare(`INSERT INTO processes (number, client_id, policy_id, branch, process_type, task, task_number, status, priority, notes, created_at, expires_at)
    VALUES (?,?,?,?, 'Sinistro', 'Analisar participação', ?, 'Aberto', 'Alta', ?, ?, ?)`).run(pn, c.id, p.id, p.branch, `T${nextSeq('task', 9000000)}`, `Sinistro ${number}`, now(), addDays(today(), 3));
  audit(user, c.id, 'Sinistro participado', `${number} · ${str(body.type)}`);
  return { id: Number(r.lastInsertRowid), number };
});
route('PUT', '/api/claims/:id', ANY, ({ user, params, body }) => {
  const k = getRow('claims', params.id, 'Sinistro');
  if ('status' in body) need(['Aberto', 'Em Análise', 'Encerrado'].includes(body.status), 'Estado inválido');
  updateFields('claims', k.id, body, { status: str, responsibility: str, description: str });
  audit(user, k.client_id, 'Sinistro atualizado', `${k.number}${body.status ? ' → ' + body.status : ''}`);
  return { ok: true };
});

// --- documentos ---
const DOC_CODES = {
  'Carta Verde': 'VDCVERDE', 'Fatura': 'VD_FATR_AVR', 'Condições Particulares': 'VD_CPART', 'Aviso de Pagamento': 'VD_AVPAG',
  'Declaração de Sinistralidade': 'VD_DSIN', 'Carta de Cancelamento': 'VD_CCANC', 'Certificado de Tarifação': 'VD_CTARIF', 'Certificado de Seguro': 'VD_CERT', 'Declaração de Não Dívida': 'VD_DND',
};
function createDocument(client, policy, type, context, channel = null) {
  const cp = db.prepare('SELECT postal_code FROM addresses WHERE client_id = ? ORDER BY main DESC LIMIT 1').get(client.id)?.postal_code?.replace('-', '') || '0000000';
  const filename = `OK_02_#_${cp}_${client.entity_number}_${policy?.number || '000000000'}_${DOC_CODES[type] || 'VD_DOC'}_0000_${Date.now().toString().slice(-8)}.pdf`;
  const r = db.prepare('INSERT INTO documents (client_id, policy_id, branch, type, context, filename, channel, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(client.id, policy?.id ?? null, policy?.branch ?? null, type, context, filename, channel, now());
  return Number(r.lastInsertRowid);
}
route('GET', '/api/clients/:id/documents', ANY, ({ params, query }) => {
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('d.client_id = ?', c.id);
  w.add('d.branch = ?', str(query.branch));
  w.add('p.number = ?', str(query.policy));
  w.add('d.type = ?', str(query.type));
  w.add('d.channel = ?', str(query.channel));
  w.add('substr(d.created_at,1,10) >= ?', str(query.from));
  w.add('substr(d.created_at,1,10) <= ?', str(query.to));
  if (query.retained === '1') w.raw('d.retained = 1');
  return { documents: db.prepare(`SELECT d.*, p.number AS policy_number, p.plate FROM documents d LEFT JOIN policies p ON p.id = d.policy_id ${w.sql()} ORDER BY d.created_at DESC`).all(...w.vals), types: Object.keys(DOC_CODES) };
});
route('POST', '/api/clients/:id/documents', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const type = str(body.type);
  need(DOC_CODES[type], 'Tipo de documento inválido');
  let p = null;
  if (body.policy_id) { p = getRow('policies', body.policy_id, 'Apólice'); need(p.client_id === c.id, 'Apólice inválida'); }
  if (type === 'Carta Verde') need(p && p.branch === 'Automóvel', 'A Carta Verde exige uma apólice Automóvel');
  const id = createDocument(c, p, type, 'Pedido Praxis');
  audit(user, c.id, 'Documento gerado', type + (p ? ` · ${p.number}` : ''));
  return { id };
});
route('POST', '/api/clients/:id/documents/send', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
  need(ids.length, 'Selecione pelo menos um documento');
  const channel = str(body.channel);
  need(['Email', 'Correio', 'SMS'].includes(channel), 'Canal inválido');
  const docs = ids.map((id) => getRow('documents', id, 'Documento'));
  need(docs.every((d) => d.client_id === c.id), 'Documento inválido');
  const contact = channel === 'Correio' ? db.prepare('SELECT description || \', \' || COALESCE(postal_code,\'\') || \' \' || COALESCE(city,\'\') AS v FROM addresses WHERE client_id = ? ORDER BY main DESC LIMIT 1').get(c.id)?.v
    : db.prepare('SELECT value AS v FROM contacts WHERE client_id = ? AND type = ? ORDER BY main DESC LIMIT 1').get(c.id, channel === 'Email' ? 'Email' : 'Telemóvel')?.v;
  need(contact, `O cliente não tem ${channel === 'Correio' ? 'morada' : channel === 'Email' ? 'email' : 'telemóvel'} registado`);
  const retained = docs.filter((d) => d.retained);
  need(!retained.length, 'Não é possível enviar documentos retidos');
  for (const d of docs) db.prepare('UPDATE documents SET channel = ? WHERE id = ?').run(channel, d.id);
  db.prepare('INSERT INTO messages (client_id, channel, direction, recipient, subject, body, user_id, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(c.id, channel, 'Enviada', contact, 'Envio de documentos', docs.map((d) => `• ${d.type} (${d.filename})`).join('\n'), user.id, now());
  audit(user, c.id, 'Documentos enviados', `${docs.length} doc(s) por ${channel}`);
  return { ok: true, recipient: contact };
});
route('PUT', '/api/documents/:id', ANY, ({ user, params, body }) => {
  const d = getRow('documents', params.id, 'Documento');
  updateFields('documents', d.id, body, { retained: bool });
  audit(user, d.client_id, bool(body.retained) ? 'Documento retido' : 'Documento libertado', d.type);
  return { ok: true };
});

// --- processos / tarefas ---
const PROCESS_TYPES = { 'Alteração de Dados': ['Validar documentos', 'Atualizar ficha'], 'Renovação': ['Contactar cliente', 'Rever prémio'],
  'Anulação': ['Confirmar anulação', 'Calcular estorno'], 'Sinistro': ['Analisar participação', 'Pedir peritagem'],
  'Reclamação': ['Responder ao cliente', 'Escalar para supervisão'], 'Vistoria': ['Agendar vistoria', 'Validar fotografias'] };
route('GET', '/api/process-types', ANY, () => ({ types: PROCESS_TYPES }));
route('GET', '/api/clients/:id/processes', ANY, ({ params, query }) => {
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('pr.client_id = ?', c.id);
  w.add('pr.branch = ?', str(query.branch));
  w.add("REPLACE(UPPER(p.plate),'-','') = REPLACE(UPPER(?),'-','')", str(query.plate));
  w.add('p.number = ?', str(query.policy));
  w.add('pr.process_type = ?', str(query.process_type));
  w.add('pr.number = ?', str(query.number));
  w.add('pr.status = ?', str(query.status));
  w.add('pr.task = ?', str(query.task));
  w.add('pr.task_number = ?', str(query.task_number));
  return { processes: db.prepare(`SELECT pr.*, p.number AS policy_number, u.name AS assigned_name FROM processes pr
    LEFT JOIN policies p ON p.id = pr.policy_id LEFT JOIN users u ON u.id = pr.assigned_to ${w.sql()} ORDER BY pr.created_at DESC`).all(...w.vals) };
});
route('POST', '/api/clients/:id/processes', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const type = str(body.process_type), task = str(body.task);
  need(PROCESS_TYPES[type], 'Tipo de processo inválido');
  need(PROCESS_TYPES[type].includes(task), 'Tarefa inválida');
  let p = null;
  if (body.policy_id) { p = getRow('policies', body.policy_id, 'Apólice'); need(p.client_id === c.id, 'Apólice inválida'); }
  const number = `PR${nextSeq('process', 7000000)}`;
  const r = db.prepare(`INSERT INTO processes (number, client_id, policy_id, branch, process_type, task, task_number, status, priority, notes, assigned_to, created_at, expires_at)
    VALUES (?,?,?,?,?,?,?, 'Aberto', ?,?,?,?,?)`).run(number, c.id, p?.id ?? null, p?.branch ?? null, type, task, `T${nextSeq('task', 9000000)}`,
    ['Baixa', 'Normal', 'Alta'].includes(body.priority) ? body.priority : 'Normal', str(body.notes), body.assign_me ? user.id : null, now(), str(body.expires_at) || addDays(today(), 5));
  audit(user, c.id, 'Processo criado', `${number} · ${type}`);
  return { id: Number(r.lastInsertRowid), number };
});
route('PUT', '/api/processes/:id', ANY, ({ user, params, body }) => {
  const pr = getRow('processes', params.id, 'Processo');
  if ('status' in body) {
    need(['Aberto', 'Em Curso', 'Concluído'].includes(body.status), 'Estado inválido');
    db.prepare('UPDATE processes SET closed_at = ? WHERE id = ?').run(body.status === 'Concluído' ? now() : null, pr.id);
  }
  if ('assigned_to' in body && body.assigned_to) getRow('users', body.assigned_to, 'Utilizador');
  if (body.take) body.assigned_to = user.id;
  updateFields('processes', pr.id, body, { status: str, priority: str, notes: str, expires_at: str, assigned_to: (v) => (v ? Number(v) : null) });
  audit(user, pr.client_id, 'Processo atualizado', `${pr.number}${body.status ? ' → ' + body.status : ''}${body.take ? ' (atribuído a si)' : ''}`);
  return { ok: true };
});

// --- mensagens ---
route('GET', '/api/clients/:id/messages', ANY, ({ params, query }) => {
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('m.client_id = ?', c.id);
  w.add('m.channel = ?', str(query.channel));
  return { messages: db.prepare(`SELECT m.*, u.username FROM messages m LEFT JOIN users u ON u.id = m.user_id ${w.sql()} ORDER BY m.id DESC`).all(...w.vals) };
});
route('POST', '/api/clients/:id/messages', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const channel = str(body.channel), recipient = str(body.recipient), text = str(body.body);
  need(['Email', 'SMS', 'Carta', 'Nota de chamada'].includes(channel), 'Canal inválido');
  need(text, 'Escreva a mensagem');
  if (channel === 'SMS') need(text.length <= 480, 'O SMS não pode ter mais de 480 caracteres');
  if (channel !== 'Nota de chamada') need(recipient, 'Indique o destinatário');
  db.prepare('INSERT INTO messages (client_id, channel, direction, recipient, subject, body, user_id, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(c.id, channel, channel === 'Nota de chamada' ? 'Interna' : 'Enviada', recipient, str(body.subject), text, user.id, now());
  audit(user, c.id, 'Mensagem registada', `${channel}${recipient ? ' para ' + recipient : ''}`);
  return { ok: true };
});

// --- outros dados ---
route('POST', '/api/clients/:id/recover-password', ANY, ({ user, params }) => {
  const c = getClient(params.id);
  if (!c.registered || !c.area_email) fail(400, 'O cliente não está registado na Área de Clientes');
  db.prepare("INSERT INTO messages (client_id, channel, direction, recipient, subject, body, user_id, created_at) VALUES (?, 'Email', 'Enviada', ?, 'Recuperação de password', 'Foi enviada uma ligação para redefinir a password da Área de Clientes.', ?, ?)")
    .run(c.id, c.area_email, user.id, now());
  audit(user, c.id, 'Recuperação de password enviada', c.area_email);
  return { ok: true, email: c.area_email };
});
route('POST', '/api/clients/:id/digital-docs', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const authorized = bool(body.authorized);
  db.prepare('UPDATE clients SET digital_docs_at = ?, digital = ? WHERE id = ?').run(authorized ? now() : null, authorized ? 1 : c.registered, c.id);
  audit(user, c.id, authorized ? 'Envio digital autorizado' : 'Envio digital revogado', null);
  return { ok: true };
});
route('POST', '/api/clients/:id/cisa', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  db.prepare('UPDATE clients SET cisa_by_mail = ?, cisa_updated_at = ? WHERE id = ?').run(bool(body.by_mail), now(), c.id);
  audit(user, c.id, 'Preferência CISA atualizada', bool(body.by_mail) ? 'Por correio' : 'Digital');
  return { ok: true };
});
route('POST', '/api/clients/:id/campaigns', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const k = getRow('campaigns', body.campaign_id, 'Campanha');
  db.prepare('INSERT OR REPLACE INTO client_campaigns (client_id, campaign_id, protocol) VALUES (?,?,?)').run(c.id, k.id, str(body.protocol));
  audit(user, c.id, 'Campanha associada', k.name);
  return { ok: true };
});

// --- consentimentos ---
route('PUT', '/api/clients/:id/consents', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  need(CONSENT_TYPES.includes(body.type), 'Tipo de consentimento inválido');
  need(['Aceite', 'Recusado', 'Pendente'].includes(body.status), 'Estado inválido');
  db.prepare(`INSERT INTO consents (client_id, type, status, updated_at, updated_by) VALUES (?,?,?,?,?)
    ON CONFLICT(client_id, type) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(c.id, body.type, body.status, now(), user.username);
  audit(user, c.id, 'Consentimento atualizado', `${body.type}: ${body.status}`);
  return { ok: true };
});

// --- comentários ---
function commentFields(c, body) {
  const text = str(body.text);
  need(text && text.length <= 2000, 'Escreva um comentário (máx. 2000 caracteres)');
  const category = str(body.category) || 'Nota';
  need(COMMENT_CATEGORIES.includes(category), 'Tipo de comentário inválido');
  const policy = str(body.policy_number);
  need(!policy || db.prepare('SELECT 1 FROM policies WHERE client_id = ? AND number = ?').get(c.id, policy), 'A apólice indicada não pertence a este cliente');
  return { text, category, policy };
}
const canManageComment = (k, user) => k.user_id === user.id || user.role !== 'agente';

route('GET', '/api/clients/:id/comments', ANY, ({ params, query }) => {
  const c = getClient(params.id);
  const w = whereBuilder();
  w.add('client_id = ?', c.id);
  w.add('category = ?', str(query.category));
  w.add('username = ?', str(query.author));
  w.add('policy_number = ?', str(query.policy));
  const q = str(query.q);
  if (q) { w.raw('text LIKE ?'); w.vals.push(`%${q}%`); }
  return {
    comments: db.prepare(`SELECT * FROM comments ${w.sql()} ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 500`).all(...w.vals),
    authors: db.prepare('SELECT DISTINCT username FROM comments WHERE client_id = ? AND username IS NOT NULL ORDER BY username').all(c.id).map((r) => r.username),
  };
});
route('POST', '/api/clients/:id/comments', ANY, ({ user, params, body }) => {
  const c = getClient(params.id);
  const { text, category, policy } = commentFields(c, body);
  const r = db.prepare('INSERT INTO comments (client_id, user_id, username, text, created_at, category, pinned, policy_number) VALUES (?,?,?,?,?,?,?,?)')
    .run(c.id, user.id, user.username, text, now(), category, bool(body.pinned), policy);
  audit(user, c.id, 'Comentário adicionado', `${category}${policy ? ' · apólice ' + policy : ''} · ${text.length > 80 ? text.slice(0, 80) + '…' : text}`);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/comments/:id', ANY, ({ user, params, body }) => {
  const k = getRow('comments', params.id, 'Comentário');
  const c = getClient(k.client_id);
  if ('pinned' in body && Object.keys(body).length === 1) {
    db.prepare('UPDATE comments SET pinned = ? WHERE id = ?').run(bool(body.pinned), k.id);
    audit(user, c.id, bool(body.pinned) ? 'Comentário fixado' : 'Comentário desafixado', null);
    return { ok: true };
  }
  if (!canManageComment(k, user)) fail(403, 'Só pode alterar os seus comentários');
  const { text, category, policy } = commentFields(c, body);
  db.prepare('UPDATE comments SET text = ?, category = ?, policy_number = ?, pinned = ?, edited_at = ?, edited_by = ? WHERE id = ?')
    .run(text, category, policy, 'pinned' in body ? bool(body.pinned) : k.pinned, now(), user.username, k.id);
  audit(user, c.id, 'Comentário alterado', category);
  return { ok: true };
});
route('DELETE', '/api/comments/:id', ANY, ({ user, params }) => {
  const k = getRow('comments', params.id, 'Comentário');
  if (!canManageComment(k, user)) fail(403, 'Só pode eliminar os seus comentários');
  db.prepare('DELETE FROM comments WHERE id = ?').run(k.id);
  audit(user, k.client_id, 'Comentário eliminado', k.category);
  return { ok: true };
});

// =====================================================================
// OPERAÇÃO (transversal)
// =====================================================================
route('GET', '/api/queue', ANY, ({ user, query }) => {
  const w = whereBuilder();
  if (query.status === 'abertos' || !query.status) w.raw("pr.status != 'Concluído'"); else w.add('pr.status = ?', str(query.status));
  if (query.scope === 'mine') w.add('pr.assigned_to = ?', user.id);
  if (query.scope === 'unassigned') w.raw('pr.assigned_to IS NULL');
  w.add('pr.process_type = ?', str(query.process_type));
  w.add('pr.priority = ?', str(query.priority));
  return { processes: db.prepare(`SELECT pr.*, c.name AS client_name, c.nif, p.number AS policy_number, u.name AS assigned_name
    FROM processes pr JOIN clients c ON c.id = pr.client_id LEFT JOIN policies p ON p.id = pr.policy_id LEFT JOIN users u ON u.id = pr.assigned_to
    ${w.sql()} ORDER BY CASE pr.priority WHEN 'Alta' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END, pr.expires_at LIMIT 300`).all(...w.vals), types: PROCESS_TYPES };
});

route('GET', '/api/indicators', ANY, () => {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today(), -i));
  const simByDay = Object.fromEntries(db.prepare(`SELECT substr(edited_at,1,10) d, COUNT(*) n FROM simulations WHERE substr(edited_at,1,10) >= ? GROUP BY d`).all(days[0]).map((r) => [r.d, r.n]));
  const opsByDay = Object.fromEntries(db.prepare(`SELECT substr(created_at,1,10) d, COUNT(*) n FROM audit WHERE client_id IS NOT NULL AND substr(created_at,1,10) >= ? GROUP BY d`).all(days[0]).map((r) => [r.d, r.n]));
  const sims = db.prepare("SELECT COUNT(*) total, SUM(status = 'Convertida') conv FROM simulations").get();
  return {
    byBranch: db.prepare("SELECT branch, COUNT(*) n, ROUND(SUM(annual_value),2) premium FROM policies WHERE status = 'Em Vigor' GROUP BY branch ORDER BY n DESC").all(),
    claimsByStatus: db.prepare('SELECT status, COUNT(*) n FROM claims GROUP BY status').all(),
    processesByType: db.prepare("SELECT process_type, COUNT(*) n FROM processes WHERE status != 'Concluído' GROUP BY process_type ORDER BY n DESC").all(),
    daily: days.map((d) => ({ day: d, simulations: simByDay[d] || 0, operations: opsByDay[d] || 0 })),
    conversion: sims.total ? Math.round((sims.conv / sims.total) * 1000) / 10 : 0,
    simulationsTotal: sims.total,
    topAgents: db.prepare(`SELECT username, COUNT(*) n FROM audit WHERE client_id IS NOT NULL AND substr(created_at,1,10) >= ? GROUP BY username ORDER BY n DESC LIMIT 8`).all(addDays(today(), -30)),
    payments: db.prepare("SELECT status, COUNT(*) n, ROUND(SUM(amount),2) total FROM payments GROUP BY status").all(),
    callSubjects: (() => {
      const count = {};
      for (const { subjects } of db.prepare('SELECT subjects FROM call_closures WHERE substr(created_at,1,10) >= ?').all(addDays(today(), -30))) {
        for (const s of subjects.split('; ')) count[s] = (count[s] || 0) + 1;
      }
      return Object.entries(count).map(([subject, n]) => ({ subject, n })).sort((a, b) => b.n - a.n).slice(0, 12);
    })(),
  };
});

route('GET', '/api/inspections', ANY, ({ query }) => {
  const w = whereBuilder();
  w.add('i.status = ?', str(query.status));
  w.add("REPLACE(UPPER(p.plate),'-','') = REPLACE(UPPER(?),'-','')", str(query.plate));
  return { inspections: db.prepare(`SELECT i.*, c.name AS client_name, p.number AS policy_number, p.plate FROM inspections i
    JOIN clients c ON c.id = i.client_id LEFT JOIN policies p ON p.id = i.policy_id ${w.sql()} ORDER BY i.status = 'Realizada', i.scheduled_at IS NULL, i.scheduled_at LIMIT 300`).all(...w.vals) };
});
route('POST', '/api/inspections', ANY, ({ user, body }) => {
  const p = getRow('policies', body.policy_id, 'Apólice');
  need(p.branch === 'Automóvel', 'As vistorias aplicam-se apenas a apólices Automóvel');
  const at = str(body.scheduled_at);
  const r = db.prepare('INSERT INTO inspections (client_id, policy_id, scheduled_at, location, status, notes, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(p.client_id, p.id, at, str(body.location), at ? 'Agendada' : 'Por agendar', str(body.notes), now());
  audit(user, p.client_id, 'Vistoria criada', `${p.number}${at ? ' · ' + at : ''}`);
  return { id: Number(r.lastInsertRowid) };
});
route('PUT', '/api/inspections/:id', ANY, ({ user, params, body }) => {
  const i = getRow('inspections', params.id, 'Vistoria');
  if ('status' in body) need(['Por agendar', 'Agendada', 'Realizada', 'Cancelada'].includes(body.status), 'Estado inválido');
  if (body.scheduled_at && !body.status && i.status === 'Por agendar') body.status = 'Agendada';
  updateFields('inspections', i.id, body, { scheduled_at: str, location: str, status: str, result: str, notes: str });
  audit(user, i.client_id, 'Vistoria atualizada', body.status || null);
  return { ok: true };
});

route('GET', '/api/policies-lookup', ANY, ({ query }) => {
  const q = str(query.q);
  if (!q) return { policies: [] };
  return { policies: db.prepare(`SELECT p.id, p.number, p.plate, p.branch, p.status, c.name AS client_name FROM policies p JOIN clients c ON c.id = p.client_id
    WHERE p.number = ? OR REPLACE(UPPER(p.plate),'-','') = REPLACE(UPPER(?),'-','') OR c.nif = ? LIMIT 20`).all(q, q, q) };
});

route('GET', '/api/payments', ANY, ({ query }) => {
  const w = whereBuilder();
  w.add('y.reference = ?', str(query.reference));
  w.add('p.number = ?', str(query.policy));
  w.add('c.nif = ?', str(query.nif));
  w.add('y.status = ?', str(query.status));
  w.add('y.due_date >= ?', str(query.from));
  w.add('y.due_date <= ?', str(query.to));
  return { payments: db.prepare(`SELECT y.*, p.number AS policy_number, c.name AS client_name, c.nif FROM payments y
    JOIN clients c ON c.id = y.client_id LEFT JOIN policies p ON p.id = y.policy_id ${w.sql()} ORDER BY y.due_date DESC LIMIT 300`).all(...w.vals) };
});
route('POST', '/api/payments/:id/pay', ANY, ({ user, params, body }) => {
  const y = getRow('payments', params.id, 'Recibo');
  if (y.status !== 'Pendente') fail(400, 'Este recibo não está pendente');
  const method = str(body.method);
  need(['Multibanco', 'Débito Direto', 'MB WAY', 'Cartão', 'Transferência'].includes(method), 'Método de pagamento inválido');
  db.prepare("UPDATE payments SET status = 'Pago', method = ?, paid_at = ? WHERE id = ?").run(method, now(), y.id);
  const inv = ensureInvoice(getRow('payments', y.id, 'Recibo'));
  audit(user, y.client_id, 'Pagamento registado', `${y.reference} · €${y.amount} · ${method} · ${inv.invoice_number}`);
  const restored = y.policy_id ? restoreCoverageIfPaid(y.policy_id, user) : null;
  return { ok: true, invoice: inv.invoice_number, restored };
});

route('POST', '/api/payments/:id/refund', ANY, ({ user, params, body }) => {
  const y = getRow('payments', params.id, 'Recibo');
  need(y.status === 'Estorno', 'Este movimento não é um estorno por devolver');
  const method = str(body.method);
  need(['Transferência bancária', 'Cheque', 'Crédito no próximo recibo'].includes(method), 'Indique como foi feita a devolução');
  db.prepare("UPDATE payments SET status = 'Devolvido', method = ?, paid_at = ? WHERE id = ?").run(method, now(), y.id);
  audit(user, y.client_id, 'Estorno devolvido', `${y.reference} · ${Math.abs(y.amount).toFixed(2)} € · ${method}`);
  return { ok: true };
});

// --- fatura-recibo em PDF (só para recibos pagos) ---
function ensureInvoice(y) {
  if (y.invoice_number) return y;
  const year = (y.paid_at || now()).slice(0, 4);
  const number = `FR ${year}/${String(nextSeq(`invoice-${year}`, 0)).padStart(6, '0')}`;
  const issued = y.paid_at || now();
  db.prepare('UPDATE payments SET invoice_number = ?, invoice_issued_at = ? WHERE id = ? AND invoice_number IS NULL').run(number, issued, y.id);
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(y.id);
}
const eurPt = (n) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0).replace(/ /g, ' ');
function addMonthsStr(dateStr, months) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return fmtDateTime(d).slice(0, 10);
}

function renderInvoicePdf(y) {
  const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(y.client_id);
  const p = y.policy_id ? db.prepare('SELECT * FROM policies WHERE id = ?').get(y.policy_id) : null;
  const a = db.prepare('SELECT * FROM addresses WHERE client_id = ? ORDER BY main DESC, id LIMIT 1').get(c.id);
  const co = companyFor(c.brand);
  const pg = new PdfPage();
  const L = 48, R = pg.w - 48, W = R - L;
  const navy = '#0b1038', ink = '#1b2140', muted = '#6b7391', faint = '#9aa1bb', rule = '#dfe3ee', soft = '#f6f7fb', brand = co.color;
  const label = (x, yy, t, opts = {}) => pg.text(x, yy, t.toUpperCase(), { size: 6.6, bold: true, color: muted, spacing: 0.9, ...opts });
  const fit = (t, max, size, bold = true) => Math.max(6.5, Math.min(size, (size * max) / Math.max(1, textWidth(t, size, bold))));

  // ---------- cabeçalho ----------
  pg.rect(L, 46, 42, 42, { fill: brand, radius: 9 });
  pg.text(L + 21, 72.5, co.initials || co.brand.slice(0, 2).toUpperCase(), { size: 15, bold: true, color: '#ffffff', align: 'center' });
  pg.text(L + 54, 63, co.brand, { size: 17, bold: true, color: navy });
  pg.text(L + 54, 79, co.legalName, { size: 8, color: muted });
  pg.text(R, 57, 'FATURA-RECIBO', { size: 8.5, bold: true, color: brand, align: 'right', spacing: 1.8 });
  pg.text(R, 80, y.invoice_number, { size: 18, bold: true, color: navy, align: 'right' });
  const tagW = textWidth('ORIGINAL', 6.2, true) + 6.2 + 16;
  pg.rect(R - tagW, 88, tagW, 14, { stroke: faint, lineWidth: 0.6, radius: 7 });
  pg.text(R - tagW / 2, 97.6, 'ORIGINAL', { size: 6.2, bold: true, color: muted, align: 'center', spacing: 0.9 });
  pg.rect(L, 116, W, 1.4, { fill: brand });

  // ---------- emitente / tomador ----------
  let ey = 142;
  label(L, ey, 'Emitente'); ey += 15;
  pg.text(L, ey, co.legalName, { size: 9.5, bold: true, color: ink }); ey += 13;
  for (const ln of co.address) { pg.text(L, ey, ln, { size: 8.5, color: ink }); ey += 11.5; }
  pg.text(L, ey, `NIPC ${co.nipc}`, { size: 8.5, color: ink }); ey += 11.5;
  pg.text(L, ey, co.contact, { size: 8.5, color: muted });

  const bx = 300, bw = R - bx;
  pg.rect(bx, 128, bw, 98, { fill: soft, stroke: rule, lineWidth: 0.7 });
  pg.rect(bx, 128, 3, 98, { fill: brand });
  let cy = 145;
  label(bx + 16, cy, 'Tomador do seguro'); cy += 15;
  cy = pg.wrap(bx + 16, cy, c.name, bw - 30, { size: 10.5, bold: true, color: navy, lineHeight: 1.25 });
  pg.text(bx + 16, cy, 'NIF', { size: 8.5, color: muted });
  pg.text(bx + 34, cy, c.nif || '-', { size: 8.5, bold: true, color: ink });
  pg.text(bx + 100, cy, `N.º cliente ${c.entity_number}`, { size: 8.5, color: muted }); cy += 13;
  if (a) {
    cy = pg.wrap(bx + 16, cy, a.description, bw - 30, { size: 8.5, color: ink, lineHeight: 1.35 });
    pg.text(bx + 16, cy, `${a.postal_code || ''} ${a.city || ''}`.trim(), { size: 8.5, color: ink });
  }

  // ---------- dados do documento ----------
  const my = 244, mh = 42;
  const meta = [['Emissão', (y.invoice_issued_at || y.paid_at || now()).slice(0, 10)], ['Vencimento', y.due_date],
    ['Pagamento', (y.paid_at || '-').slice(0, 10)], ['N.º do recibo', y.reference], ['N.º da apólice', p?.number || '-']];
  const mw = [0.18, 0.18, 0.18, 0.28, 0.18].map((k) => k * W);
  pg.rect(L, my, W, mh, { stroke: rule, lineWidth: 0.7 });
  pg.rect(L, my, W, 16, { fill: soft });
  pg.line(L, my + 16, R, my + 16, { color: rule, lineWidth: 0.7 });
  let mx = L;
  meta.forEach(([k, v], i) => {
    if (i) pg.line(mx, my, mx, my + mh, { color: rule, lineWidth: 0.7 });
    label(mx + 9, my + 10.8, k, { size: 6.2, spacing: 0.6 });
    pg.text(mx + 9, my + 33, v, { size: fit(v, mw[i] - 16, 9.5), bold: true, color: ink });
    mx += mw[i];
  });

  // ---------- linhas ----------
  const isAdjust = /A\d{6,}$/.test(y.reference), isRenew = /R\d{8}$/.test(y.reference);
  const months = p?.annual_value ? Math.min(12, Math.max(1, Math.round((12 * y.amount) / p.annual_value))) : 12;
  const periodEnd = p ? (isAdjust ? p.end_date : addDays(addMonthsStr(y.due_date, months), -1)) : null;
  const title = !p ? 'Prémio de seguro' : isAdjust ? `Acerto de prémio — alteração da apólice` : `Prémio de seguro${isRenew ? ' — renovação' : ''}`;
  const subs = p ? [`${p.branch} · ${p.product}`, `Apólice n.º ${p.number}${p.plate ? ' · Matrícula ' + p.plate : ''}`] : [];

  let ty = 306;
  const cDesc = L + 12, cPer = L + 262, cIva = L + 372, cVal = R - 12;
  pg.rect(L, ty, W, 22, { fill: navy });
  const th = (x, t, align) => pg.text(x, ty + 14.2, t, { size: 6.8, bold: true, color: '#ffffff', spacing: 0.9, align });
  th(cDesc, 'DESCRIÇÃO'); th(cPer, 'PERÍODO'); th(cIva, 'IVA'); th(cVal, 'VALOR', 'right');
  ty += 22;
  const rowTop = ty;
  let dy = pg.wrap(cDesc, ty + 18, title, 236, { size: 9.5, bold: true, color: ink, lineHeight: 1.3 });
  for (const sline of subs) { pg.text(cDesc, dy + 1, sline, { size: 8, color: muted }); dy += 11.5; }
  if (p) {
    pg.text(cPer, ty + 18, `${y.due_date}`, { size: 8.8, color: ink });
    pg.text(cPer, ty + 30, `a ${periodEnd}`, { size: 8.8, color: ink });
  } else pg.text(cPer, ty + 18, y.due_date, { size: 8.8, color: ink });
  pg.text(cIva, ty + 18, 'Isento', { size: 8.8, color: ink });
  pg.text(cIva, ty + 30, 'M07', { size: 7.5, color: muted });
  pg.text(cVal, ty + 18, eurPt(y.amount), { size: 10, bold: true, color: ink, align: 'right' });
  ty = Math.max(dy + 8, ty + 44);
  pg.line(L, ty, R, ty, { color: rule, lineWidth: 0.7 });
  void rowTop;

  // ---------- dados do seguro (esq.) e totais (dir.) ----------
  const sy = ty + 22;
  label(L, sy, 'Dados do seguro');
  const kv = [['Ramo / produto', p ? `${p.branch} · ${p.product}` : '-'],
    ['Objeto seguro', p ? (p.branch === 'Automóvel' ? [p.plate, [p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '-' : c.name) : '-'],
    ['Vigência da apólice', p ? `${p.start_date} a ${p.end_date}` : '-'], ['Fracionamento', p?.fractioning || '-'], ['Conta de mediação', p?.mediation_account || '-']];
  let ky = sy + 15;
  for (const [k, v] of kv) {
    pg.text(L, ky, k, { size: 8, color: muted });
    pg.text(L + 98, ky, v, { size: fit(v, 160, 8.2, true), bold: true, color: ink });
    ky += 13.5;
  }

  const tx = 318;
  let tyy = sy;
  const trow = (k, v, opts = {}) => {
    pg.text(tx, tyy, k, { size: 8.6, color: opts.kColor || muted });
    pg.text(R - 12, tyy, v, { size: 8.6, bold: !!opts.bold, color: ink, align: 'right' });
    tyy += 15.5;
  };
  trow('Valor do prémio', eurPt(y.amount));
  trow('IVA (isento · M07)', eurPt(0));
  tyy += 2;
  pg.rect(tx - 10, tyy - 6, R - tx + 10, 30, { fill: navy, radius: 4 });
  pg.text(tx, tyy + 13, 'TOTAL DO DOCUMENTO', { size: 7.6, bold: true, color: '#ffffff', spacing: 0.8 });
  pg.text(R - 12, tyy + 14, eurPt(y.amount), { size: 13.5, bold: true, color: '#ffffff', align: 'right' });
  tyy += 40;
  trow('Valor recebido', eurPt(y.amount), { bold: true });
  trow('Saldo em dívida', eurPt(0));

  // ---------- liquidação ----------
  let ly = Math.max(ky, tyy) + 14;
  pg.line(L, ly, R, ly, { color: rule, lineWidth: 0.7 });
  ly += 20;
  label(L, ly, 'Liquidação');
  const liq = [['Data e hora', (y.paid_at || '-').slice(0, 16)], ['Meio de pagamento', y.method || '-'], ['Referência', y.reference]];
  let lx = L;
  liq.forEach(([k, v], i) => {
    pg.text(lx, ly + 16, k, { size: 7.8, color: muted });
    pg.text(lx, ly + 29, v, { size: fit(v, 128, 9), bold: true, color: ink });
    lx += i === 0 ? 112 : 112;
  });
  pg.stamp(R - 62, ly + 18, 'PAGO', `${(y.paid_at || '').slice(0, 10)} · ${y.method || ''}`, { color: '#13955a', angle: 8, width: 118, height: 46 });

  // ---------- observações ----------
  let oy = ly + 62;
  label(L, oy, 'Observações'); oy += 13;
  oy = pg.wrap(L, oy, 'Motivo de isenção de IVA: M07 — isento ao abrigo do artigo 9.º do Código do IVA.', W, { size: 7.8, color: ink, lineHeight: 1.45 });
  oy = pg.wrap(L, oy, 'O prémio inclui os encargos legais aplicáveis (imposto do selo e taxas parafiscais).', W, { size: 7.8, color: ink, lineHeight: 1.45 });
  pg.wrap(L, oy, `Este documento comprova o pagamento do recibo ${y.reference}${p ? `, relativo à apólice n.º ${p.number}` : ''}. Conserve-o para os seus registos.`, W, { size: 7.8, color: ink, lineHeight: 1.45 });

  // ---------- rodapé ----------
  const fy = pg.h - 86;
  pg.line(L, fy, R, fy, { color: rule, lineWidth: 0.7 });
  const fc = [[co.legalName, `NIPC ${co.nipc}`, co.capital], [...co.address, co.registry], [co.contact, co.website]];
  const fw = W / 3;
  fc.forEach((lines, i) => { lines.forEach((t, j) => pg.text(L + i * fw, fy + 14 + j * 9.5, t, { size: 6.6, color: i === 0 && j === 0 ? muted : faint, bold: i === 0 && j === 0 })); });
  pg.wrap(L, pg.h - 32, 'Documento sem validade fiscal: a fatura-recibo oficial tem de ser emitida por software de faturação certificado pela AT (com ATCUD e código QR). Processado pelo Praxis CRM.', W - 70, { size: 6, color: faint, lineHeight: 1.45 });
  pg.text(R, pg.h - 26, 'Pág. 1/1', { size: 6.4, bold: true, color: muted, align: 'right' });
  return buildPdf([pg], { title: `Fatura-Recibo ${y.invoice_number}`, author: co.brand });
}

route('GET', '/api/payments/:id/fatura.pdf', ANY, ({ user, params }) => {
  let y = getRow('payments', params.id, 'Recibo');
  need(y.status === 'Pago', 'A fatura-recibo só está disponível para recibos pagos');
  y = ensureInvoice(y);
  const body = renderInvoicePdf(y);
  audit(user, y.client_id, 'Fatura-recibo descarregada', `${y.invoice_number} · ${y.reference}`);
  return { __file: { body, type: 'application/pdf', filename: `Fatura-Recibo_${y.invoice_number.replace(/[^\w]+/g, '-')}.pdf` } };
});

route('GET', '/api/consents', ANY, ({ query }) => {
  const w = whereBuilder();
  w.add('k.type = ?', str(query.type));
  w.add('k.status = ?', str(query.status));
  w.add('c.nif = ?', str(query.nif));
  const rows = db.prepare(`SELECT k.*, c.name AS client_name, c.nif FROM consents k JOIN clients c ON c.id = k.client_id ${w.sql()} ORDER BY k.updated_at DESC LIMIT 300`).all(...w.vals);
  const summary = db.prepare('SELECT type, status, COUNT(*) n FROM consents GROUP BY type, status').all();
  return { consents: rows, summary };
});

// =====================================================================
// MONITORIZAÇÃO (admin + supervisor)
// =====================================================================
route('GET', '/api/monitor', MANAGERS, ({ query }) => {
  const w = whereBuilder();
  w.add('a.username = ?', str(query.user));
  w.add('a.action LIKE ?', query.action ? `%${query.action}%` : null);
  w.add('substr(a.created_at,1,10) >= ?', str(query.from));
  w.add('substr(a.created_at,1,10) <= ?', str(query.to));
  const online = fmtDateTime(new Date(Date.now() - 10 * 60e3));
  return {
    agents: db.prepare(`SELECT id, username, name, role, team, agent_status, last_seen, last_login, (last_seen > ?) AS online,
      (SELECT COUNT(*) FROM audit WHERE user_id = users.id AND substr(created_at,1,10) = ?) AS ops_today FROM users WHERE active = 1 ORDER BY online DESC, name`).all(online, today()),
    audit: db.prepare(`SELECT a.*, c.name AS client_name FROM audit a LEFT JOIN clients c ON c.id = a.client_id ${w.sql()} ORDER BY a.id DESC LIMIT 300`).all(...w.vals),
  };
});

// =====================================================================
// DOCUMENTO (pré-visualização imprimível)
// =====================================================================
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function renderDocument(d) {
  const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(d.client_id);
  const p = d.policy_id ? db.prepare('SELECT * FROM policies WHERE id = ?').get(d.policy_id) : null;
  const a = db.prepare('SELECT * FROM addresses WHERE client_id = ? ORDER BY main DESC LIMIT 1').get(c.id);
  const rows = [['Tomador', c.name], ['NIF', c.nif], ['N.º Entidade', c.entity_number],
    ['Morada', a ? `${a.description}, ${a.postal_code || ''} ${a.city || ''}` : '-']];
  if (p) rows.push(['Apólice', p.number], ['Ramo', p.branch], ['Produto', p.product], ['Período', `${p.start_date} a ${p.end_date}`],
    ...(p.plate ? [['Matrícula', p.plate]] : []), ['Prémio anual', `€ ${Number(p.annual_value).toFixed(2)}`]);
  if (p && d.type === 'Carta de Cancelamento') rows.push(['Motivo', p.cancel_reason || p.no_renew || '-'], ['Data de efeito', p.cancel_date || p.cancel_scheduled_date || p.end_date]);
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${escHtml(d.type)} — ${escHtml(c.name)}</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:760px;margin:40px auto;color:#141a33;padding:0 20px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2b3cf0;padding-bottom:14px}
.brand{font-size:28px;font-weight:800;color:#2b3cf0}.muted{color:#667}table{width:100%;border-collapse:collapse;margin-top:24px}
td{padding:9px 6px;border-bottom:1px solid #e3e6f0}td:first-child{color:#667;width:200px}.foot{margin-top:40px;font-size:12px;color:#889}
button{margin-top:24px;padding:10px 18px;border:0;border-radius:8px;background:#2b3cf0;color:#fff;font-weight:600;cursor:pointer}@media print{button{display:none}}</style></head>
<body><header><div class="brand">${escHtml(c.brand)}</div><div class="muted">${escHtml(d.created_at)}</div></header>
<h1>${escHtml(d.type)}</h1><p class="muted">${escHtml(d.context || '')} · ${escHtml(d.filename)}</p>
<table>${rows.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td><strong>${escHtml(v)}</strong></td></tr>`).join('')}</table>
<p class="foot">Documento gerado pelo Praxis CRM. Pré-visualização para fins operacionais.</p>
<button onclick="window.print()">Imprimir</button></body></html>`;
}

// =====================================================================
// SERVIDOR
// =====================================================================
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'",
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SEC_HEADERS });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new HttpError(413, 'Pedido demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
      catch { reject(new HttpError(400, 'JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Proibido', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SEC_HEADERS });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  try {
    // pré-visualização de documentos (HTML)
    const docMatch = pathname.match(/^\/doc\/(\d+)$/);
    if (docMatch && req.method === 'GET') {
      const user = getUser(req);
      if (!user) return send(res, 401, 'Sessão expirada', 'text/plain; charset=utf-8');
      const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(docMatch[1]));
      if (!d) return send(res, 404, 'Documento não encontrado', 'text/plain; charset=utf-8');
      db.prepare('UPDATE documents SET last_print = ? WHERE id = ?').run(now(), d.id);
      audit(user, d.client_id, 'Documento visualizado', d.type);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS,
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" });
      return res.end(renderDocument(d));
    }

    if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

    // proteção CSRF: pedidos que alteram dados têm de vir da própria origem
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail(403, 'Origem não permitida');
      if (!(req.headers['content-type'] || '').includes('application/json') && req.headers['content-length'] && req.headers['content-length'] !== '0') fail(415, 'Use application/json');
    }

    const r = routes.find((x) => x.method === req.method && x.re.test(pathname));
    if (!r) fail(404, 'Endpoint não encontrado');
    const m = pathname.match(r.re);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const user = getUser(req);
    if (r.roles) {
      if (!user) fail(401, 'Sessão expirada. Inicie sessão novamente.', 'AUTH');
      const allowedWhileMustChange = ['/api/me', '/api/me/password', '/api/logout'];
      if (user.must_change_password && !allowedWhileMustChange.includes(pathname)) fail(403, 'Tem de alterar a sua password antes de continuar', 'MUST_CHANGE');
      if (Array.isArray(r.roles) && !r.roles.includes(user.role)) fail(403, 'Não tem permissão para esta operação');
    }
    const body = req.method === 'GET' ? {} : await readBody(req);
    const query = Object.fromEntries(url.searchParams);
    const result = await r.handler({ req, res, user, params, query, body });
    if (result?.__file) {
      const { body: buf, type, filename } = result.__file;
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store', ...SEC_HEADERS });
      return res.end(buf);
    }
    send(res, 200, result ?? { ok: true });
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, code: e.code });
    if (String(e.message).includes('UNIQUE constraint')) return send(res, 409, { error: 'Registo duplicado' });
    console.error(e);
    send(res, 500, { error: 'Erro interno do servidor' });
  }
});

const adminFile = ensureAdmin();
const directionFile = ensureSeed();
processScheduledCancellations();
setInterval(() => { try { processScheduledCancellations(); } catch (e) { console.error(e); } }, 60 * 60e3).unref();
server.listen(PORT, HOST, () => {
  console.log(`\n  Praxis CRM a correr em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}\n`);
  if (adminFile) console.log(`  Primeira execução: credenciais do administrador guardadas em\n  ${adminFile}\n`);
  if (directionFile) console.log(`  Contas da Direção criadas — credenciais temporárias em
  ${directionFile}
`);
});
