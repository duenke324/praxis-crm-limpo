// Praxis CRM — aplicação cliente (SPA sem dependências)
'use strict';

// =====================================================================
// UTILITÁRIOS
// =====================================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = $('#root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eurFmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const eur = (n) => eurFmt.format(Number(n) || 0);
const d10 = (s) => (s ? String(s).slice(0, 10) : '-');
const dt = (s) => (s ? String(s).slice(0, 16) : '-');
const dash = (v) => (v === null || v === undefined || v === '' ? '-' : esc(v));
const yesNo = (v) => (v ? 'Sim' : 'Não');
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).filter((c) => /\p{L}/u.test(c)).slice(0, 2).join('').toUpperCase() || '?';
const todayStr = () => new Date().toISOString().slice(0, 10);
const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== '' && v != null && v !== false) p.set(k, v === true ? '1' : v);
  const s = p.toString();
  return s ? '?' + s : '';
};
const ROLE_LABEL = { superadmin: 'Acesso total', direcao: 'Direção', admin: 'Administrador', supervisor: 'Supervisor', agente: 'Agente' };
const ROLE_LEVEL = { agente: 1, supervisor: 2, admin: 3, direcao: 4, superadmin: 5 };
const ROLE_BADGE = { superadmin: 'danger', direcao: 'warn', admin: 'brand', supervisor: 'info', agente: '' };
const lvl = (u) => ROLE_LEVEL[(u || state.user)?.role] || 0;
const canGrantTop = () => !!state.user?.can_grant_top;
const isTopUser = () => state.user?.role === 'superadmin' || canGrantTop();
// "Acesso total" só aparece para quem tem a permissão "Pode conceder Acesso total"
const assignableRoles = () => Object.keys(ROLE_LEVEL).filter((r) => (r === 'superadmin' ? canGrantTop() : isTopUser() || ROLE_LEVEL[r] < lvl())).sort((a, b) => ROLE_LEVEL[a] - ROLE_LEVEL[b]);

const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  pinned: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const STATUS_CLASS = {
  'Em Vigor': 'ok', Aceite: 'ok', Pago: 'ok', Devolvido: 'ok', Estorno: 'info', 'Concluído': 'ok', Realizada: 'ok', Ativo: 'ok', Convertida: 'brand',
  Pendente: 'warn', Aberto: 'warn', 'Por agendar': 'warn', 'Por apurar': 'warn', 'Em Análise': 'info', 'Em Curso': 'info', Agendada: 'info',
  Anulada: 'danger', Suspensa: 'danger', Rejeitada: 'danger', Recusado: 'danger', Cancelada: 'danger', Anulado: 'danger', Alta: 'danger', Inativo: 'danger',
};
const badge = (s) => `<span class="badge ${STATUS_CLASS[s] ?? ''}">${esc(s)}</span>`;

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = ic(type === 'error' ? 'alert' : 'check') + `<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}
const handleErr = (e) => { if (!e?.handled) { console.error(e); toast(e?.message || 'Erro inesperado', 'error'); } };

// =====================================================================
// API
// =====================================================================
const state = { user: null, meta: null, openClientId: null, openClient: null, accessId: null, origin: 'Pesquisa', tf: {}, lastSearch: null };

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const e = new Error(data.error || `Erro ${res.status}`);
    e.status = res.status;
    if (data.code === 'AUTH') { e.handled = true; state.user = null; renderLogin('A sua sessão expirou. Inicie sessão novamente.'); }
    if (data.code === 'MUST_CHANGE') { e.handled = true; renderForceChange(); }
    throw e;
  }
  return data;
}

// =====================================================================
// FORMULÁRIOS, TABELAS E MODAIS
// =====================================================================
let uid = 0;
const splitTeams = (v) => String(v ?? '').split(';').map((x) => x.trim()).filter(Boolean);
const teamChips = (v, empty = 'Sem equipa') => { const t = splitTeams(v); return t.length ? t.map((x) => `<span class="team-chip">${esc(x)}</span>`).join('') : `<span class="muted small">${empty}</span>`; };
function fieldHtml(f, v) {
  const val = v ?? f.value ?? '';
  const id = `f${++uid}`;
  const req = f.required ? 'required' : '';
  const cls = `field${f.full ? ' full' : ''}${f.type === 'checkbox' ? ' check' : ''}`;
  if (f.type === 'multi') {
    const sel = Array.isArray(val) ? val : splitTeams(val);
    return `<div class="${cls} full" data-field="${f.name}"><label>${esc(f.label)}${sel.length ? ` <span class="muted small">(${sel.length})</span>` : ''}</label>
      <div class="subj-chips multi">${(f.options || []).map((o) => `<label class="subj"><input type="checkbox" data-multi="1" name="${f.name}" value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''}><span>${ic('check', 'sm')}${esc(o)}</span></label>`).join('')}</div>
      ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
  }
  if (f.type === 'checkbox') {
    const on = val === true || val === 1 || val === '1' || val === 'true';
    return `<div class="${cls}"><input type="checkbox" id="${id}" name="${f.name}" ${on ? 'checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
  }
  let input;
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => (Array.isArray(o) ? o : [o, o]));
    input = `<select id="${id}" name="${f.name}" ${req}>${f.placeholder === false ? '' : `<option value="">${esc(f.placeholder || 'Selecione')}</option>`}${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" ${req} ${f.attrs || ''} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  } else {
    input = `<input id="${id}" type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}" ${req} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.attrs || ''}>`;
  }
  return `<div class="${cls}" data-field="${f.name}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}
const formGrid = (fields, values = {}) => `<div class="form-grid">${fields.map((f) => fieldHtml(f, values[f.name])).join('')}</div>`;
function readForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox' && el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); continue; }
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  }
  return o;
}
function setOptions(select, options, placeholder = 'Selecione') {
  select.innerHTML = `<option value="">${esc(placeholder)}</option>` + options.map((o) => (Array.isArray(o) ? o : [o, o])).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
}

function filterForm(name, fields, values) {
  return `<form class="filters" data-form="${name}">${formGrid(fields, values)}
    <div class="actions"><button type="button" class="btn" data-act="form-clear">Limpar</button><button class="btn primary" type="submit">${ic('search', 'sm')} Pesquisar</button></div></form>`;
}

function table(cols, rows, { empty = 'Sem resultados para mostrar…', rowAttr } = {}) {
  const head = cols.map((c) => `<th class="${c.cls || ''}">${esc(c.label || '')}</th>`).join('');
  const body = rows.length
    ? rows.map((r) => `<tr ${rowAttr ? rowAttr(r) : ''}>${cols.map((c) => `<td class="${c.cls || ''}">${c.render ? c.render(r) : dash(r[c.key])}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="empty" colspan="${cols.length}">${esc(empty)}</td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
// botão de descarga da fatura-recibo (só recibos pagos)
const invoiceBtn = (y) => (y.status === 'Pago' ? `<a class="btn sm" href="/api/payments/${y.id}/fatura.pdf" download title="Descarregar fatura-recibo em PDF${y.invoice_number ? ' · ' + esc(y.invoice_number) : ''}">${ic('download', 'sm')} Fatura PDF</a>` : '');
const btnIcon = (act, icon, title, data = {}, cls = '') =>
  `<button type="button" class="btn ghost icon ${cls}" title="${esc(title)}" aria-label="${esc(title)}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${ic(icon, 'sm')}</button>`;

function openModal({ title, body = '', fields, values, submitLabel = 'Guardar', onSubmit, wide, danger, onMount, cancelLabel = 'Cancelar' }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal ${wide ? 'wide' : ''}${wide === 'x' ? ' xwide' : ''}" novalidate>
    <div class="modal-h"><h3>${esc(title)}</h3><button type="button" class="btn ghost icon" data-close aria-label="Fechar">${ic('x')}</button></div>
    <div class="modal-b"><div class="form-error" hidden></div>${body}${fields ? formGrid(fields, values || {}) : ''}</div>
    <div class="modal-f"><button type="button" class="btn" data-close>${esc(onSubmit ? cancelLabel : 'Fechar')}</button>${onSubmit ? `<button class="btn ${danger ? 'danger' : 'primary'}" type="submit">${esc(submitLabel)}</button>` : ''}</div></form>`;
  document.body.append(bg);
  const form = $('form', bg);
  let closed = false;
  const listeners = [];
  const close = () => { if (closed) return; closed = true; bg.remove(); document.removeEventListener('keydown', onKey); listeners.forEach((f) => f()); };
  const onKey = (e) => { if (e.key === 'Escape' && $$('.modal-bg').pop() === bg) close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach((b) => (b.onclick = close));
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    if (!form.reportValidity()) return;
    const btn = $('[type=submit]', form);
    const err = $('.form-error', form);
    btn.disabled = true; err.hidden = true;
    try {
      const r = await onSubmit(readForm(form), form);
      if (r !== false) close();
    } catch (ex) {
      if (!ex.handled) { err.textContent = ex.message; err.hidden = false; }
    } finally { btn.disabled = false; }
  };
  onMount?.(form);
  setTimeout(() => $('input:not([type=checkbox]):not([type=radio]), select, textarea', form)?.focus(), 40);
  return { form, close, onClose: (f) => listeners.push(f) };
}
function confirmModal(title, message, { label = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const m = openModal({ title, body: `<p style="margin:0;line-height:1.5">${esc(message)}</p>`, submitLabel: label, danger, onSubmit: () => { ok = true; } });
    m.onClose(() => resolve(ok));
  });
}
function showSecret(title, intro, username, password) {
  openModal({
    title,
    body: `<p style="margin-top:0">${esc(intro)}</p>
      <div class="dl" style="grid-template-columns:1fr"><div><dt>Utilizador</dt><dd>${esc(username)}</dd></div></div>
      <div class="secret"><span>${esc(password)}</span><button type="button" class="btn sm" data-copy>${ic('copy', 'sm')} Copiar</button></div>
      <div class="note">Esta password só é mostrada agora. Entregue-a ao funcionário por um canal seguro — no primeiro login vai ser obrigado a defini-la de novo.</div>`,
    onMount: (form) => {
      $('[data-copy]', form).onclick = async () => {
        try { await navigator.clipboard.writeText(password); toast('Password copiada'); } catch { toast('Não foi possível copiar — selecione e copie manualmente', 'error'); }
      };
    },
  });
}

// =====================================================================
// EVENTOS GLOBAIS (delegação)
// =====================================================================
let acts = {};
const globalActs = {
  'form-clear': (_, el) => {
    const f = el.closest('form');
    for (const x of f.elements) { if (!x.name) continue; if (x.type === 'checkbox') x.checked = false; else x.value = ''; }
    f.requestSubmit();
  },
  logout: () => {
    const doLogout = async () => {
      try { await api('/api/logout', { method: 'POST' }); } catch { /* ignora */ }
      state.user = null; state.openClientId = null; state.openClient = null; state.accessId = null;
      renderLogin();
    };
    if (state.openClient) return closeClientModal(state.openClient, { then: doLogout, reason: 'Para terminar sessão tem primeiro de fechar a ficha deste cliente.' });
    return doLogout();
  },
  'new-client': () => newClientModal(),
  'open-client': ({ id }) => openClientFile(id, $('#origin')?.value || 'Pesquisa'),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('.modal')) return;
  const fn = acts[el.dataset.act] || globalActs[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset, el, e)).catch(handleErr);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches?.('form[data-form=comment] textarea')) { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = acts[f.dataset.form];
  if (fn) Promise.resolve(fn(readForm(f), f)).catch(handleErr);
});

// =====================================================================
// LOGIN E PASSWORD
// =====================================================================
function renderLogin(message) {
  acts = {};
  state.openClient = null; state.openClientId = null; state.accessId = null;
  root.innerHTML = `<div class="login-wrap">
    <div class="login-hero">
      <div class="logo">Praxis<span>.</span></div>
      <div>
        <h2>O novo painel de gestão de clientes.</h2>
        <p>Pesquisa, apólices, sinistros, documentos e processos — tudo numa ficha de cliente rápida e organizada.</p>
        <ul>
          <li>${ic('search')} Pesquisa instantânea por NIF, apólice, matrícula ou contacto</li>
          <li>${ic('shield')} Acessos por perfil e registo completo de operações</li>
          <li>${ic('chart')} Indicadores e fila de trabalho em tempo real</li>
        </ul>
      </div>
      <small style="color:#8f97d6">OK! teleseguros · Via Directa</small>
    </div>
    <div class="login-panel">
      <form class="login-card" id="loginForm" autocomplete="on">
        <h1>Iniciar sessão</h1>
        <div class="sub">Use as credenciais atribuídas pelo administrador.</div>
        <div class="form-error" ${message ? '' : 'hidden'}>${esc(message || '')}</div>
        <div class="field"><label for="lu">Utilizador</label><input id="lu" name="username" autocomplete="username" required></div>
        <div class="field"><label for="lp">Password</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn primary" type="submit">Entrar</button>
      </form>
    </div></div>`;
  const form = $('#loginForm');
  $('#lu').focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('.form-error', form);
    err.hidden = true;
    const btn = $('button', form); btn.disabled = true;
    try {
      const r = await api('/api/login', { method: 'POST', body: readForm(form) });
      state.user = r.user;
      if (r.user.must_change_password) renderForceChange(); else boot();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; }
  };
}

function passwordFields() {
  return [
    { name: 'current', label: 'Password atual', type: 'password', required: true, full: true, attrs: 'autocomplete="current-password"' },
    { name: 'password', label: 'Nova password', type: 'password', required: true, full: true, hint: 'Mínimo 8 caracteres, com letras e números.', attrs: 'autocomplete="new-password" minlength="8"' },
    { name: 'confirm', label: 'Confirmar nova password', type: 'password', required: true, full: true, attrs: 'autocomplete="new-password"' },
  ];
}
async function changePassword(v) {
  if (v.password !== v.confirm) throw new Error('As passwords não coincidem');
  await api('/api/me/password', { method: 'POST', body: { current: v.current, password: v.password } });
}

function renderForceChange() {
  acts = {};
  root.innerHTML = `<div class="login-wrap"><div class="login-hero"><div class="logo">Praxis<span>.</span></div>
    <div><h2>Defina a sua password pessoal.</h2><p>Por segurança, a password temporária atribuída pelo administrador tem de ser substituída antes de começar a trabalhar.</p></div><small style="color:#8f97d6">OK! teleseguros · Via Directa</small></div>
    <div class="login-panel"><form class="login-card" id="pwForm"><h1>Nova password</h1><div class="sub">Olá ${esc(state.user?.name || '')}, falta só este passo.</div>
    <div class="form-error" hidden></div>${formGrid(passwordFields())}
    <button class="btn primary mt" type="submit">Guardar e continuar</button>
    <button class="btn ghost mt" type="button" id="pwOut">Terminar sessão</button></form></div></div>`;
  const form = $('#pwForm');
  $('#pwOut').onclick = () => globalActs.logout();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const err = $('.form-error', form); err.hidden = true;
    try {
      await changePassword(readForm(form));
      const me = await api('/api/me');
      state.user = me.user;
      toast('Password definida com sucesso');
      boot();
    } catch (ex) { if (!ex.handled) { err.textContent = ex.message; err.hidden = false; } }
  };
}

// =====================================================================
// ESTRUTURA (barra lateral + topo)
// =====================================================================
function navItem(key, icon, label) { return `<a class="nav-item" data-nav="${key}" href="#/${key}">${ic(icon)}<span>${label}</span></a>`; }
function renderShell(active) {
  if (!$('#shell')) {
    const u = state.user;
    const mgr = lvl(u) >= 2;
    root.innerHTML = `<div class="shell" id="shell">
      <aside class="sidebar">
        <div class="brand"><b>Praxis</b><small>CRM</small></div>
        <nav class="nav-group"><div class="label">Geral</div>${navItem('', 'home', 'Início')}${navItem('clientes', 'users', 'Clientes')}</nav>
        <nav class="nav-group"><div class="label">Operação</div>
          ${navItem('produtos', 'shield', 'Produtos ok!')}${navItem('fila', 'inbox', 'Fila de Trabalho')}${navItem('indicadores', 'chart', 'Indicadores')}${navItem('vistorias', 'car', 'Vistorias')}
          ${navItem('pagamentos', 'card', 'Consulta de Pagamentos')}${navItem('consentimentos', 'shield', 'Consentimentos')}</nav>
        ${mgr ? `<nav class="nav-group"><div class="label">Gestão</div>${navItem('monitorizacao', 'activity', 'Monitorização')}${lvl(u) >= 3 ? navItem('admin', 'userplus', 'Utilizadores') : ''}</nav>` : ''}
        <nav class="nav-group"><div class="label">Conta</div>${navItem('perfil', 'key', 'O meu perfil')}<a class="nav-item" href="#" data-act="logout">${ic('logout')}<span>Terminar sessão</span></a></nav>
        <div class="foot">OK! teleseguros · Via Directa<br>Praxis CRM v1.0</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="qsearch">${ic('search')}<input id="qs" placeholder="Pesquisa rápida: nome, NIF, apólice, matrícula, telefone…" autocomplete="off"><div class="results" id="qsr" hidden></div></div>
          <div class="spacer"></div>
          <label class="status-pick" title="Estado do agente"><span class="dot ${esc(u.agent_status)}" id="stDot"></span>
            <select id="stSel">${['Disponível', 'Em chamada', 'Pausa', 'Indisponível'].map((s) => `<option ${s === u.agent_status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <div class="userchip"><div class="avatar">${esc(initials(u.name))}</div><div class="meta"><b>${esc(u.name)}</b><small>${esc(u.job_title || ROLE_LABEL[u.role])} · ${esc(u.username)}</small></div></div>
        </header>
        <main class="view" id="view"></main>
      </div></div>`;
    bindTopbar();
  }
  $$('.nav-item[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === active || (active === 'cliente' && a.dataset.nav === 'clientes')));
}

function bindTopbar() {
  const input = $('#qs'), box = $('#qsr');
  let timer, items = [], sel = -1;
  const draw = () => {
    box.hidden = !items.length && !input.value;
    box.innerHTML = items.length
      ? items.map((r, i) => `<a href="#/cliente/${r.id}" data-i="${i}" class="${i === sel ? 'sel' : ''}"><span>${esc(r.name)}</span><small>NIF ${dash(r.nif)} · ${esc(r.entity_number)}</small></a>`).join('')
      : (input.value.length >= 2 ? '<a><small>Sem resultados</small></a>' : '');
    if (!box.innerHTML) box.hidden = true;
  };
  const go = (r) => { input.value = ''; items = []; draw(); openClientFile(r.id, 'Pesquisa'); };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) { items = []; return draw(); }
      try { items = (await api('/api/search' + qs({ q }))).results; sel = items.length ? 0 : -1; draw(); } catch (e) { handleErr(e); }
    }, 180);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && items[sel]) { go(items[sel]); }
    if (e.key === 'Escape') { input.value = ''; items = []; draw(); }
  });
  box.addEventListener('mousedown', (e) => { const a = e.target.closest('a[data-i]'); if (a) { e.preventDefault(); go(items[a.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
  input.addEventListener('focus', () => { if (items.length) box.hidden = false; });

  $('#stSel').onchange = async (e) => {
    try {
      const r = await api('/api/me/status', { method: 'POST', body: { status: e.target.value } });
      state.user.agent_status = r.status;
      $('#stDot').className = 'dot ' + r.status;
      toast(`Estado: ${r.status}`);
    } catch (ex) { handleErr(ex); }
  };
}

// =====================================================================
// ROUTER
// =====================================================================
const VIEWS = {};
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, q] = h.split('?');
  return { parts: p.split('/').filter(Boolean).map(decodeURIComponent), query: Object.fromEntries(new URLSearchParams(q || '')) };
}
let lastHash = location.hash;
async function router() {
  if (!state.user) return;
  const { parts, query } = parseHash();
  const oc = state.openClient;
  if (oc && !(parts[0] === 'cliente' && parts[1] === String(oc.id))) {
    // a sair da ficha sem a fechar: repõe o endereço e pede o assunto da chamada
    const target = location.hash || '#/';
    history.replaceState(null, '', lastHash || `#/cliente/${oc.id}`);
    closeClientModal(oc, { then: () => { location.hash = target; }, reason: 'Para sair da ficha tem primeiro de indicar o assunto da chamada.' });
    return;
  }
  lastHash = location.hash;
  const key = parts[0] || '';
  const view = VIEWS[key] || VIEWS[''];
  acts = {};
  renderShell(VIEWS[key] ? key : '');
  const el = $('#view');
  el.innerHTML = '<div class="loading"><span class="spin"></span></div>';
  try { await view(el, parts.slice(1), query); }
  catch (e) { if (!e.handled) el.innerHTML = `<div class="card card-b"><b>Não foi possível carregar esta página.</b><p class="muted">${esc(e.message)}</p></div>`; }
}
window.addEventListener('hashchange', router);
const refresh = () => router();

async function boot() {
  try {
    state.meta = await api('/api/meta');
    root.innerHTML = '';
    router();
  } catch (e) { handleErr(e); }
}

function pageHead(title, sub = '', actions = '', crumbs = '') {
  return `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="btns">${actions}</div></div>`;
}

// =====================================================================
// INÍCIO
// =====================================================================
function kpi(icon, value, label, tone = '') {
  return `<div class="card kpi"><div class="ic ${tone}">${ic(icon)}</div><div><div class="v">${value}</div><div class="l">${esc(label)}</div></div></div>`;
}
const withCurrent = (list, cur) => (cur && !list.includes(cur) ? [...list, cur] : list);
function userFieldsNew() {
  return [
    { name: 'username', label: 'Utilizador (login)', required: true, placeholder: 'FM\\EX12471', hint: 'Formato FM\\EX + número — já vem preenchido com o próximo livre.' },
    { name: 'name', label: 'Nome completo', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'role', label: 'Perfil', type: 'select', required: true, placeholder: false, options: assignableRoles().map((r) => [r, ROLE_LABEL[r]]) },
    { name: 'team', label: 'Equipas', type: 'multi', options: state.meta.teams, hint: 'Pode marcar várias equipas.' },
    { name: 'job_title', label: 'Cargo', type: 'select', options: state.meta.jobTitles, placeholder: '— Sem cargo —' },
    { name: 'password', label: 'Password temporária', type: 'password', hint: 'Deixe vazio para gerar automaticamente.', attrs: 'autocomplete="new-password"' },
  ];
}
async function fillNextUsername(form) {
  const inp = form && $('input[name=username]', form);
  if (!inp || inp.value) return;
  try { inp.value = (await api('/api/users/next-username')).username; } catch { /* sem permissão: fica vazio */ }
}
async function createUser(v) {
  const r = await api('/api/users', { method: 'POST', body: v });
  showSecret('Conta criada', `A conta de ${v.name} foi criada com o perfil ${ROLE_LABEL[v.role]}.`, v.username, r.temporaryPassword);
  return r;
}

const cLink = (id, name) => `<a href="#" data-act="open-client" data-id="${id}">${esc(name)}</a>`;
const cnt = (n) => (n ? `<span class="count">${n}</span>` : '');
const dayDiffStr = (a, b) => Math.round((new Date(b.slice(0, 10) + 'T12:00:00') - new Date(a.slice(0, 10) + 'T12:00:00')) / 864e5);
const daysSince = (date) => Math.max(0, dayDiffStr(date, todayStr()));
const inDays = (date) => { const n = dayDiffStr(todayStr(), date); return n <= 0 ? 'hoje' : n === 1 ? 'amanhã' : `daqui a ${n} dias`; };
VIEWS[''] = async (el) => {
  const d = await api('/api/dashboard');
  const k = d.kpis, u = state.user, isAdmin = lvl(u) >= 3;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  const dateLong = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  el.innerHTML = `
    <div class="welcome"><div><h1>${greet}, ${esc(u.name.split(' ')[0])}</h1><p>${esc(dateLong)} · ${k.myProcesses} tarefa(s) atribuída(s) a si</p></div>
      <div class="btns"><a class="btn primary" href="#/clientes">${ic('search')} Pesquisar cliente</a><button class="btn" data-act="new-client">${ic('plus')} Novo cliente</button>
      ${isAdmin ? `<a class="btn" href="#/admin">${ic('userplus')} Gerir utilizadores</a>` : ''}</div></div>
    <div class="card mt hero-search"><div class="card-b">
      <form data-form="home-search" novalidate>
        <div class="hero-head"><h2>${ic('search')} Pesquisa de clientes</h2>
          <div class="seg" role="radiogroup" aria-label="Pesquisar por">${[['nif', 'NIF'], ['policy', 'N.º de Apólice'], ['all', 'Todos os campos']].map(([v, l]) => `<label><input type="radio" name="by" value="${v}" ${(state.homeSearch?.by || 'nif') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="hero-row">
          <input name="q" id="heroQ" autocomplete="off" required value="${esc(state.homeSearch?.q || '')}">
          <select name="origin" id="origin" title="Origem do contacto">${['Inbound', 'Outbound', 'Pesquisa', 'DC', 'Email'].map((o) => `<option ${o === (state.homeSearch?.origin || 'Inbound') ? 'selected' : ''}>${o}</option>`).join('')}</select>
          <button class="btn primary" type="submit">${ic('search', 'sm')} Pesquisar</button>
        </div>
      </form>
      <div id="heroRes"></div>
    </div></div>
    <div class="grid home-grid mt">
      <div class="stack">
        <div class="card"><div class="card-h"><h3>${ic('refresh')} Renovações nos próximos 30 dias${cnt(d.renewals.count)}</h3></div>
          <div class="card-b flush">${table([
            { label: 'Apólice', render: (r) => `<b>${esc(r.number)}</b><span class="sub">${esc(r.branch)}${r.plate ? ' · ' + esc(r.plate) : ''}</span>` },
            { label: 'Cliente', render: (r) => cLink(r.client_id, r.client_name) },
            { label: 'Vence', render: (r) => `${d10(r.end_date)}<span class="sub">${inDays(r.end_date)}</span>` },
            { label: 'Renovação', render: (r) => `${r.no_renew ? `<span class="badge danger" title="${esc(r.no_renew)}">Não renova</span>` : `<span class="badge ${r.renewal_mode === 'Manual' ? 'warn' : 'ok'}">${r.renewal_mode === 'Manual' ? 'Manual' : 'Automática'}</span>`}<span class="sub">${eur(r.annual_value)}/ano</span>` },
          ], d.renewals.rows, { empty: 'Não há renovações nos próximos 30 dias.' })}</div></div>
        <div class="card"><div class="card-h"><h3>${ic('card')} Recibos em atraso${cnt(d.overdue.n)}${d.overdue.n ? `<span class="muted small" style="margin-left:8px;font-weight:500">${eur(d.overdue.total)}${d.overdue.suspended ? ` · ${d.overdue.suspended} apólice(s) sem cobertura` : ''}</span>` : ''}</h3>
          <button class="btn sm" data-act="home-overdue">Ver todos</button></div>
          <div class="card-b flush">${table([
            { label: 'Referência', render: (r) => `<code>${esc(r.reference)}</code><span class="sub">apólice ${dash(r.policy_number)}</span>` },
            { label: 'Cliente', render: (r) => cLink(r.client_id, r.client_name) },
            { label: 'Venceu', render: (r) => `${d10(r.due_date)}<span class="sub"><span class="badge danger">há ${daysSince(r.due_date)} dia(s)</span>${r.policy_status === 'Suspensa' ? ' <span class="badge danger">Sem cobertura</span>' : ''}</span>` },
            { label: 'Valor', cls: 'num', render: (r) => `<b>${eur(r.amount)}</b>` },
          ], d.overdue.rows, { empty: 'Não há recibos em atraso.' })}</div></div>
        <div class="card"><div class="card-h"><h3>${ic('file')} Termos e condições por aceitar${cnt(d.pendingTerms.count)}</h3></div>
          <div class="card-b flush">${table([
            { label: 'Tipo', render: (r) => `<b>${esc(r.type)}</b><span class="sub">início ${d10(r.start_date)}</span>` },
            { label: 'Cliente', render: (r) => `${cLink(r.client_id, r.client_name)}<span class="sub">apólice ${esc(r.policy_number)}</span>` },
            { label: 'Criado', render: (r) => `${d10(r.created_at)}<span class="sub">há ${daysSince(r.created_at)} dia(s)</span>` },
            { label: 'Último pedido', render: (r) => (r.last_sent_at ? dt(r.last_sent_at) : '<span class="badge warn">Nunca enviado</span>') },
          ], d.pendingTerms.rows, { empty: 'Todos os termos estão aceites.' })}</div></div>
        <div class="card"><div class="card-h"><h3>${ic('alert')} Sinistros em aberto</h3></div>
          <div class="card-b flush">${table([
            { label: 'N.º', render: (r) => `<b>${esc(r.number)}</b><span class="sub">${esc(r.type)}</span>` },
            { label: 'Cliente', render: (r) => cLink(r.client_id, r.client_name) },
            { label: 'Data', render: (r) => d10(r.date) },
            { label: 'Situação', render: (r) => badge(r.status) },
          ], d.recentClaims, { empty: 'Não há sinistros em aberto.' })}</div></div>
        <div class="card"><div class="card-h"><h3>${ic('clock')} Clientes abertos recentemente</h3></div>
          <div class="card-b flush">${table([
            { label: 'Nome', render: (r) => `<a href="#" data-act="open-client" data-id="${r.id}"><b>${esc(r.name)}</b></a>` },
            { label: 'NIF', key: 'nif' }, { label: 'N.º Entidade', key: 'entity_number' }, { label: 'Último acesso', render: (r) => dt(r.at) },
          ], d.recentClients, { empty: 'Ainda não abriu nenhuma ficha de cliente.' })}</div></div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>${ic('user')} O meu dia</h3><span class="muted small">${esc(new Date().toLocaleDateString('pt-PT'))}</span></div>
          <div class="card-b">
            <div class="myday">${[['phone', d.myDay.calls, 'Chamadas fechadas'], ['user', d.myDay.files, 'Fichas abertas'], ['msg', d.myDay.comments, 'Comentários'], ['activity', d.myDay.operations, 'Operações em clientes']]
              .map(([i, n, l]) => `<div><span class="ic">${ic(i, 'sm')}</span><b>${n}</b><small>${l}</small></div>`).join('')}</div>
            ${d.myDay.topSubjects.length ? `<div class="section-title" style="margin:14px 0 8px;font-size:12px">Assuntos mais tratados hoje</div>
              <div class="pol-chips">${d.myDay.topSubjects.map((t) => `<span class="pol-chip">${esc(t.subject)}<small>${t.n} chamada(s)</small></span>`).join('')}</div>`
              : '<p class="muted small" style="margin:12px 0 0">Ainda não fechou nenhuma ficha hoje.</p>'}
          </div></div>
        ${isAdmin ? `<div class="card"><div class="card-h"><h3>${ic('userplus')} Criar conta de funcionário</h3><a href="#/admin" class="btn sm">Todos</a></div>
          <div class="card-b"><form data-form="home-create-user">${formGrid(userFieldsNew())}<div class="btns mt" style="justify-content:flex-end"><button class="btn primary" type="submit">${ic('plus', 'sm')} Criar conta</button></div></form></div></div>` : ''}
        <div class="card"><div class="card-h"><h3>${ic('pinned')} Alertas fixados</h3></div>
          <ul class="side-list">${d.alerts.map((m) => `<li><div><span class="badge ${COMMENT_CLASS[m.category] ?? ''}" style="font-size:11px">${esc(m.category)}</span> ${cLink(m.client_id, m.client_name)}
            <small style="color:var(--ink-2);white-space:normal">${esc(m.text.length > 140 ? m.text.slice(0, 140) + '…' : m.text)}</small><small>${esc(m.username || '')} · ${dt(m.created_at)}</small></div></li>`).join('') || '<li class="empty">Sem comentários fixados.</li>'}</ul></div>
        <div class="card"><div class="card-h"><h3>${ic('x')} Anulações e não renovações</h3></div>
          <ul class="side-list">${d.cancellations.map((r) => `<li><div><b>${esc(r.number)}</b> · ${cLink(r.client_id, r.client_name)}
            <small>${r.cancel_scheduled_date ? `<span class="badge warn">Anulação a ${d10(r.cancel_scheduled_date)}</span> ${esc(r.cancel_reason || '')}` : `<span class="badge danger">Não renova</span> termina a ${d10(r.end_date)} · ${esc(r.no_renew || '')}`}</small></div></li>`).join('') || '<li class="empty">Nenhuma anulação agendada.</li>'}</ul></div>
        <div class="card"><div class="card-h"><h3>${ic('activity')} Atividade recente</h3></div>
          <ul class="side-list activity">${d.activity.map((a) => `<li><div class="avatar" style="width:30px;height:30px;font-size:11px">${esc(initials(a.username))}</div>
            <div><b>${esc(a.action)}</b>${a.client_name ? ` · <a href="#" data-act="open-client" data-id="${a.client_id}">${esc(a.client_name)}</a>` : ''}<small>${esc(a.username)} · ${dt(a.created_at)}${a.details ? ' · ' + esc(a.details) : ''}</small></div></li>`).join('') || '<li class="empty">Sem atividade.</li>'}</ul></div>
      </div>
    </div>`;
  acts['home-overdue'] = () => { state.tf.pay = { status: 'Pendente', to: addDaysStr(todayStr(), -1) }; location.hash = '#/pagamentos'; };
  // pesquisa de clientes no ecrã principal
  const heroQ = $('#heroQ', el), heroRes = $('#heroRes', el);
  const HINT = { nif: ['NIF do cliente (9 dígitos)', 'numeric', '\\d{9}', 9], policy: ['N.º da apólice (ex.: 900110010)', 'numeric', '\\d{5,12}', 12], all: ['Nome, NIF, n.º apólice, entidade, matrícula, telefone ou email', 'text', null, 120] };
  const setHint = () => {
    const [ph, mode, pattern, max] = HINT[$('input[name=by]:checked', el).value];
    heroQ.placeholder = ph; heroQ.inputMode = mode; heroQ.maxLength = max;
    if (pattern) heroQ.pattern = pattern; else heroQ.removeAttribute('pattern');
  };
  $$('input[name=by]', el).forEach((x) => x.addEventListener('change', () => { setHint(); heroQ.focus(); if (heroQ.value) heroQ.form.requestSubmit(); }));
  setHint();
  acts['home-search'] = async (v, form) => {
    state.homeSearch = v;
    const q = v.q.replace(/\s+/g, v.by === 'all' ? ' ' : '');
    if (v.by === 'nif' && !/^\d{9}$/.test(q)) { heroRes.innerHTML = '<p class="hero-msg warn">O NIF tem 9 dígitos.</p>'; return; }
    if (v.by === 'policy' && !/^\d{5,12}$/.test(q)) { heroRes.innerHTML = '<p class="hero-msg warn">Indique o número da apólice (apenas dígitos).</p>'; return; }
    if (q.length < 2) { heroRes.innerHTML = '<p class="hero-msg warn">Escreva pelo menos 2 caracteres.</p>'; return; }
    heroRes.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    try {
      const { results } = await api('/api/search' + qs({ q, by: v.by }));
      heroRes.innerHTML = results.length ? `<div class="mt">${table([
        { label: 'Cliente', render: (c) => `<a href="#" data-act="open-client" data-id="${c.id}"><b>${esc(c.name)}</b></a><span class="sub">${esc(c.brand || '')}</span>` },
        { label: 'NIF', render: (c) => (v.by === 'nif' ? `<mark>${dash(c.nif)}</mark>` : dash(c.nif)) }, { label: 'N.º Entidade', key: 'entity_number' },
        { label: 'Apólices', render: (c) => `<div class="pol-chips">${c.policies.map((x) => `<span class="pol-chip ${x.number === q ? 'hit' : ''} ${x.status === 'Anulada' ? 'off' : ''} ${x.status === 'Suspensa' ? 'susp' : ''}" title="${esc(x.branch)} · ${esc(x.status)}">${esc(x.number)}<small>${esc(x.branch)}${x.status === 'Suspensa' ? ' · sem cobertura' : ''}</small></span>`).join('') || '<span class="muted">Sem apólices</span>'}</div>` },
        { label: '', cls: 'act', render: (c) => `<button class="btn sm primary" data-act="open-client" data-id="${c.id}">${ic('user', 'sm')} Abrir ficha</button>` },
      ], results)}</div>` : `<p class="hero-msg">Nenhum cliente encontrado para <b>${esc(q)}</b>. <button type="button" class="btn sm" data-act="new-client">${ic('plus', 'sm')} Criar novo cliente</button></p>`;
    } catch (ex) { heroRes.innerHTML = `<p class="hero-msg warn">${esc(ex.message)}</p>`; }
  };
  if (state.homeSearch?.q) acts['home-search'](state.homeSearch); else setTimeout(() => heroQ.focus(), 50);
  acts['home-create-user'] = async (v, form) => {
    if (!form.reportValidity()) return;
    await createUser(v);
    form.reset();
    fillNextUsername(form);
  };
  fillNextUsername($('form[data-form="home-create-user"]', el));
};

// =====================================================================
// CLIENTES — PESQUISA
// =====================================================================
const CLIENT_FORM = () => [
  { name: 'name', label: 'Nome completo', required: true, full: true },
  { name: 'short_name', label: 'Sigla / nome curto' },
  { name: 'nif', label: 'NIF', attrs: 'inputmode="numeric" maxlength="9" pattern="\\d{9}"' },
  { name: 'birth_date', label: 'Data de nascimento', type: 'date' },
  { name: 'gender', label: 'Sexo', type: 'select', options: ['Feminino', 'Masculino', 'Outro'] },
  { name: 'marital_status', label: 'Estado civil', type: 'select', options: ['Solteiro(a)', 'Casado(a)', 'União de Facto', 'Divorciado(a)', 'Viúvo(a)'] },
  { name: 'profession', label: 'Profissão' },
  { name: 'activity', label: 'Actividade' },
  { name: 'employees', label: 'N.º empregados', type: 'number', attrs: 'min="0"' },
  { name: 'driver_license', label: 'N.º carta de condução' },
  { name: 'license_date', label: 'Data da carta de condução', type: 'date' },
  { name: 'brand', label: 'Marca', type: 'select', placeholder: false, options: ['OK! teleseguros', 'Via Directa'] },
  { name: 'death_date', label: 'Data de óbito', type: 'date' },
  { name: 'eni', label: 'ENI (empresário em nome individual)', type: 'checkbox' },
  { name: 'gestual', label: 'Cliente Ok! Gestual', type: 'checkbox' },
];
function newClientModal() {
  const base = CLIENT_FORM().filter((f) => ['name', 'nif', 'birth_date', 'gender', 'marital_status', 'profession', 'brand', 'license_date'].includes(f.name));
  openModal({
    title: 'Novo cliente', wide: true, submitLabel: 'Criar cliente',
    fields: [...base,
      { name: 'phone', label: 'Telemóvel', attrs: 'inputmode="tel"' }, { name: 'email', label: 'Email', type: 'email' },
      { name: 'address', label: 'Morada', full: true }, { name: 'postal_code', label: 'Código postal', placeholder: '0000-000', attrs: 'pattern="\\d{4}-\\d{3}"' }, { name: 'city', label: 'Localidade' }],
    onSubmit: async (v) => {
      const r = await api('/api/clients', { method: 'POST', body: v });
      toast('Cliente criado');
      openClientFile(r.id, 'Pesquisa');
    },
  });
}

VIEWS.clientes = async (el, _, query) => {
  const mode = query.mode === 'avancada' ? 'avancada' : 'simples';
  const branches = state.meta.branches;
  const fields = mode === 'simples'
    ? [{ name: 'branch', label: 'Ramo', type: 'select', options: branches, placeholder: 'Todos' }, { name: 'plate', label: 'Matrícula', placeholder: '00-AA-00' },
       { name: 'policy', label: 'N.º Apólice' }, { name: 'nif', label: 'NIF', attrs: 'inputmode="numeric"' }]
    : [{ name: 'name', label: 'Nome' }, { name: 'entity', label: 'N.º Entidade' }, { name: 'birth', label: 'Data de nascimento', type: 'date' },
       { name: 'postal', label: 'Código postal', placeholder: '1000 ou 1000-001' }, { name: 'phone', label: 'Telefone / telemóvel' }, { name: 'email', label: 'Email' },
       { name: 'brand', label: 'Marca', type: 'select', options: ['OK! teleseguros', 'Via Directa'], placeholder: 'Todas' }];
  const values = state.lastSearch?.mode === mode ? state.lastSearch.values : {};
  el.innerHTML = pageHead('Pesquisa de Clientes', 'Encontre um cliente para abrir a ficha.', `<button class="btn primary" data-act="new-client">${ic('plus')} Novo cliente</button>`,
    '<a href="#/">Início</a> › Operações › Clientes') + `
    <div class="card"><div class="card-b">
      <div class="toolbar"><div class="seg"><button type="button" class="${mode === 'simples' ? 'active' : ''}" data-act="mode" data-mode="simples">Pesquisa simples</button>
        <button type="button" class="${mode === 'avancada' ? 'active' : ''}" data-act="mode" data-mode="avancada">Pesquisa avançada</button></div>
        <div class="group"><span class="muted">Origem do contacto</span><select class="input" id="origin">${['Pesquisa', 'Inbound', 'Outbound', 'DC', 'Email'].map((o) => `<option ${o === state.origin ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
      ${filterForm('search', fields, values)}
      <div id="results"></div></div></div>`;
  const draw = (r) => {
    $('#results', el).innerHTML = `<div class="muted" style="margin:4px 0 10px">${r.filtered ? `${r.clients.length} resultado(s)` : 'Clientes criados mais recentemente'}</div>` + table([
      { label: '', cls: 'act', render: (c) => btnIcon('open-client', 'eye', 'Abrir ficha', { id: c.id }) },
      { label: 'Nome', render: (c) => `<a href="#" data-act="open-client" data-id="${c.id}"><b>${esc(c.name)}</b></a>` },
      { label: 'Cliente', key: 'short_name' }, { label: 'NIF', key: 'nif' }, { label: 'Data Nascimento', render: (c) => d10(c.birth_date) },
      { label: 'N.º Entidade', key: 'entity_number' }, { label: 'Código Postal', key: 'postal_code' },
      { label: 'Marca', render: (c) => `<span class="badge ${c.brand === 'Via Directa' ? 'info' : 'brand'}">${esc(c.brand)}</span>` },
      { label: 'Digital', render: (c) => (c.digital ? `<span class="badge ok">${ic('check', 'sm')}</span>` : '<span class="muted">-</span>') },
    ], r.clients, { rowAttr: (c) => `class="click" data-act="open-client" data-id="${c.id}"` });
  };
  acts.mode = ({ mode: m }) => { location.hash = '#/clientes?mode=' + m; };
  acts.search = async (v) => {
    state.lastSearch = { mode, values: v };
    draw(await api('/api/clients' + qs(v)));
  };
  draw(await api('/api/clients' + qs(values)));
};

// =====================================================================
// FICHA DE CLIENTE
// =====================================================================
const CLIENT_TABS = [
  ['dados', 'Dados do Cliente'], ['simulacoes', 'Simulações/Propostas', 'simulations'], ['site', 'Simulações Site'], ['apolices', 'Apólices', 'policies'],
  ['sinistros', 'Sinistros', 'claims'], ['documentos', 'Documentos', 'documents'], ['processos', 'Processos', 'processes'], ['mensagens', 'Mensagens', 'messages'],
  ['outros', 'Outros Dados'], ['consentimentos', 'Gestão de Consentimentos'], ['comentarios', 'Comentários', 'comments'],
];
const TABS = {};
let clientPoliciesCache = null;
async function clientPolicies(id, onlyActive = false) {
  if (!clientPoliciesCache || clientPoliciesCache.id !== id) clientPoliciesCache = { id, list: (await api(`/api/clients/${id}/policies`)).policies };
  return onlyActive ? clientPoliciesCache.list.filter((p) => p.status === 'Em Vigor') : clientPoliciesCache.list;
}
const policyOpt = (p) => [p.id, `${p.number} · ${p.branch} · ${p.product}${p.plate ? ' · ' + p.plate : ''}${p.status !== 'Em Vigor' ? ' (' + p.status + ')' : ''}`];

// Abre a ficha de um cliente (novo acesso). Se houver uma ficha aberta, obriga a fechá-la primeiro.
function openClientFile(id, origin = 'Pesquisa') {
  const go = () => {
    state.openClientId = null; state.origin = origin;
    const h = `#/cliente/${id}`;
    if (location.hash === h) router(); else location.hash = h;
  };
  if (state.openClient) return closeClientModal(state.openClient, { then: go, reason: 'Antes de abrir outra ficha tem de fechar a atual e indicar o assunto da chamada.' });
  go();
}

// Fechar ficha: pede o(s) assunto(s) da chamada antes de sair (obrigatório)
let closingModal = null;
function closeClientModal(c, { then, reason } = {}) {
  if (closingModal) return;
  const body = `${reason ? `<div class="note" style="margin:0 0 12px">${ic('alert', 'sm')} ${esc(reason)}</div>` : ''}<p style="margin-top:0">Indique o(s) assunto(s) tratados neste contacto com <b>${esc(c.name)}</b>${state.origin ? ` · origem <b>${esc(state.origin)}</b>` : ''}. Pode escolher mais do que um.</p>
    <div class="subj-groups">${state.meta.callSubjects.map(([group, list]) => `<fieldset class="subj-group"><legend>${esc(group)}</legend>
      <div class="subj-chips">${list.map((s) => `<label class="subj"><input type="checkbox" name="subject" value="${esc(s)}"><span>${ic('check', 'sm')}${esc(s)}</span></label>`).join('')}</div></fieldset>`).join('')}</div>`;
  closingModal = openModal({
    title: 'Fechar ficha — assunto da chamada', wide: true, submitLabel: 'Fechar ficha', cancelLabel: 'Voltar à ficha', body,
    fields: [{ name: 'notes', label: 'Notas da chamada', type: 'textarea', full: true, attrs: 'maxlength="1000" rows="2"', placeholder: 'Opcional (obrigatório se escolher "Outro")' }],
    onMount: (form) => setTimeout(() => $('input[name=subject]', form)?.focus(), 60),
    onSubmit: async (v, form) => {
      const subjects = $$('input[name=subject]:checked', form).map((x) => x.value);
      if (!subjects.length) throw new Error('Escolha pelo menos um assunto da chamada.');
      if (subjects.includes('Outro') && !v.notes) throw new Error('Descreva o assunto nas notas quando escolhe "Outro".');
      await api(`/api/clients/${c.id}/close`, { method: 'POST', body: { subjects, notes: v.notes, access_id: state.accessId } });
      toast(`Ficha fechada · ${subjects.join(', ')}`);
      state.openClientId = null; state.openClient = null; state.accessId = null;
      setTimeout(then || (() => { location.hash = '#/clientes'; }), 0);
    },
  });
  closingModal.onClose(() => { closingModal = null; });
}

// fechar o separador / recarregar com uma ficha aberta: aviso do browser
window.addEventListener('beforeunload', (e) => { if (state.openClient) { e.preventDefault(); e.returnValue = ''; } });

VIEWS.cliente = async (el, [id, tab = 'dados', ...rest]) => {
  const isNew = state.openClientId !== id;
  if (isNew) { state.tf = {}; clientPoliciesCache = null; }
  const d = await api(`/api/clients/${encodeURIComponent(id)}${qs({ log: isNew ? 1 : '', origin: state.origin })}`);
  state.openClientId = id;
  if (d.accessId) state.accessId = d.accessId;
  const c = d.client;
  state.openClient = { id: c.id, name: c.name };
  const phone = d.contacts.find((k) => k.type === 'Telemóvel' || k.type === 'Telefone');
  const addr = d.addresses[0];
  if (!TABS[tab]) tab = 'dados';

  el.innerHTML = `
    <div class="crumbs"><a href="#/">Início</a> › Operações › <a href="#/clientes">Clientes</a> › Detalhe de Cliente</div>
    <div class="card client-head" style="margin-bottom:18px">
      <div class="avatar lg">${esc(initials(c.name))}</div>
      <div><h1>${esc(c.name)}</h1><div class="chips">
        <span class="chip">NIF <b>${dash(c.nif)}</b></span><span class="chip">Entidade <b>${esc(c.entity_number)}</b></span>
        <span class="badge ${c.brand === 'Via Directa' ? 'info' : 'brand'}">${esc(c.brand)}</span>
        ${c.digital ? `<span class="badge ok">${ic('check', 'sm')} Cliente digital</span>` : '<span class="badge">Não digital</span>'}
        ${c.death_date ? `<span class="badge danger">Óbito ${d10(c.death_date)}</span>` : ''}</div></div>
      <div class="btns"><button class="btn" data-act="edit-client">${ic('edit', 'sm')} Alterar dados</button>
        <button class="btn" data-act="new-sim">${ic('calc', 'sm')} Nova simulação</button>
        ${lvl() >= 3 ? `<button class="btn danger" data-act="delete-client" title="Eliminar cliente">${ic('trash', 'sm')}</button>` : ''}
        <button class="btn primary" data-act="close-client">${ic('x', 'sm')} Fechar ficha</button></div>
    </div>
    ${d.suspended.length ? `<div class="alert-bar">${ic('alert')}<div><b>Sem seguro válido — falta de pagamento.</b>
      ${d.suspended.map((x) => `Apólice <b>${esc(x.number)}</b> (${esc(x.branch)}) suspensa desde ${d10(x.suspended_at)}: ${esc((x.suspended_reason || '').replace(/^Falta de pagamento: /, ''))}.`).join(' ')}
      <small>Recibos por pagar há mais de 1 mês e 10 dias suspendem a cobertura. Fica reposta automaticamente quando o pagamento for registado.</small></div>
      <a class="btn sm" href="#/cliente/${c.id}/dados">Ver recibos</a></div>` : ''}
    <div class="client-layout ${tab === 'simulador' ? 'wide' : ''}">
      <div class="card">
        <div class="tabs" style="padding:0 10px">${CLIENT_TABS.map(([k, label, cnt]) => `<a class="tab ${k === tab || (tab === 'alteracao' && k === 'apolices') || (tab === 'simulador' && k === 'simulacoes') ? 'active' : ''}" href="#/cliente/${c.id}/${k}">${esc(label)}${cnt && d.counts[cnt] ? `<span class="n">${d.counts[cnt]}</span>` : ''}</a>`).join('')}</div>
        <div class="card-b" id="tab"><div class="loading"><span class="spin"></span></div></div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>${ic('user')} ${esc(c.short_name || c.name)}</h3></div>
          <div class="card-b" style="padding:6px 18px"><dl class="dl" style="grid-template-columns:1fr">
            <div><dt>Data nascimento</dt><dd>${d10(c.birth_date)}</dd></div>
            <div><dt>Código postal</dt><dd>${addr ? `${dash(addr.postal_code)} ${dash(addr.city)}` : '-'}</dd></div>
            <div><dt>NIF</dt><dd>${dash(c.nif)}</dd></div>
            <div><dt>Contacto</dt><dd>${phone ? esc(phone.value) : '-'}</dd></div>
            <div><dt>Cliente digital</dt><dd>${c.digital ? `<span class="badge ok">${ic('check', 'sm')}</span>` : '<span class="badge">Não</span>'}</dd></div></dl></div></div>
        <div class="card"><div class="card-h"><h3>${ic('shield')} Consentimentos</h3><a class="btn sm ghost" href="#/cliente/${c.id}/consentimentos">Gerir</a></div>
          <ul class="side-list">${state.meta.consentTypes.map((t) => {
            const k = d.consents.find((x) => x.type === t) || { status: 'Pendente', updated_at: null };
            return `<li><div>${esc(t)}<small>${k.updated_at ? dt(k.updated_at) : 'sem registo'}${k.status === 'Pendente' ? ' · aguarda resposta' : ''}</small></div>${consentButtons(t, k.status)}</li>`;
          }).join('')}</ul></div>
        <div class="card comments-card"><div class="card-h"><h3>${ic('msg')} Comentários${d.counts.comments ? `<span class="count">${d.counts.comments}</span>` : ''}</h3><a class="btn sm ghost" href="#/cliente/${c.id}/comentarios">Ver todos</a></div>
          <div class="card-b">${commentForm(d)}</div>
          <div class="comment-list">${d.comments.map(commentItem).join('') || '<div class="empty" style="padding:12px 18px">Ainda não há comentários.</div>'}</div>
          ${d.counts.comments > d.comments.length ? `<a class="more-link" href="#/cliente/${c.id}/comentarios">Ver os ${d.counts.comments} comentários ${ic('link', 'sm')}</a>` : ''}</div>
        <div class="card"><div class="card-h"><h3>${ic('activity')} Últimas operações</h3></div>
          <ul class="side-list">${d.operations.map((o) => `<li><div><b>${esc(o.action)}</b><small>${esc(o.username)} · ${dt(o.created_at)}${o.details ? ' · ' + esc(o.details) : ''}</small></div></li>`).join('') || '<li class="empty">Sem resultados para mostrar…</li>'}</ul></div>
        <div class="card"><div class="card-h"><h3>${ic('clock')} Histórico de acessos</h3></div>
          <div class="card-b flush">${table([{ label: 'Origem', render: (a) => `<b>${esc(a.origin)}</b><span class="sub">${dt(a.created_at)}</span>${a.subjects ? `<span class="sub subj-line" title="${esc(a.close_notes || '')}">${ic('phone', 'sm')} ${esc(a.subjects)}</span>` : ''}` }, { label: 'Utilizador', key: 'username' }], d.access)}</div></div>
      </div>
    </div>`;

  // ações comuns da ficha
  acts['close-client'] = () => closeClientModal(c);
  acts['edit-client'] = () => openModal({
    title: 'Alterar dados do cliente', wide: true, fields: CLIENT_FORM(), values: c,
    onSubmit: async (v) => { await api(`/api/clients/${c.id}`, { method: 'PUT', body: v }); toast('Dados do cliente atualizados'); refresh(); },
  });
  acts['delete-client'] = async () => {
    if (!(await confirmModal('Eliminar cliente', `Tem a certeza que quer eliminar ${c.name} e todos os dados associados (apólices, sinistros, documentos…)? Esta ação não pode ser desfeita.`, { label: 'Eliminar definitivamente', danger: true }))) return;
    await api(`/api/clients/${c.id}`, { method: 'DELETE' });
    toast('Cliente eliminado'); state.openClientId = null; state.openClient = null; state.accessId = null; location.hash = '#/clientes';
  };
  acts['new-sim'] = () => simulationModal(c, false);
  acts.consent = async ({ type, status }) => {
    await api(`/api/clients/${c.id}/consents`, { method: 'PUT', body: { type, status } });
    toast(`${type}: ${status}`); refresh();
  };
  acts.comment = async (v, form) => {
    if (!form.reportValidity()) return;
    await api(`/api/clients/${c.id}/comments`, { method: 'POST', body: v });
    toast('Comentário guardado'); refresh();
  };
  acts['cm-pin'] = async ({ id: cid, pinned }) => {
    await api(`/api/comments/${cid}`, { method: 'PUT', body: { pinned: pinned === '1' } });
    toast(pinned === '1' ? 'Comentário fixado no topo' : 'Comentário desafixado'); refresh();
  };
  acts['cm-edit'] = ({ id: cid }) => {
    const m = commentCache.get(String(cid));
    if (!m) return;
    openModal({
      title: 'Alterar comentário', submitLabel: 'Guardar alterações',
      fields: [{ name: 'category', label: 'Tipo', type: 'select', placeholder: false, options: state.meta.commentCategories },
        { name: 'policy_number', label: 'Apólice relacionada', type: 'select', placeholder: 'Sem apólice', options: d.policyNumbers.map((x) => [x.number, `${x.number} · ${x.branch}`]) },
        { name: 'text', label: 'Comentário', type: 'textarea', required: true, full: true, attrs: 'maxlength="2000" rows="5"' },
        { name: 'pinned', label: 'Fixar no topo', type: 'checkbox' }],
      values: m,
      onSubmit: async (v) => { await api(`/api/comments/${cid}`, { method: 'PUT', body: v }); toast('Comentário alterado'); refresh(); },
    });
  };
  acts['del-comment'] = async ({ id: cid }) => {
    if (!(await confirmModal('Eliminar comentário', 'Quer eliminar este comentário?', { label: 'Eliminar', danger: true }))) return;
    await api(`/api/comments/${cid}`, { method: 'DELETE' }); refresh();
  };

  const tabEl = $('#tab', el);
  // a barra de separadores desliza para mostrar o separador ativo (ex.: Comentários, no fim)
  const bar = $('.tabs', el), act = $('.tab.active', bar);
  if (bar && act) bar.scrollLeft = Math.max(0, act.offsetLeft - bar.clientWidth / 2 + act.offsetWidth / 2);
  try { await TABS[tab](tabEl, d, rest); }
  catch (e) { if (!e.handled) tabEl.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
};

function consentButtons(type, status) {
  const b = (s, icon, title) => `<button type="button" class="${status === s ? 'on ' + s : ''}" title="${title}" data-act="consent" data-type="${esc(type)}" data-status="${s}">${ic(icon, 'sm')}</button>`;
  return `<span class="consent-btns">${b('Aceite', 'check', 'Aceite')}${b('Recusado', 'x', 'Recusado')}${b('Pendente', 'help', 'Pendente')}</span>`;
}

// ---- Dados do cliente ----
TABS.dados = async (el, d) => {
  const c = d.client;
  const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
  el.innerHTML = `
    <div class="section-title">Identificação <button class="btn sm" data-act="edit-client">${ic('edit', 'sm')} Alterar dados</button></div>
    <dl class="dl">
      ${row('Nome', esc(c.name))}${row('NIF', dash(c.nif))}${row('N.º Entidade', esc(c.entity_number))}
      ${row('Data de criação', d10(c.created_at))}${row('Data de nascimento', d10(c.birth_date))}${row('Profissão', dash(c.profession))}
      ${row('Estado civil', dash(c.marital_status))}${row('Sexo', dash(c.gender))}${row('Sigla', dash(c.short_name))}
      ${row('N.º empregados', dash(c.employees))}${row('Actividade', dash(c.activity))}${row('ENI', yesNo(c.eni))}
      ${row('Data carta de condução', d10(c.license_date))}${row('N.º carta de condução', dash(c.driver_license))}${row('Cliente Ok! Gestual', yesNo(c.gestual))}
      ${row('Data de óbito', d10(c.death_date))}${row('Marca', esc(c.brand))}
    </dl>
    <div class="grid g2 mt">
      <div><div class="section-title">${ic('pin', 'sm')} Moradas <button class="btn sm" data-act="add-address">${ic('plus', 'sm')} Adicionar morada</button></div>
        <div class="card">${table([
          { label: 'Tipo', render: (a) => `${esc(a.type)}${a.main ? ' <span class="badge brand">Principal</span>' : ''}` },
          { label: 'Descrição', render: (a) => `<b>${esc(a.description)}</b><span class="sub">${dash(a.city)}</span>` },
          { label: 'Código Postal', key: 'postal_code' }, { label: 'Criação', render: (a) => d10(a.created_at) },
          { label: '', cls: 'act', render: (a) => btnIcon('edit-address', 'edit', 'Editar', { id: a.id }) + btnIcon('del-address', 'trash', 'Remover', { id: a.id }) },
        ], d.addresses)}</div></div>
      <div><div class="section-title">${ic('phone', 'sm')} Contactos <button class="btn sm" data-act="add-contact">${ic('plus', 'sm')} Adicionar contacto</button></div>
        <div class="card">${table([
          { label: 'Tipo', render: (k) => `${ic(k.type === 'Email' ? 'mail' : 'phone', 'sm')} ${esc(k.type)}` },
          { label: 'Descrição', render: (k) => `<b>${esc(k.value)}</b><span class="sub">${dt(k.created_at)}${k.main ? ' · principal' : ''}</span>` },
          { label: 'D/H', render: (k) => dash(k.schedule) },
          { label: '', cls: 'act', render: (k) => btnIcon('edit-contact', 'edit', 'Editar', { id: k.id }) + btnIcon('del-contact', 'trash', 'Remover', { id: k.id }) },
        ], d.contacts)}</div></div>
    </div>
    <div class="section-title mt">${ic('euro', 'sm')} Recibos em pagamento</div>
    <div class="card">${table([
      { label: 'Referência', key: 'reference' }, { label: 'Apólice', key: 'policy_number' }, { label: 'Vencimento', render: (y) => `<span class="${y.due_date < todayStr() ? 'badge danger' : ''}">${d10(y.due_date)}</span>` },
      { label: 'Valor', cls: 'num', render: (y) => eur(y.amount) }, { label: 'Estado', render: (y) => badge(y.status) },
      { label: '', cls: 'act', render: (y) => `<button class="btn sm" data-act="pay" data-id="${y.id}">Registar pagamento</button>` },
    ], d.receipts, { empty: 'Sem recibos pendentes.' })}</div>`;

  const ADDR = [
    { name: 'type', label: 'Tipo', type: 'select', placeholder: false, options: ['Residência', 'Correspondência', 'Trabalho'] },
    { name: 'description', label: 'Morada', required: true, full: true },
    { name: 'postal_code', label: 'Código postal', placeholder: '0000-000', attrs: 'pattern="\\d{4}-\\d{3}"' }, { name: 'city', label: 'Localidade' },
    { name: 'main', label: 'Morada principal', type: 'checkbox' },
  ];
  const CONT = [
    { name: 'type', label: 'Tipo', type: 'select', required: true, placeholder: false, options: ['Telemóvel', 'Telefone', 'Email'] },
    { name: 'value', label: 'Contacto', required: true }, { name: 'schedule', label: 'Disponibilidade (D/H)', placeholder: 'ex.: dias úteis 9h–13h' },
    { name: 'main', label: 'Contacto principal', type: 'checkbox' },
  ];
  acts['add-address'] = () => openModal({ title: 'Adicionar morada', fields: ADDR, onSubmit: async (v) => { await api(`/api/clients/${d.client.id}/addresses`, { method: 'POST', body: v }); toast('Morada adicionada'); refresh(); } });
  acts['edit-address'] = ({ id }) => openModal({ title: 'Editar morada', fields: ADDR, values: d.addresses.find((a) => a.id == id), onSubmit: async (v) => { await api(`/api/addresses/${id}`, { method: 'PUT', body: v }); toast('Morada atualizada'); refresh(); } });
  acts['del-address'] = async ({ id }) => { if (await confirmModal('Remover morada', 'Quer remover esta morada?', { label: 'Remover', danger: true })) { await api(`/api/addresses/${id}`, { method: 'DELETE' }); toast('Morada removida'); refresh(); } };
  acts['add-contact'] = () => openModal({ title: 'Adicionar contacto', fields: CONT, onSubmit: async (v) => { await api(`/api/clients/${d.client.id}/contacts`, { method: 'POST', body: v }); toast('Contacto adicionado'); refresh(); } });
  acts['edit-contact'] = ({ id }) => openModal({ title: 'Editar contacto', fields: CONT, values: d.contacts.find((k) => k.id == id), onSubmit: async (v) => { await api(`/api/contacts/${id}`, { method: 'PUT', body: v }); toast('Contacto atualizado'); refresh(); } });
  acts['del-contact'] = async ({ id }) => { if (await confirmModal('Remover contacto', 'Quer remover este contacto?', { label: 'Remover', danger: true })) { await api(`/api/contacts/${id}`, { method: 'DELETE' }); toast('Contacto removido'); refresh(); } };
  acts.pay = ({ id }) => payModal(id);
};

function payModal(id) {
  openModal({
    title: 'Registar pagamento', submitLabel: 'Registar',
    fields: [{ name: 'method', label: 'Método de pagamento', type: 'select', required: true, options: ['Multibanco', 'Débito Direto', 'MB WAY', 'Cartão', 'Transferência'] }],
    onSubmit: async (v) => { const x = await api(`/api/payments/${id}/pay`, { method: 'POST', body: v }); toast(`Pagamento registado · fatura-recibo ${x.invoice}`); if (x.restored) toast(`Cobertura da apólice ${x.restored} reposta — o seguro volta a estar válido`); refresh(); },
  });
}

// ---- Simulações ----
function simulationModal(c, family) {
  const { branches, products, campaigns } = state.meta;
  openModal({
    title: family ? 'Nova simulação família' : 'Nova simulação', submitLabel: 'Calcular e guardar',
    body: family ? '<div class="note" style="margin-bottom:14px">Simulação família: aplica 10% de desconto de agregado.</div>' : '',
    fields: [
      { name: 'branch', label: 'Ramo', type: 'select', required: true, options: branches },
      { name: 'product', label: 'Produto', type: 'select', required: true, options: [] },
      { name: 'plate', label: 'Matrícula', placeholder: '00-AA-00', hint: 'Obrigatório no ramo Automóvel.' },
      { name: 'campaign', label: 'Campanha', type: 'select', options: campaigns.filter((k) => k.active).map((k) => k.name), placeholder: 'Sem campanha', hint: 'Campanha ativa: 5% de desconto.' },
      { name: 'protocol', label: 'Protocolo' },
    ],
    onMount: (form) => {
      const br = form.elements.branch, pr = form.elements.product;
      br.onchange = () => {
        if (br.value === 'Automóvel') { form.closest('.modal-bg').remove(); location.hash = `#/cliente/${c.id}/simulador`; return; }
        setOptions(pr, Object.entries(products[br.value] || {}).map(([p, v]) => [p, `${p} (base ${eur(v)})`]));
      };
    },
    onSubmit: async (v) => {
      const r = await api(`/api/clients/${c.id}/simulations`, { method: 'POST', body: { ...v, family } });
      toast(`Simulação ${r.number} criada · prémio ${eur(r.premium)}`);
      if (parseHash().parts[2] === 'simulacoes') refresh(); else location.hash = `#/cliente/${c.id}/simulacoes`;
    },
  });
}
function simTab(source) {
  return async (el, d) => {
    const key = 'sim-' + source;
    const f = state.tf[key] ??= {};
    const isSite = source === 'Site';
    el.innerHTML = filterForm(key, [
      { name: 'branch', label: 'Ramo', type: 'select', options: state.meta.branches, placeholder: 'Todos' }, { name: 'number', label: 'Número' },
      { name: 'plate', label: 'Matrícula' }, { name: 'status', label: 'Situação', type: 'select', options: ['Pendente', 'Aceite', 'Rejeitada', 'Convertida'] },
      { name: 'from', label: 'Data de edição (de)', type: 'date' }, { name: 'to', label: 'a', type: 'date' },
    ], f) + `<div id="list"></div>` + (isSite ? '' : `<div class="btns mt" style="justify-content:flex-end">
      <button class="btn primary" data-act="sim-okauto">${ic('car', 'sm')} Simulador ok! auto</button><button class="btn" data-act="sim-new">${ic('plus', 'sm')} Nova simulação (outros ramos)</button><button class="btn" data-act="sim-family">${ic('users', 'sm')} Nova simulação família</button></div>`);
    const load = async () => {
      const r = await api(`/api/clients/${d.client.id}/simulations` + qs({ ...state.tf[key], source }));
      $('#list', el).innerHTML = `<div class="card">${table([
        { label: 'Número', render: (s) => `<b>${esc(s.number)}</b>${s.family ? '<span class="sub">Família</span>' : ''}` },
        { label: 'Ramo / Produto', render: (s) => `${esc(s.branch)}<span class="sub">${esc(s.product)}</span>` },
        { label: 'Situação', render: (s) => badge(s.status) }, { label: 'Matrícula', key: 'plate' },
        { label: 'Prémio', cls: 'num', render: (s) => eur(s.premium) }, { label: 'Protocolo', key: 'protocol' }, { label: 'Campanha', key: 'campaign' },
        { label: 'Data Edição', render: (s) => dt(s.edited_at) },
        { label: '', cls: 'act', render: (s) => s.status === 'Convertida' ? `<a class="btn sm ghost" href="#/cliente/${d.client.id}/apolices">${ic('link', 'sm')} ${esc(s.policy_number || 'Apólice')}</a>`
          : s.status === 'Rejeitada' ? `<button class="btn sm" data-act="sim-status" data-id="${s.id}" data-status="Pendente">Reabrir</button>`
          : `<button class="btn sm primary" data-act="sim-convert" data-id="${s.id}" data-n="${esc(s.number)}">Converter em apólice</button>
             ${s.status === 'Pendente' ? `<button class="btn sm" data-act="sim-status" data-id="${s.id}" data-status="Aceite">Aceitar</button>` : ''}
             <button class="btn sm danger" data-act="sim-status" data-id="${s.id}" data-status="Rejeitada">Rejeitar</button>` },
      ], r.simulations)}</div>`;
    };
    acts[key] = (v) => { state.tf[key] = v; return load(); };
    acts['sim-new'] = () => simulationModal(d.client, false);
    acts['sim-okauto'] = () => { location.hash = `#/cliente/${d.client.id}/simulador`; };
    acts['sim-family'] = () => simulationModal(d.client, true);
    acts['sim-status'] = async ({ id, status }) => { await api(`/api/simulations/${id}`, { method: 'PUT', body: { status } }); toast(`Simulação: ${status}`); load(); };
    acts['sim-convert'] = ({ id, n }) => openModal({
      title: `Converter ${n} em apólice`, submitLabel: 'Emitir apólice',
      body: '<p style="margin-top:0">Vai ser emitida uma apólice em vigor por 1 ano, com Condições Particulares, Fatura (e Carta Verde no ramo Automóvel) e o primeiro recibo.</p>',
      fields: [{ name: 'start_date', label: 'Data de início', type: 'date', required: true, value: todayStr() }],
      onSubmit: async (v) => { const r = await api(`/api/simulations/${id}/convert`, { method: 'POST', body: v }); clientPoliciesCache = null; toast(`Apólice ${r.number} emitida`); refresh(); },
    });
    await load();
  };
}
TABS.simulacoes = simTab('Praxis');
TABS.site = simTab('Site');

// ---- Apólices ----
TABS.apolices = async (el, d) => {
  const f = state.tf.pol ??= { status: 'Ativas' };
  const mgr = state.user.role !== 'agente';
  el.innerHTML = filterForm('pol', [
    { name: 'branch', label: 'Ramo', type: 'select', options: state.meta.branches, placeholder: 'Todos' }, { name: 'number', label: 'N.º Apólice' },
    { name: 'plate', label: 'Matrícula' }, { name: 'status', label: 'Situação', type: 'select', options: [['Ativas', 'Em vigor e suspensas'], 'Em Vigor', 'Suspensa', 'Anulada'], placeholder: 'Todas' },
  ], f) + '<div id="list"></div>';
  let rows = [];
  const load = async () => {
    rows = (await api(`/api/clients/${d.client.id}/policies` + qs(state.tf.pol))).policies;
    $('#list', el).innerHTML = `<div class="card">${table([
      { label: '', cls: 'act', render: (p) => btnIcon('pol-view', 'eye', 'Detalhe', { id: p.id })
          + (p.status === 'Suspensa' ? (p.cancel_scheduled_date ? '' : btnIcon('pol-cancel', 'x', 'Anular / não renovar', { id: p.id }))
            : p.status === 'Em Vigor' ? btnIcon('pol-edit', 'edit', 'Alteração de apólice', { id: p.id }) + btnIcon('pol-renew', 'refresh', 'Renovar', { id: p.id })
            + (p.cancel_scheduled_date || p.no_renew ? btnIcon('pol-uncancel', 'undo', p.cancel_scheduled_date ? 'Desfazer anulação agendada' : 'Desfazer não renovação', { id: p.id }) : btnIcon('pol-cancel', 'x', 'Anular / não renovar', { id: p.id })) : mgr ? btnIcon('pol-react', 'power', 'Reativar', { id: p.id }) : '') },
      { label: 'N.º Apólice', render: (p) => `<a href="#" data-act="pol-view" data-id="${p.id}"><b>${esc(p.number)}</b></a><span class="sub">${esc(p.branch)}</span>${p.status === 'Suspensa' ? `<span class="badge danger" title="${esc(p.suspended_reason || '')}">${ic('alert', 'sm')} Sem cobertura</span>` : ''}${p.pending_terms ? `<span class="badge warn" title="Termos e condições por aceitar">${ic('alert', 'sm')} Termos por aceitar</span>` : ''}${p.cancel_scheduled_date ? `<span class="badge warn">${ic('clock', 'sm')} Anulação a ${d10(p.cancel_scheduled_date)}</span>` : ''}${p.no_renew && p.status === 'Em Vigor' ? `<span class="badge danger" title="${esc(p.no_renew)}">Não renova</span>` : ''}` },
      { label: 'Nome Condutor', key: 'driver_name' }, { label: 'Matrícula', key: 'plate' }, { label: 'Data Início', render: (p) => d10(p.start_date) },
      { label: 'Data Fim', render: (p) => d10(p.end_date) }, { label: 'Produto', key: 'product' }, { label: 'Situação', render: (p) => badge(p.status) },
      { label: 'Valor Anual', cls: 'num', render: (p) => eur(p.annual_value) }, { label: 'Protocolo', key: 'protocol' }, { label: 'Campanha', key: 'campaign' },
    ], rows)}</div>`;
  };
  acts.pol = (v) => { state.tf.pol = v; return load(); };
  const find = (id) => rows.find((p) => p.id == id);
  acts['pol-view'] = async ({ id }) => {
    const r = await api(`/api/policies/${id}`);
    const p = r.policy;
    const n = state.meta.fractionN[p.fractioning] || 1;
    const kv = (label, value) => `<div class="kv"><span class="k">${esc(label)}:</span><span class="v">${value}</span></div>`;
    const ibanFmt = p.iban ? esc(p.iban.replace(/(.{4})/g, '$1 ').trim()) : '-';
    const body = `
      <div class="section-title" style="margin-top:0">Dados da Apólice${p.status === 'Em Vigor' ? `<button type="button" class="btn sm" data-term="alter">${ic('edit', 'sm')} Alteração de apólice</button>` : ''}${(p.status === 'Em Vigor' || p.status === 'Suspensa') && !p.cancel_scheduled_date ? `<button type="button" class="btn sm" data-term="cancel">${ic('x', 'sm')} Anular / não renovar</button>` : ''}</div>
      ${p.status === 'Suspensa' ? `<div class="alert-bar" style="margin:0 0 12px">${ic('alert')}<div><b>Sem cobertura desde ${d10(p.suspended_at)}.</b> ${esc(p.suspended_reason || '')}<small>A cobertura é reposta automaticamente quando os recibos em atraso forem pagos.</small></div></div>` : ''}
      <div class="pol-data">
        <div>${kv('Data de Início', d10(p.start_date))}${kv('Data de Vencimento', d10(p.end_date))}${kv('Situação', badge(p.status))}
          ${kv('Prazo de Renovação', `${p.renewal_term || 12} meses`)}${kv('Modo de Renovação', dash(p.renewal_mode))}
          ${kv('Não Renova', p.no_renew ? `<span class="badge danger">${esc(p.no_renew)}</span>` : '-')}</div>
        <div>${kv('Data/Hora de Formalização', dash(p.formalized_at))}${kv('Conta de Mediação', dash(p.mediation_account))}
          ${kv('Produto', `${esc(p.product)}<small>(${esc(p.branch)})</small>`)}${kv('Protocolo', dash(p.protocol))}${kv('Campanha', dash(p.campaign))}${kv('Canal', dash(p.channel))}</div>
        <div>${kv('Tabela de Bónus', dash(p.bonus_table))}${kv('Conta Cobrança', dash(p.collection_account))}${kv('IBAN', `<span class="mono">${ibanFmt}</span>`)}
          ${kv('Prémio', `<b>${eur(p.annual_value)}</b>${n > 1 ? `<small>${n} × ${eur(p.annual_value / n)}</small>` : ''}`)}${kv('Fraccionamento', dash(p.fractioning))}${kv('Fonte de Informação', dash(p.info_source))}</div>
      </div>
      <div class="pol-data pol-extra">
        <div>${p.branch === 'Automóvel' ? kv('Matrícula', dash(p.plate)) + kv('Veículo', `${dash([p.vehicle_make, p.vehicle_model].filter(Boolean).join(' '))}${p.vehicle_version ? `<small>${esc(p.vehicle_version)}${p.vehicle_use ? ' · ' + esc(p.vehicle_use) : ''}</small>` : ''}`) : kv('Ramo', esc(p.branch))}</div>
        <div>${p.branch === 'Automóvel' ? kv('Condutor', `${dash(p.driver_name)}${p.driver_birth_date ? `<small>nasc. ${d10(p.driver_birth_date)}</small>` : ''}`) + kv('Bónus / Malus', p.bonus_malus ? `${p.bonus_malus > 0 ? '+' : ''}${p.bonus_malus}%` : '0%') : ''}${p.cancel_reason ? kv('Motivo de anulação', esc(p.cancel_reason)) : ''}</div>
        <div>${kv('Desconto comercial', `${Number(p.commercial_discount || 0)}%`)}${kv('Versão de tarifa', dash(p.tariff_version))}
          ${p.cancel_scheduled_date ? kv('Anulação agendada', `<span class="badge warn">${d10(p.cancel_scheduled_date)}</span><small>${esc(p.cancel_reason || '')} · ${esc(p.cancel_refund_type || '')}</small>`) : ''}
          ${p.status === 'Anulada' && p.cancel_date ? kv('Data de anulação', `${d10(p.cancel_date)}<small>${esc(p.cancel_mode || '')}${p.cancel_refund_type ? ' · ' + esc(p.cancel_refund_type) : ''}${p.cancelled_by ? ' · ' + esc(p.cancelled_by) : ''}</small>`) : ''}</div></div>
      <div class="section-title mt">Aceitação de Termos e Condições</div>
      <div class="card">${table([
        { label: 'Tipo', render: (t) => `<button type="button" class="linkbtn" data-term="view" data-id="${t.id}" title="Ver detalhe">${esc(t.type)} ${ic('eye', 'sm')}</button>` },
        { label: 'Data de Criação', cls: 'num', render: (t) => esc(t.created_at) },
        { label: 'Data de Início', cls: 'num', render: (t) => d10(t.start_date) },
        { label: 'Data de Aceitação', cls: 'num', render: (t) => (t.accepted_at ? `${esc(t.accepted_at)}<span class="sub">${esc(t.accepted_via || '')}</span>` : `<span class="badge warn">(por aceitar)</span>${t.last_sent_at ? `<span class="sub">enviado ${dt(t.last_sent_at)}</span>` : ''}`) },
        { label: '', cls: 'act', render: (t) => (t.accepted_at || p.status === 'Anulada' ? '' : `<button type="button" class="btn sm" data-term="send" data-id="${t.id}">${ic('send', 'sm')} Enviar pedido</button>
          <button type="button" class="btn sm primary" data-term="accept" data-id="${t.id}">${ic('check', 'sm')} Registar aceitação</button>`) },
      ], r.terms, { empty: 'Sem registos de termos e condições.' })}</div>
      <div class="section-title mt">Recibos</div><div class="card">${table([{ label: 'Referência', key: 'reference' }, { label: 'Vencimento', render: (y) => d10(y.due_date) },
        { label: 'Valor', cls: 'num', render: (y) => eur(y.amount) }, { label: 'Estado', render: (y) => badge(y.status) }, { label: 'Método', key: 'method' }, { label: 'Pago em', render: (y) => dt(y.paid_at) }, { label: '', cls: 'act', render: invoiceBtn }], r.payments)}</div>
      <div class="section-title mt">Sinistros</div><div class="card">${table([{ label: 'N.º', key: 'number' }, { label: 'Data', render: (k) => d10(k.date) }, { label: 'Tipo', key: 'type' }, { label: 'Situação', render: (k) => badge(k.status) }], r.claims)}</div>`;
    const m = openModal({
      title: `Apólice ${p.number}`, wide: 'x', body,
      onMount: (form) => form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-term]');
        if (!b) return;
        e.preventDefault();
        const t = r.terms.find((x) => String(x.id) === b.dataset.id);
        const reopen = () => { m.close(); load(); acts['pol-view']({ id }).catch(handleErr); };
        if (b.dataset.term === 'alter') { m.close(); location.hash = `#/cliente/${d.client.id}/alteracao/${id}`; return; }
        if (b.dataset.term === 'cancel') { m.close(); cancelWizard(p, () => { clientPoliciesCache = null; refresh(); }); return; }
        if (b.dataset.term === 'view') {
          openModal({ title: `${t.type} · apólice ${p.number}`, body: `<dl class="dl" style="grid-template-columns:1fr 1fr">
            <div><dt>Tipo</dt><dd>${esc(t.type)}</dd></div><div><dt>Criado por</dt><dd>${dash(t.created_by)}</dd></div>
            <div><dt>Data de criação</dt><dd>${esc(t.created_at)}</dd></div><div><dt>Data de início</dt><dd>${d10(t.start_date)}</dd></div>
            <div><dt>Aceitação</dt><dd>${t.accepted_at ? `${esc(t.accepted_at)} · ${esc(t.accepted_via || '')}` : '<span class="badge warn">Por aceitar</span>'}</dd></div>
            <div><dt>Último pedido enviado</dt><dd>${dt(t.last_sent_at)}</dd></div></dl>
            <div class="section-title mt">O que mudou</div><p class="prewrap">${dash(t.description)}</p>` });
        }
        if (b.dataset.term === 'accept') {
          openModal({
            title: 'Registar aceitação dos termos', submitLabel: 'Registar aceitação',
            body: `<p style="margin-top:0">${esc(t.type)} da apólice <b>${esc(p.number)}</b>, com início a ${d10(t.start_date)}.</p>`,
            fields: [{ name: 'via', label: 'Forma de aceitação', type: 'select', required: true, full: true, options: state.meta.policyOptions.termsAccept }],
            onSubmit: async (v) => { await api(`/api/policy-terms/${t.id}/accept`, { method: 'POST', body: v }); toast('Aceitação dos termos registada'); reopen(); },
          });
        }
        if (b.dataset.term === 'send') {
          openModal({
            title: 'Enviar pedido de aceitação', submitLabel: 'Enviar',
            body: `<p style="margin-top:0">O cliente recebe uma ligação para rever e aceitar as condições na Área de Cliente.</p>`,
            fields: [{ name: 'channel', label: 'Canal', type: 'select', required: true, placeholder: false, full: true, options: ['Email', 'SMS'] }],
            onSubmit: async (v) => { const x = await api(`/api/policy-terms/${t.id}/send`, { method: 'POST', body: v }); toast(`Pedido enviado para ${x.recipient}`); reopen(); },
          });
        }
      }),
    });
  };
  acts['pol-edit'] = ({ id }) => { location.hash = `#/cliente/${d.client.id}/alteracao/${id}`; };
  acts['pol-renew'] = async ({ id }) => {
    const p = find(id);
    if (!(await confirmModal(`Renovar apólice ${p.number}`, `A apólice vai ser renovada por mais 1 ano a partir de ${p.end_date}, com atualização de 2% no prémio (${eur(p.annual_value)} → ${eur(p.annual_value * 1.02)}). São gerados os documentos de renovação.`, { label: 'Renovar' }))) return;
    await api(`/api/policies/${id}/renew`, { method: 'POST', body: {} }); toast('Apólice renovada'); refresh();
  };
  acts['pol-cancel'] = ({ id }) => cancelWizard(find(id), () => { clientPoliciesCache = null; refresh(); });
  acts['pol-uncancel'] = async ({ id }) => {
    const p = find(id);
    const what = p.cancel_scheduled_date ? `a anulação agendada para ${p.cancel_scheduled_date}` : `a indicação de não renovação (${p.no_renew})`;
    if (!(await confirmModal('Desfazer anulação', `Desfazer ${what} da apólice ${p.number}? A apólice continua em vigor normalmente.`, { label: 'Desfazer' }))) return;
    await api(`/api/policies/${id}/cancel/undo`, { method: 'POST', body: {} }); clientPoliciesCache = null; toast('Anulação desfeita'); refresh();
  };
  acts['pol-react'] = async ({ id }) => {
    if (!(await confirmModal('Reativar apólice', `Reativar a apólice ${find(id).number}?`, { label: 'Reativar' }))) return;
    await api(`/api/policies/${id}/reactivate`, { method: 'POST', body: {} }); clientPoliciesCache = null; toast('Apólice reativada'); refresh();
  };
  await load();
};


// ---- Tarifador ok! auto (separador escondido: #/cliente/:id/simulador) ----
let okMetaCache = null;
const okMeta = async () => (okMetaCache ||= await api('/api/okauto/meta'));
const covCell = (v) => (v == null ? '<span class="cov-no">—</span>' : typeof v === 'object' ? `<span class="cov-opt">Opcional<small>${esc(v.opt)}</small></span>` : `<span class="cov-yes">${ic('check', 'sm')}<small>${esc(v)}</small></span>`);
TABS.simulador = async (el, d) => {
  const M = await okMeta();
  const c = d.client, addr = d.addresses[0];
  const sel = (name, opts, val, extra = '') => `<select name="${name}" ${extra}>${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  const fld = (label, html, hint = '') => `<label class="ok-f"><span>${esc(label)}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
  el.innerHTML = `
    <div class="alt-title"><h2>${ic('car')} Simulador ok! auto</h2><div class="btns"><a class="btn sm" href="/#/produtos" target="_blank" rel="noopener">Guia do produto</a><a class="btn sm" href="#/cliente/${c.id}/simulacoes">Voltar às simulações</a></div></div>
    <div class="ok-layout">
      <form id="okForm" class="ok-form" novalidate>
        <fieldset><legend>${ic('user', 'sm')} Condutor habitual</legend>
          ${fld('Data de nascimento', `<input type="date" name="driverBirth" value="${esc(c.birth_date || '')}" required>`)}
          ${fld('Data da carta de condução', `<input type="date" name="licenseDate" value="${esc(c.license_date || '')}" required>`)}
          ${fld('Anos de seguro sem sinistros', `<input type="number" name="yearsNoClaims" min="0" max="40" required>`, 'Pela Declaração de Historial de Sinistros (últimos 5 anos).')}
          ${fld('Sinistros com responsabilidade na última anuidade', sel('claims', [0, 1, 2, 3, [4, 'Mais de 3']], 0))}
          <label class="ok-chk"><input type="checkbox" name="holderIsDriver" checked> O tomador do seguro é o condutor habitual</label>
        </fieldset>
        <fieldset><legend>${ic('car', 'sm')} Viatura</legend>
          ${fld('Matrícula', '<input name="plate" placeholder="AA-00-AA" maxlength="8" required>')}
          <div class="ok-row">${fld('Marca', '<input name="make" placeholder="ex.: Ford" required>')}${fld('Modelo', '<input name="model" placeholder="ex.: Puma" required>')}</div>
          ${fld('Versão', '<input name="version" placeholder="ex.: 1.0 EcoBoost Titanium">')}
          <div class="ok-row">${fld('Tipo de viatura', sel('type', M.vehicleTypes, M.vehicleTypes[0]))}${fld('Combustível', sel('fuel', M.fuels, 'Gasolina'))}</div>
          <div class="ok-row">${fld('Potência (cv)', '<input type="number" name="powerCv" min="40" max="1000" value="110" required>')}${fld('Data da 1.ª matrícula', '<input type="date" name="firstReg" required>')}</div>
          ${fld('Valor comercial (€)', '<input type="number" name="value" min="500" max="500000" step="100" required>', 'Valor de mercado atual; é o capital das coberturas de danos próprios.')}
          <label class="ok-chk"><input type="checkbox" name="zeroKm"> Veículo novo 0 km (sem vistoria)</label>
        </fieldset>
        <fieldset><legend>${ic('pin', 'sm')} Zona de residência</legend>
          ${fld('Código postal', `<input name="postalCode" value="${esc(addr?.postal_code || '')}" placeholder="0000-000" required>`, '<span id="okZone"></span>')}
        </fieldset>
        <fieldset><legend>${ic('euro', 'sm')} Pagamento e descontos</legend>
          <div class="ok-row">${fld('Fracionamento', sel('fractioning', M.fractionings, 'Anual'))}${fld('Meio de pagamento', sel('payment', M.payments, 'Débito direto'))}</div>
          ${fld('Campanha / parceria', sel('discount', M.discounts.map((x) => [x.key, x.label]), ''))}
          ${fld('Desconto multi-veículo (%)', '<input type="number" name="multiVehicle" min="0" max="15" step="1" value="0">', 'Até 15% com vários veículos do agregado na mesma apólice.')}
        </fieldset>
        <fieldset><legend>${ic('shield', 'sm')} Franquias</legend>
          ${fld('Danos próprios (smart e premium)', sel('franchise', M.franchises.map((x) => [x, `${x.toLocaleString('pt-PT')} €`]), 500), 'Nunca acima de 30% do valor do veículo.')}
          <div class="ok-row">${fld('Danos próprios (care)', sel('careFranchise', M.careFranchises.map((x) => [x, `${x} €`]), 1200))}${fld('Quebra de vidros', sel('qivFranchise', [[0, '0 €'], [25, '25 €']], 0))}</div>
        </fieldset>
        <fieldset><legend>${ic('plus', 'sm')} Coberturas opcionais</legend>
          ${M.optionals.map((o) => (o.choices ? fld(`${o.label} (${o.plans.join(', ')})`, sel(`opt_${o.key}`, [[0, 'Não'], ...o.choices.map((x) => [x, `${x} €/dia`])], 0))
            : `<label class="ok-chk"><input type="checkbox" name="opt_${o.key}"> ${esc(o.label)} <small class="muted">(${o.plans.join(', ')})</small></label>`)).join('')}
        </fieldset>
      </form>
      <div id="okRes"><div class="card card-b muted">Preencha os dados do condutor e da viatura para ver os preços dos 5 planos.</div></div>
    </div>`;
  const form = $('#okForm', el), res = $('#okRes', el);
  const collect = () => {
    const v = readForm(form);
    const optionals = {};
    for (const o of M.optionals) { const val = v[`opt_${o.key}`]; if (val && val !== '0' && val !== false) optionals[o.key] = o.choices ? Number(val) : true; }
    return { ...v, optionals };
  };
  let timer, last = null;
  const render = (q, input) => {
    if (!q.ok) { res.innerHTML = `<div class="card card-b"><div class="note">${ic('alert', 'sm')} ${q.errors.map(esc).join('<br>')}</div></div>`; return; }
    $('#okZone', el).textContent = `${q.zone.name} · nível de sinistralidade ${q.zone.level}/5`;
    const fr = input.fractioning;
    const cards = M.plans.map((p) => {
      const x = q.plans[p], info = M.planInfo[p];
      const incl = M.coverages.filter((cv) => cv.plans[p] && typeof cv.plans[p] === 'string');
      return `<div class="ok-plan ${x.available ? '' : 'off'} ${p === 'smart' ? 'hl' : ''}">
        <div class="ok-plan-h"><h3>${esc(info.title)}</h3>${x.needsInspection ? `<span class="badge info" title="Vistoria prévia na app AutoDigital">${ic('eye', 'sm')} vistoria</span>` : ''}</div>
        <p class="muted small">${esc(info.tagline)}</p>
        ${x.available ? `<div class="ok-price"><b>${eur(x.annualMonthly).replace(/\s?€/, '')}€</b><span>/mês</span></div>
          <div class="small">${eur(x.annual)}/ano (anual)${x.discount ? ` · <span class="badge ok">−${eur(x.discount)}</span>` : ''}</div>
          ${fr !== 'Anual' ? `<div class="small ok-frac">${esc(fr)}: <b>${x.fractions} × ${eur(x.perFraction)}</b><span class="muted"> (${eur(x.annualPaid)}/ano)</span></div>` : ''}`
          : `<div class="note small">${ic('alert', 'sm')} ${x.reasons.map(esc).join(' ')}</div>`}
        <ul class="ok-cov">${incl.map((cv) => `<li>${ic('check', 'sm')} ${esc(cv.label)}</li>`).join('')}${x.parts.filter((pt) => pt.label.startsWith('Opcional:')).map((pt) => `<li class="opt">${ic('plus', 'sm')} ${esc(pt.label.replace('Opcional: ', ''))}</li>`).join('')}</ul>
        <button type="button" class="btn ${p === 'smart' ? 'primary' : ''} sm" data-ok-save="${p}" ${x.available ? '' : 'disabled'}>${ic('check', 'sm')} Guardar simulação ${esc(info.title)}</button>
      </div>`;
    }).join('');
    res.innerHTML = `${q.warnings.length ? `<div class="note" style="margin-bottom:12px">${ic('alert', 'sm')} ${q.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="ok-plans">${cards}</div>
      <div class="ok-est">${ic('alert', 'sm')} Estimativa: o tarifador reproduz ao cêntimo os 3 exemplos publicados em okteleseguros.pt (9 preços); os restantes fatores são estimativas a substituir pela tarifa oficial. Preço válido à data da simulação.</div>
      <details class="card mt ok-det"><summary>${ic('chart', 'sm')} Fatores aplicados ao risco</summary><div class="card-b flush">${table([
        { label: 'Fator', key: 'label' }, { label: 'Valor', key: 'value' }, { label: 'Multiplicador', cls: 'num', render: (r) => `<b class="${r.factor > 1 ? 'up' : r.factor < 1 ? 'down' : ''}">×${r.factor.toFixed(2)}</b>` }], q.factors)}</div></details>
      <details class="card mt ok-det"><summary>${ic('euro', 'sm')} Decomposição do prémio por plano</summary><div class="card-b">${M.plans.filter((p) => q.plans[p].available).map((p) => `<div class="ok-parts"><b>${esc(p)}</b>${q.plans[p].parts.map((pt) => `<div><span>${esc(pt.label)}</span><span>${eur(pt.value)}</span></div>`).join('')}
        ${q.plans[p].discount ? `<div><span>Desconto (sobre o prémio comercial)</span><span>−${eur(q.plans[p].discount)}</span></div>` : ''}${q.plans[p].fractionSurcharge ? `<div><span>Encargo de fracionamento (${esc(fr)})</span><span>${eur(q.plans[p].fractionSurcharge)}</span></div>` : ''}
        <div class="tot"><span>Total anual</span><span>${eur(q.plans[p].annualPaid)}</span></div></div>`).join('')}</div></details>
      <details class="card mt ok-det" open><summary>${ic('shield', 'sm')} Comparar coberturas</summary><div class="card-b flush">${covTable(M)}</div></details>`;
  };
  const quote = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const input = collect();
      try { const q = await api('/api/okauto/quote', { method: 'POST', body: input }); last = { q, input }; render(q, input); }
      catch (ex) { res.innerHTML = `<div class="card card-b"><div class="note">${esc(ex.message)}</div></div>`; }
    }, 250);
  };
  form.addEventListener('input', quote);
  form.addEventListener('change', quote);
  res.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ok-save]');
    if (!b || !last) return;
    if (!form.reportValidity()) return;
    b.disabled = true;
    try {
      const r = await api(`/api/clients/${c.id}/okauto/simulations`, { method: 'POST', body: { plan: b.dataset.okSave, input: collect() } });
      toast(`Simulação ${r.number} guardada · ${r.plan.product} · ${eur(r.premium)}/ano`);
      location.hash = `#/cliente/${c.id}/simulacoes`;
    } catch (ex) { b.disabled = false; if (!ex.handled) toast(ex.message, 'error'); }
  });
  quote();
};
function covTable(M) {
  const groups = [...new Set(M.coverages.map((cv) => cv.group))];
  return `<div class="tbl-wrap"><table class="tbl cov-tbl"><thead><tr><th>Cobertura</th>${M.plans.map((p) => `<th>${esc(p)}</th>`).join('')}</tr></thead><tbody>
    ${groups.map((g) => `<tr class="grp"><td colspan="${M.plans.length + 1}">${esc(g)}</td></tr>${M.coverages.filter((cv) => cv.group === g).map((cv) => `<tr><td><b>${esc(cv.label)}</b><span class="sub" title="${esc(cv.info)}">${esc(cv.info.length > 90 ? cv.info.slice(0, 90) + '…' : cv.info)}</span></td>${M.plans.map((p) => `<td>${covCell(cv.plans[p])}</td>`).join('')}</tr>`).join('')}`).join('')}
  </tbody></table></div>`;
}

// ---- Guia de produtos ok! (para os agentes) ----
VIEWS.produtos = async (el) => {
  const M = await okMeta(), G = M.guide;
  const kv = (rows) => `<div class="tbl-wrap"><table class="tbl guide-tbl"><tbody>${rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>`;
  const ref = M.calibration.find((r) => r.key === 'A'), refB = M.calibration.find((r) => r.key === 'B');
  const desde = (p) => (p === 'care' ? refB.rows[0].site : ref.rows.find((x) => x.plan === p)?.site);
  const bm = Object.entries(M.bonusMalus).map(([lvl, [pct, a, b, c2, d2]]) => ({ lvl, pct, a, b, c2, d2 }));
  el.innerHTML = pageHead('Produtos ok!', `Tudo o que é importante para explicar o seguro ao cliente. Fontes: Informação Pré-Contratual, Condições Gerais e Especiais e okteleseguros.pt (consultados a ${d10(G.consulted)}).`,
    '', '<a href="#/">Início</a> › Operação › Produtos ok!') + `
    <div class="guide-nav">${[['g-planos', 'Planos'], ['g-cob', 'Coberturas'], ['g-assist', 'Assistência'], ['g-pj', 'Proteção Jurídica'], ['g-fr', 'Franquias'], ['g-bm', 'Bónus/Malus'], ['g-regras', 'Regras do contrato'], ['g-pag', 'Pagamento e descontos'], ['g-extra', 'Vantagens'], ['g-contactos', 'Contactos'], ['g-outros', 'Outros seguros'], ['g-calib', 'Tarifador']].map(([id, l]) => `<a href="#" data-goto="${id}">${l}</a>`).join('')}</div>
    <div class="card mt" id="g-planos"><div class="card-h"><h3>${ic('car')} Planos ok! auto</h3><span class="muted small">${esc(G.target)}</span></div>
      <div class="card-b"><div class="ok-plans">${M.plans.map((p) => `<div class="ok-plan ${p === 'smart' ? 'hl' : ''}"><div class="ok-plan-h"><h3>${esc(p)}</h3></div><p class="muted small">${esc(M.planInfo[p].tagline)}</p>
        <div class="ok-price"><small>desde</small> <b>${desde(p).toFixed(2).replace('.', ',')}€</b><span>/mês</span></div><p class="small">${esc(M.planInfo[p].desc)}</p></div>`).join('')}</div>
        <p class="muted small" style="margin:12px 0 0">"Desde": exemplos publicados no site (anual, débito direto) — simple/safe/smart/premium: Ford Puma 1.0 de 01/2025, condutor de 50 anos, 20 anos de carta, 6 anos sem sinistros, Redondo, franquia 500 €; care: Mini Countryman Diesel de 07/2013, franquia 1.200 €. Use o simulador na ficha do cliente para o preço do caso concreto.</p></div></div>
    <div class="card mt" id="g-cob"><div class="card-h"><h3>${ic('shield')} Coberturas e capitais por plano</h3></div><div class="card-b flush">${covTable(M)}</div>
      <div class="card-b"><div class="guide-defs">${M.coverages.map((cv) => `<div><b>${esc(cv.label)}</b><p>${esc(cv.info)}</p></div>`).join('')}</div>
      <div class="note mt">${ic('eye', 'sm')} Coberturas de danos próprios (Vidros, Choque, Furto, Fenómenos, Incêndio, Vandalismo, Privação de Uso) exigem <b>vistoria prévia</b> na app AutoDigital, exceto veículos 0 km. No plano care as reparações são feitas na rede Auto Care e podem usar peças usadas/IAM certificadas.</div></div></div>
    <div class="grid g2 mt">
      <div class="card" id="g-assist"><div class="card-h"><h3>${ic('phone')} Assistência em Viagem (Fidelidade Assistance 24/7)</h3></div><div class="card-b flush"><div class="tbl-wrap"><table class="tbl guide-tbl"><thead><tr><th>Garantia</th><th>ok! 1</th><th>ok! 2</th><th>ok! 3</th></tr></thead><tbody>
        ${G.assistance.map((r) => `<tr>${r.map((x, k) => `<td>${k ? esc(x) : `<b>${esc(x)}</b>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="muted small" style="padding:10px 16px;margin:0">simple: ok! 1 · safe, smart, care e premium: ok! 2 (ok! 3 opcional em safe, smart e premium). Pedido de assistência: app ok! ou 217 912 827 (24h).</p></div></div>
      <div class="card" id="g-pj"><div class="card-h"><h3>${ic('file')} Proteção Jurídica</h3></div><div class="card-b flush">${kv(G.legal)}</div></div>
    </div>
    <div class="card mt" id="g-fr"><div class="card-h"><h3>${ic('euro')} Franquias</h3></div><div class="card-b flush">${kv(G.franchises)}</div></div>
    <div class="card mt" id="g-bm"><div class="card-h"><h3>${ic('chart')} Bónus/Malus (tabela oficial da CGE)</h3><span class="muted small">Só na Responsabilidade Civil e no Choque/Colisão/Capotamento</span></div>
      <div class="card-b flush"><div class="tbl-wrap"><table class="tbl guide-tbl"><thead><tr><th>Nível</th><th>% do prémio</th><th>0 sinistros →</th><th>1 sinistro →</th><th>2 sinistros →</th><th>3 sinistros →</th></tr></thead><tbody>
        ${bm.map((r) => `<tr class="${Number(r.lvl) === M.bonusEntry ? 'hl-row' : ''}"><td><b>${r.lvl}</b>${Number(r.lvl) === M.bonusEntry ? ' <span class="badge info">entrada</span>' : ''}</td><td>${r.pct}%</td><td>${r.a}</td><td>${r.b}</td><td>${r.c2}</td><td>${r.d2}</td></tr>`).join('')}
      </tbody></table></div><p class="muted small" style="padding:10px 16px;margin:0">Mais de 3 sinistros numa anuidade: caso a caso. O nível de entrada (11 = 100%) é uma estimativa: a CGE não o indica.</p></div></div>
    <div class="card mt" id="g-regras"><div class="card-h"><h3>${ic('file')} Regras do contrato</h3></div><div class="card-b flush">${kv(G.rules)}</div></div>
    <div class="grid g2 mt">
      <div class="card" id="g-pag"><div class="card-h"><h3>${ic('card')} Pagamento, campanhas e descontos</h3></div><div class="card-b flush">${kv(G.payments)}</div></div>
      <div class="card" id="g-extra"><div class="card-h"><h3>${ic('check')} Vantagens e serviços</h3></div><div class="card-b flush">${kv(G.extras)}</div></div>
    </div>
    <div class="card mt" id="g-contactos"><div class="card-h"><h3>${ic('phone')} Contactos para o cliente</h3></div><div class="card-b flush">${kv(G.contacts)}</div></div>
    <div class="card mt" id="g-outros"><div class="card-h"><h3>${ic('shield')} Outros seguros ok!</h3></div><div class="card-b"><div class="grid g3">${G.otherProducts.map((o) => `<div class="other-prod"><h4>${esc(o.name)}</h4><div class="price">${esc(o.price)}</div><p>${esc(o.points)}</p></div>`).join('')}</div></div></div>
    <div class="card mt" id="g-calib"><div class="card-h"><h3>${ic('calc')} Tarifador: comparação com os preços publicados</h3></div><div class="card-b flush">${table([
      { label: 'Perfil', render: (r) => `<b>${esc(r.key)}</b><span class="sub">${esc(r.label)}</span>` }, { label: 'Plano', key: 'plan' },
      { label: 'Site (anual)', cls: 'num', render: (r) => `${r.site.toFixed(2)} €/mês` }, { label: 'Praxis (anual)', cls: 'num', render: (r) => `<b>${r.model.toFixed(2)} €/mês</b>` },
      { label: 'Site (semestral)', cls: 'num', render: (r) => (r.siteSemestral ? `${r.siteSemestral.toFixed(2)} €/mês` : '-') }, { label: 'Praxis (semestral)', cls: 'num', render: (r) => `${r.modelSemestral.toFixed(2)} €/mês` },
    ], M.calibration.flatMap((c) => c.rows.map((r) => ({ ...r, key: c.key, label: c.label }))))}</div>
      <div class="card-b"><p class="muted small" style="margin:0">A tarifa oficial da seguradora não é pública. Os perfis acima são reproduzidos ao cêntimo; idade, carta, zona, potência, marca, valor, idade do veículo, franquias, opcionais, pagamento e o encargo de trimestral/mensal são estimativas (o bónus/malus usa a tabela oficial). Substitua os fatores em <code>server/okauto.js</code> quando tiver a tarifa.</p>
      <h4 style="margin:14px 0 6px">Documentos de referência</h4><ul class="small">${G.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a></li>`).join('')}</ul></div></div>`;
  el.querySelector('.guide-nav').addEventListener('click', (e) => { const a = e.target.closest('[data-goto]'); if (!a) return; e.preventDefault(); $(`#${a.dataset.goto}`, el)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
};

// ---- Anular / não renovar apólice (1.º passo: motivo em caixas · 2.º passo: dados da anulação) ----
const cancelGroupsFor = (branch) => state.meta.cancelReasons.filter((g) => !g.branches || g.branches.includes(branch));
const cancelReasonDef = (branch, r) => cancelGroupsFor(branch).flatMap((g) => g.items).find((x) => x.r === r);
const addDaysStr = (s, n) => { const x = new Date(s.slice(0, 10) + 'T12:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
function cancelWizard(p, onDone, preset) {
  openModal({
    title: `Anular/Não renovar apólice - ${p.number}`, wide: true, submitLabel: 'Seguinte', cancelLabel: 'Fechar',
    body: `<div class="cx-steps"><span class="on">1 · Motivo</span><span>2 · Anulação</span></div>
      <p class="muted" style="margin:0 0 14px">Escolha o motivo da anulação ou da não renovação da apólice <b>${esc(p.number)}</b> (${esc(p.branch)} · ${esc(p.product)}${p.plate ? ' · ' + esc(p.plate) : ''}).</p>
      <div class="reason-groups">${cancelGroupsFor(p.branch).map((g) => `<fieldset class="reason-group"><legend>${ic(g.icon, 'sm')} ${esc(g.group)}</legend>
        <div class="reason-grid">${g.items.map((it) => `<label class="reason"><input type="radio" name="reason" value="${esc(it.r)}" required ${it.r === preset ? 'checked' : ''}>
          <span><b>${esc(it.r)}</b>${it.proof ? `<small>${ic('file', 'sm')} ${esc(it.proof)}</small>` : it.nr ? '<small>Normalmente: não renovação</small>' : it.notes ? '<small>Descrever nas observações</small>' : ''}</span></label>`).join('')}</div></fieldset>`).join('')}</div>`,
    onSubmit: (v) => {
      if (!v.reason) throw new Error('Escolha o motivo.');
      setTimeout(() => cancelStep2(p, v.reason, onDone), 0);
    },
  });
}
function cancelStep2(p, reason, onDone) {
  const def = cancelReasonDef(p.branch, reason) || {};
  const auto = p.branch === 'Automóvel';
  const kind0 = def.nr ? 'Não Renovação' : 'Anulação';
  const radio = (name, value, checked) => `<label class="radio"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}> ${esc(value)}</label>`;
  const row = (label, html, cls = '') => `<div class="alt-row ${cls}"><span class="k">${esc(label)}</span><div class="v">${html}</div></div>`;
  const opts = cancelGroupsFor(p.branch).map((g) => `<optgroup label="${esc(g.group)}">${g.items.map((it) => `<option ${it.r === reason ? 'selected' : ''}>${esc(it.r)}</option>`).join('')}</optgroup>`).join('');
  const m = openModal({
    title: `Anular/Não renovar apólice - ${p.number}`, wide: true, submitLabel: 'Guardar', cancelLabel: 'Fechar',
    body: `<div class="cx-steps"><span class="done">${ic('check', 'sm')} 1 · Motivo</span><span class="on">2 · Anulação</span><button type="button" class="linkbtn" data-cx="back">Alterar motivo</button></div>
      <div class="alt-box cx-form">
        ${row('Tipo', radio('kind', 'Anulação', kind0 === 'Anulação') + radio('kind', 'Não Renovação', kind0 === 'Não Renovação'))}
        ${row('Modo Anulação', radio('mode', 'Imediato', true) + radio('mode', 'Diferido', false), 'cx-anul')}
        ${row('Data Anulação', `<input type="date" name="date" value="${todayStr()}" required>`)}
        ${row('Tipo Anulação', '<select name="refund_type"><option>Pro-Rata</option><option>Sem estorno</option></select>', 'cx-anul')}
        ${row('Motivo Anulação', `<select name="reason">${opts}</select>`)}
        ${row('Reter Carta de Cancelamento', '<input type="checkbox" name="retain_letter">')}
        ${auto ? row('Reter Certificado de Tarifação', '<input type="checkbox" name="retain_certificate">') : ''}
        ${row('Comprovativo', '<label class="chk"><input type="checkbox" name="proof_received"> <span class="cx-proof"></span></label>', 'cx-proof-row')}
        ${row('Observações', '<textarea name="notes" rows="2" maxlength="1000"></textarea>')}
      </div>
      <div class="cx-summary" aria-live="polite"></div>
      <div class="modal-wait" hidden><div><span class="spin"></span> Aguarde…</div></div>`,
    onMount: (form) => {
      const tomorrow = addDaysStr(todayStr(), 1), lastDay = addDaysStr(p.end_date, -1);
      const sync = () => {
        const nr = form.kind.value === 'Não Renovação';
        $$('.cx-anul input, .cx-anul select', form).forEach((x) => { x.disabled = nr; });
        const dateI = form.date;
        if (nr) { dateI.value = p.end_date; dateI.readOnly = true; dateI.removeAttribute('min'); dateI.removeAttribute('max'); }
        else if (form.mode.value === 'Diferido') { dateI.readOnly = false; dateI.min = tomorrow; dateI.max = lastDay; if (!(dateI.value >= tomorrow && dateI.value <= lastDay)) dateI.value = tomorrow; }
        else { let maxD = p.end_date < todayStr() ? p.end_date : todayStr(); if (maxD < p.start_date) maxD = p.start_date; dateI.readOnly = maxD === p.start_date; dateI.min = p.start_date; dateI.max = maxD; if (!(dateI.value >= p.start_date && dateI.value <= maxD)) dateI.value = maxD; }
        const d2 = cancelReasonDef(p.branch, form.reason.value) || {};
        $('.cx-proof-row', form).hidden = !d2.proof;
        $('.cx-proof', form).textContent = d2.proof ? `Recebido: ${d2.proof}` : '';
        form.notes.required = !!d2.notes;
        form.notes.placeholder = d2.notes ? 'Obrigatório: descreva o motivo' : 'Opcional';
      };
      let timer;
      const box = $('.cx-summary', form);
      const preview = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const v = readForm(form);
          try { box.innerHTML = cancelSummary(await api(`/api/policies/${p.id}/cancel/preview`, { method: 'POST', body: v }), v, auto); }
          catch (ex) { box.innerHTML = `<div class="note">${ic('alert', 'sm')} ${esc(ex.message)}</div>`; }
        }, 220);
      };
      form.addEventListener('change', () => { sync(); preview(); });
      form.addEventListener('input', (e) => { if (e.target.name === 'notes' || e.target.name === 'date') preview(); });
      $('[data-cx=back]', form).onclick = () => { m.close(); cancelWizard(p, onDone, form.reason.value); };
      sync(); preview();
    },
    onSubmit: async (v, form) => {
      const wait = $('.modal-wait', form);
      wait.hidden = false;
      try {
        const r = await api(`/api/policies/${p.id}/cancel`, { method: 'POST', body: v });
        toast(r.kind === 'Não Renovação' ? `Apólice ${p.number} marcada para não renovar (termina a ${r.date})`
          : r.mode === 'Diferido' ? `Anulação da apólice ${p.number} agendada para ${r.date}`
          : `Apólice ${p.number} anulada${r.refund ? ` · estorno de ${eur(r.refund)} a devolver` : r.owed ? ` · novo recibo de ${eur(r.owed)} em dívida` : ''}`);
        if (r.process) toast(`Processo ${r.process} criado para recolher o comprovativo`);
        onDone?.();
      } finally { wait.hidden = true; }
    },
  });
}
function cancelSummary(x, v, auto) {
  const head = x.kind === 'Não Renovação' ? `A apólice <b>não será renovada</b> e termina a <b>${d10(x.date)}</b>. Mantém-se em vigor até lá, sem estorno.`
    : x.mode === 'Diferido' ? `A anulação fica <b>agendada para ${d10(x.date)}</b>. Até lá a apólice mantém-se em vigor; o estorno é calculado nessa data.`
    : `A apólice fica <b>anulada com efeitos a ${d10(x.date)}</b>.`;
  const rows = x.kind === 'Não Renovação' ? [] : [
    ['Prémio pago nesta anuidade', eur(x.paid)],
    [`Prémio consumido (${x.usedDays} de ${x.totalDays} dias)`, eur(x.premiumUsed)],
    ...(x.refundType !== 'Pro-Rata' ? [['Estorno', 'Sem estorno']]
      : x.owed > 0 ? [[x.mode === 'Diferido' ? 'Prémio em dívida (estimado)' : 'Prémio em dívida — novo recibo', eur(x.owed), 'warn']]
      : [[x.mode === 'Diferido' ? 'Estorno estimado' : 'Estorno a devolver ao cliente', eur(x.refund), 'hl']]),
    ['Recibos pendentes a anular', x.pendingCancelled.n ? `${x.pendingCancelled.n} · ${eur(x.pendingCancelled.total)}` : '—'],
    ...(x.pendingKept.n ? [['Recibos pendentes que se mantêm em dívida', `${x.pendingKept.n} · ${eur(x.pendingKept.total)}`, 'warn']] : []),
  ];
  const notes = [`Gera a Carta de Cancelamento${v.retain_letter ? ' (retida)' : ''}${auto ? ` e o Certificado de Tarifação${v.retain_certificate ? ' (retido)' : ''}` : ''}.`];
  if (x.proof && !v.proof_received) notes.push(`Fica aberto um processo para recolher: ${esc(x.proof)}.`);
  return `<div class="cx-sum"><p>${head}</p>${rows.length ? `<dl class="cx-dl">${rows.map(([k, val, cls]) => `<dt>${esc(k)}</dt><dd class="${cls || ''}">${val}</dd>`).join('')}</dl>` : ''}
    <ul>${notes.map((n) => `<li>${n}</li>`).join('')}</ul></div>`;
}

// ---- Comentários (painel lateral e separador) ----
const COMMENT_CLASS = { Nota: '', Contacto: 'info', Pedido: 'brand', 'Reclamação': 'danger', Alerta: 'warn' };
const commentCache = new Map();
const commentText = (t) => esc(t).replace(/\b(9\d{8})\b/g, '<span class="ref">$1</span>');
function commentItem(m) {
  commentCache.set(String(m.id), m);
  const mine = m.user_id === state.user.id || state.user.role !== 'agente';
  return `<div class="comment${m.pinned ? ' pinned' : ''}">
    <div class="comment-h"><span class="badge ${COMMENT_CLASS[m.category] ?? ''}">${esc(m.category || 'Nota')}</span>${m.pinned ? `<span class="pin-flag">${ic('pinned', 'sm')} Fixado</span>` : ''}
      <div class="comment-act">${btnIcon('cm-pin', 'pinned', m.pinned ? 'Desafixar' : 'Fixar no topo', { id: m.id, pinned: m.pinned ? 0 : 1 }, m.pinned ? 'on' : '')}
        ${mine ? btnIcon('cm-edit', 'edit', 'Alterar', { id: m.id }) + btnIcon('del-comment', 'trash', 'Eliminar', { id: m.id }) : ''}</div></div>
    <p>${commentText(m.text)}</p>
    <small><b>${esc(m.username || 'Sistema')}</b> · ${dt(m.created_at)}${m.policy_number ? ` · apólice ${esc(m.policy_number)}` : ''}${m.edited_at ? ` · editado ${dt(m.edited_at)}${m.edited_by && m.edited_by !== m.username ? ' por ' + esc(m.edited_by) : ''}` : ''}</small>
  </div>`;
}
function commentForm(d, { full = false } = {}) {
  return `<form data-form="comment" class="comment-form">
    <textarea name="text" required maxlength="2000" rows="${full ? 4 : 3}" placeholder="Escreva uma nota sobre o cliente… (Ctrl+Enter para guardar)"></textarea>
    <div class="comment-form-row">
      <select name="category" title="Tipo de comentário">${state.meta.commentCategories.map((k) => `<option>${esc(k)}</option>`).join('')}</select>
      ${full ? `<select name="policy_number" title="Apólice relacionada"><option value="">Sem apólice</option>${d.policyNumbers.map((x) => `<option value="${esc(x.number)}">${esc(x.number)} · ${esc(x.branch)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" name="pinned"> Fixar no topo</label>` : ''}
      <button class="btn primary sm" type="submit">${ic('plus', 'sm')} Guardar</button>
    </div></form>`;
}
TABS.comentarios = async (el, d) => {
  const f = state.tf.cm ??= {};
  el.innerHTML = `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${ic('msg')} Novo comentário</h3></div><div class="card-b">${commentForm(d, { full: true })}</div></div>
    ${filterForm('cmfilter', [{ name: 'q', label: 'Pesquisar no texto' }, { name: 'category', label: 'Tipo', type: 'select', options: state.meta.commentCategories, placeholder: 'Todos' },
      { name: 'author', label: 'Autor', type: 'select', options: [], placeholder: 'Todos' }, { name: 'policy', label: 'Apólice', type: 'select', options: d.policyNumbers.map((x) => x.number), placeholder: 'Todas' }], f)}
    <div id="cmList"></div>`;
  const load = async () => {
    const r = await api(`/api/clients/${d.client.id}/comments` + qs(state.tf.cm));
    const sel = $('select[name=author]', el);
    if (sel && sel.options.length <= 1) { r.authors.forEach((a) => sel.add(new Option(a, a))); sel.value = state.tf.cm.author || ''; }
    $('#cmList', el).innerHTML = r.comments.length
      ? `<div class="muted small" style="margin:4px 0 10px">${r.comments.length} comentário(s)${r.comments.some((m) => m.pinned) ? ' · os fixados aparecem primeiro' : ''}</div><div class="card comment-list">${r.comments.map(commentItem).join('')}</div>`
      : '<p class="muted">Sem comentários para mostrar.</p>';
  };
  acts.cmfilter = (v) => { state.tf.cm = v; return load(); };
  await load();
};

// ---- Alteração de Apólice (separador escondido: #/cliente/:id/alteracao/:policyId) ----
function altFields(p) {
  const o = state.meta.policyOptions;
  return {
    driver: [{ name: 'driver_name', label: 'Nome do condutor habitual', required: true, full: true }, { name: 'driver_birth_date', label: 'Data de nascimento', type: 'date', required: true },
      { name: 'driver_license', label: 'N.º carta de condução' }, { name: 'driver_license_date', label: 'Data da carta de condução', type: 'date', required: true }],
    vehicle: [{ name: 'plate', label: 'Matrícula', required: true, placeholder: 'AA-00-AA' }, { name: 'vehicle_make', label: 'Marca', required: true },
      { name: 'vehicle_model', label: 'Modelo', required: true }, { name: 'vehicle_version', label: 'Versão' }, { name: 'vehicle_first_reg', label: 'Data da 1.ª matrícula', type: 'date' },
      { name: 'vehicle_use', label: 'Uso do veículo', type: 'select', required: true, placeholder: false, options: o.vehicleUse },
      { name: 'vehicle_value', label: 'Valor do veículo (€)', type: 'number', attrs: 'min="0" max="500000" step="100"' }],
    product: [{ name: 'product', label: 'Produto', type: 'select', required: true, placeholder: false, options: Object.keys(state.meta.products[p.branch]) }],
    payment: [{ name: 'collection_account', label: 'Conta cobrança', type: 'select', required: true, options: o.collection },
      { name: 'iban', label: 'IBAN', placeholder: 'PT50 0000 0000 0000 0000 0000 0', hint: 'Obrigatório para cobrança por EFT (débito direto)' }],
    fractioning: [{ name: 'fractioning', label: 'Fraccionamento', type: 'select', required: true, placeholder: false, options: o.fractioning, hint: 'O fracionamento mensal exige cobrança por EFT' }],
    discount: [{ name: 'commercial_discount', label: 'Desconto comercial (%)', type: 'number', attrs: 'min="0" max="30" step="0.5"', hint: 'Acima de 10%, os agentes precisam de um código de subscrição' }],
    bonus: [{ name: 'bonus_table', label: 'Tabela de bónus', type: 'select', options: o.bonusTables, placeholder: '-' },
      { name: 'bonus_malus', label: 'Bónus (−) / Malus (+) em %', type: 'number', attrs: 'min="-50" max="150" step="1"', hint: 'Ex.: −30 = 30% de bónus; +25 = 25% de agravamento' }],
    renewal: [{ name: 'renewal_mode', label: 'Modo de renovação', type: 'select', required: true, placeholder: false, options: o.renewalMode },
      { name: 'no_renew', label: 'Não renova', type: 'select', options: o.noRenew, placeholder: 'Renova normalmente' }],
    commercial: [{ name: 'protocol', label: 'Protocolo' }, { name: 'campaign', label: 'Campanha', type: 'select', options: state.meta.campaigns.map((k) => k.name), placeholder: 'Sem campanha' }],
    other: [{ name: 'channel', label: 'Canal', type: 'select', options: o.channel, placeholder: '-' }, { name: 'info_source', label: 'Fonte de informação', type: 'select', options: o.infoSource, placeholder: '-' }],
  };
}
TABS.alteracao = async (el, d, [pid]) => {
  const r = await api(`/api/policies/${encodeURIComponent(pid)}`);
  const p = r.policy;
  const back = `#/cliente/${d.client.id}/apolices`;
  if (p.client_id !== d.client.id) { el.innerHTML = '<p class="muted">Esta apólice não pertence a este cliente.</p>'; return; }
  if (p.status !== 'Em Vigor') { el.innerHTML = `<div class="note">${ic('alert', 'sm')} A apólice ${esc(p.number)} está ${esc(p.status)} e não pode ser alterada.</div><p><a class="btn" href="${back}">Voltar às apólices</a></p>`; return; }
  const auto = p.branch === 'Automóvel';
  const sections = state.meta.alterationSections.filter((x) => auto || !x.auto);
  const fields = altFields(p);
  const iso = (dt0) => dt0.toISOString().slice(0, 10);
  const lastDay = iso(new Date(new Date(p.end_date + 'T12:00:00').getTime() - 864e5));
  const def = todayStr() < p.start_date ? p.start_date : todayStr() > lastDay ? lastDay : todayStr();
  const row = (label, html) => `<div class="alt-row"><span class="k">${esc(label)}</span><div class="v">${html}</div></div>`;
  const info = (text) => `<span class="info" tabindex="0" title="${esc(text)}" aria-label="${esc(text)}">i</span>`;
  el.innerHTML = `
    <div class="alt-title"><h2>Alteração de Apólice Nº ${esc(p.number)}</h2><a class="btn sm" href="${back}">Voltar às apólices</a></div>
    <form id="altForm" novalidate>
      <div class="alt-top">
        <div class="alt-box">
          ${row('Data de Renovação', `<b>${d10(p.end_date)}</b>`)}
          ${row('Data de Início da Alteração', `<input type="date" name="effective_date" value="${def}" min="${p.start_date}" max="${lastDay}" required>`)}
          ${row('Tipo de Alteração', `<label class="radio"><input type="radio" name="kind" value="Alteração" checked> Alteração</label><label class="radio"><input type="radio" name="kind" value="Correcção"> Correcção</label>
            ${info('Alteração: produz efeitos na data indicada. Correcção: corrige um erro nos dados desde o início da anuidade (' + p.start_date + ').')}`)}
          ${row('Manter Versão de Tarifa', `<label class="radio"><input type="radio" name="keep" value="1"> Sim</label><label class="radio"><input type="radio" name="keep" value="0" checked> Não</label>
            ${info('Sim: mantém a versão de tarifa atual e aplica só o efeito das alterações ao prémio. Não: retarifica com a versão em vigor (' + state.meta.tariffVersion + ').')}<span class="muted small">${esc(p.tariff_version || '-')} (${esc(p.product)})</span>`)}
          ${row('Código Subscrição', `<input name="subscription_code" maxlength="20" autocomplete="off" style="max-width:160px">${info('Autorização do supervisor, obrigatória para descontos comerciais acima de 10% pedidos por agentes.')}`)}
        </div>
        <div class="alt-box alt-sum">
          ${row('Cliente', esc(d.client.name))}${row('Produto', `${esc(p.product)} <span class="muted small">(${esc(p.branch)})</span>`)}
          ${row('Prémio atual', `<b>${eur(p.annual_value)}</b> <span class="muted small">${esc(p.fractioning || '')}</span>`)}
          ${auto ? row('Matrícula', dash(p.plate)) : ''}${row('Termos por aceitar', r.terms.filter((t) => !t.accepted_at).length ? `<span class="badge warn">${r.terms.filter((t) => !t.accepted_at).length}</span>` : '<span class="badge ok">0</span>')}
        </div>
      </div>
      <div class="card mt"><div class="card-h"><h3>${ic('edit')} Selecção de Alterações</h3></div>
        <div class="tbl-wrap"><table class="tbl alt-sel"><thead><tr><th style="width:46px"></th><th>Alterações</th></tr></thead><tbody>
          ${sections.map((x) => `<tr><td><input type="checkbox" name="sec" value="${x.key}" id="sec-${x.key}"></td><td><label for="sec-${x.key}">${esc(x.label)}</label></td></tr>`).join('')}
        </tbody></table></div></div>
      ${sections.map((x) => `<fieldset class="card mt alt-sec" data-sec="${x.key}" hidden disabled><div class="card-h"><h3>${esc(x.label)}</h3></div>
        <div class="card-b">${formGrid(fields[x.key], p)}</div></fieldset>`).join('')}
      <div class="form-error mt" id="altErr" hidden></div>
      <div id="altPreview"></div>
      <div class="btns mt" style="justify-content:flex-end"><a class="btn" href="${back}">Cancelar</a><button type="submit" class="btn primary">${ic('calc', 'sm')} Calcular alteração</button></div>
    </form>`;
  const form = $('#altForm', el), err = $('#altErr', el), prev = $('#altPreview', el);
  let plan = null;
  const clearPlan = () => { plan = null; prev.innerHTML = ''; };
  const showErr = (m) => { err.textContent = m; err.hidden = !m; };
  const collect = () => {
    const keys = $$('input[name=sec]:checked', form).map((x) => x.value);
    const data = {};
    for (const k of keys) Object.assign(data, readForm($(`fieldset[data-sec="${k}"]`, form)));
    return { kind: form.kind.value, keep_tariff: form.keep.value === '1', effective_date: form.effective_date.value, subscription_code: form.subscription_code.value.trim(), sections: keys, data };
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'sec') {
      const fs = $(`fieldset[data-sec="${e.target.value}"]`, form);
      fs.hidden = fs.disabled = !e.target.checked;
      e.target.closest('tr').classList.toggle('on', e.target.checked);
    }
    if (e.target.name === 'kind') {
      const corr = form.kind.value === 'Correcção';
      form.effective_date.disabled = corr;
      form.effective_date.value = corr ? p.start_date : def;
    }
    clearPlan(); showErr('');
  });
  form.addEventListener('input', () => { if (plan) clearPlan(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    showErr('');
    const body = collect();
    if (!body.sections.length) return showErr('Selecione pelo menos uma alteração na lista.');
    if (!form.reportValidity()) return;
    try {
      const x = await api(`/api/policies/${p.id}/alteration/preview`, { method: 'POST', body });
      plan = body;
      const diff = x.premiumAfter - x.premiumBefore;
      prev.innerHTML = `<div class="card mt alt-preview"><div class="card-h"><h3>${ic('check')} Resumo da ${esc(x.kind.toLowerCase())}</h3><span class="muted small">com efeitos a ${d10(x.start)}</span></div>
        <div class="card-b flush">${table([{ label: 'Campo', key: 'label' }, { label: 'Atual', render: (c) => `<span class="muted">${esc(c.from)}</span>` }, { label: 'Novo', render: (c) => `<b>${esc(c.to)}</b>` }],
          x.changes.concat(x.tariffVersion !== p.tariff_version ? [{ label: 'Versão de tarifa', from: p.tariff_version || '-', to: x.tariffVersion }] : []), { empty: 'Sem alterações de dados.' })}</div>
        <div class="card-b alt-premium">
          <div><small>Prémio anual atual</small><b>${eur(x.premiumBefore)}</b></div><div class="arrow">→</div>
          <div><small>Novo prémio anual</small><b class="${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${eur(x.premiumAfter)}</b></div>
          <div><small>${x.adjustment > 0 ? 'Acerto a cobrar' : x.adjustment < 0 ? 'Estorno a devolver' : 'Acerto'}</small><b>${eur(Math.abs(x.adjustment))}</b></div>
          <div class="grow note">${ic('alert', 'sm')} Ao confirmar, são geradas as Condições Particulares e um pedido de <b>aceitação de termos e condições</b> ao cliente${x.adjustment > 0 ? ', e um recibo de acerto' : ''}.</div>
          <button type="button" class="btn primary" data-alt="confirm">${ic('check', 'sm')} Confirmar ${esc(x.kind.toLowerCase())}</button>
        </div></div>`;
      prev.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (ex) { if (!ex.handled) showErr(ex.message); }
  };
  prev.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-alt=confirm]');
    if (!b || !plan) return;
    b.disabled = true;
    try {
      const x = await api(`/api/policies/${p.id}/alteration`, { method: 'POST', body: plan });
      clientPoliciesCache = null;
      toast(`Apólice ${p.number} ${plan.kind === 'Correcção' ? 'corrigida' : 'alterada'} · prémio ${eur(x.premiumAfter)} · aceitação de termos pendente`);
      location.hash = back;
    } catch (ex) { b.disabled = false; if (!ex.handled) showErr(ex.message); }
  });
};

// ---- Sinistros ----
const CLAIM_TYPES = ['Colisão', 'Quebra Isolada de Vidros', 'Furto', 'Assistência em Viagem', 'Danos por Água', 'Fenómenos Naturais', 'Incêndio', 'Despesas Médicas', 'Acidente Pessoal', 'Outro'];
TABS.sinistros = async (el, d) => {
  const f = state.tf.cl ??= {};
  el.innerHTML = `<div class="toolbar"><div></div><button class="btn primary" data-act="claim-new">${ic('plus', 'sm')} Participar sinistro</button></div>` + filterForm('cl', [
    { name: 'branch', label: 'Ramo', type: 'select', options: state.meta.branches, placeholder: 'Todos os ramos' }, { name: 'policy', label: 'N.º Apólice' },
    { name: 'number', label: 'N.º Sinistro' }, { name: 'status', label: 'Situação', type: 'select', options: ['Aberto', 'Em Análise', 'Encerrado'], placeholder: 'Todas' },
  ], f) + '<div id="list"></div>';
  let rows = [];
  const load = async () => {
    rows = (await api(`/api/clients/${d.client.id}/claims` + qs(state.tf.cl))).claims;
    $('#list', el).innerHTML = `<div class="card">${table([
      { label: 'N.º Sinistro', render: (k) => `<b>${esc(k.number)}</b><span class="sub">${esc(k.branch)}</span>` }, { label: 'N.º Apólice', key: 'policy_number' },
      { label: 'Matrícula', key: 'plate' }, { label: 'Data Sinistro', render: (k) => d10(k.date) }, { label: 'Situação', render: (k) => badge(k.status) },
      { label: 'Tipo Sinistro', key: 'type' }, { label: 'Responsabilidade', render: (k) => (k.responsibility === 'Por apurar' ? badge(k.responsibility) : esc(k.responsibility)) },
      { label: '', cls: 'act', render: (k) => btnIcon('claim-edit', 'edit', 'Atualizar', { id: k.id }) },
    ], rows)}</div>`;
  };
  acts.cl = (v) => { state.tf.cl = v; return load(); };
  acts['claim-new'] = async () => {
    const pols = await clientPolicies(d.client.id, true);
    if (!pols.length) return toast('O cliente não tem apólices em vigor', 'error');
    openModal({
      title: 'Participar sinistro', submitLabel: 'Registar participação', wide: true,
      fields: [{ name: 'policy_id', label: 'Apólice', type: 'select', required: true, options: pols.map(policyOpt), full: true },
        { name: 'date', label: 'Data do sinistro', type: 'date', required: true, attrs: `max="${todayStr()}"` },
        { name: 'type', label: 'Tipo de sinistro', type: 'select', required: true, options: CLAIM_TYPES },
        { name: 'description', label: 'Descrição da ocorrência', type: 'textarea', full: true }],
      onSubmit: async (v) => { const r = await api(`/api/clients/${d.client.id}/claims`, { method: 'POST', body: v }); toast(`Sinistro ${r.number} registado · processo criado`); refresh(); },
    });
  };
  acts['claim-edit'] = ({ id }) => {
    const k = rows.find((x) => x.id == id);
    openModal({
      title: `Sinistro ${k.number}`, values: k,
      fields: [{ name: 'status', label: 'Situação', type: 'select', placeholder: false, options: ['Aberto', 'Em Análise', 'Encerrado'] },
        { name: 'responsibility', label: 'Responsabilidade', type: 'select', placeholder: false, options: ['Por apurar', 'Sem responsabilidade', 'Responsabilidade parcial', 'Responsabilidade total'] },
        { name: 'description', label: 'Descrição / notas', type: 'textarea', full: true }],
      onSubmit: async (v) => { await api(`/api/claims/${id}`, { method: 'PUT', body: v }); toast('Sinistro atualizado'); refresh(); },
    });
  };
  await load();
};

// ---- Documentos ----
TABS.documentos = async (el, d) => {
  const f = state.tf.doc ??= {};
  const pols = await clientPolicies(d.client.id);
  const first = await api(`/api/clients/${d.client.id}/documents` + qs(f));
  el.innerHTML = filterForm('doc', [
    { name: 'branch', label: 'Ramo', type: 'select', options: state.meta.branches, placeholder: 'Todos' }, { name: 'policy', label: 'N.º Apólice' },
    { name: 'type', label: 'Tipo de documento', type: 'select', options: first.types }, { name: 'channel', label: 'Canal de envio', type: 'select', options: ['Email', 'Correio', 'SMS'] },
    { name: 'from', label: 'Data de criação (de)', type: 'date' }, { name: 'to', label: 'a', type: 'date' }, { name: 'retained', label: 'Só retidos', type: 'checkbox' },
  ], f) + `
    <div class="grid g2" style="margin-bottom:14px">
      <div class="filters" style="margin:0"><div class="toolbar" style="margin:0"><b>${ic('send', 'sm')} Enviar documentos selecionados</b>
        <div class="group"><select class="input" id="sendCh"><option value="">Canal…</option><option>Email</option><option>Correio</option><option>SMS</option></select><button class="btn primary sm" data-act="doc-send">Enviar</button></div></div></div>
      <div class="filters" style="margin:0"><div class="toolbar" style="margin:0"><b>${ic('file', 'sm')} Gerar documento</b>
        <div class="group"><select class="input" id="genType"><option value="">Tipo…</option>${first.types.map((t) => `<option>${esc(t)}</option>`).join('')}</select>
          <select class="input" id="genPol"><option value="">Sem apólice</option>${pols.map(policyOpt).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          <button class="btn primary sm" data-act="doc-gen">Gerar</button></div></div></div>
    </div><div id="list"></div>`;
  const draw = (r) => {
    $('#list', el).innerHTML = `<div class="muted right" style="margin-bottom:6px">${r.documents.length} documento(s)</div><div class="card">${table([
      { label: '', cls: 'act', render: (x) => `<input type="checkbox" class="docsel" value="${x.id}" aria-label="Selecionar">` },
      { label: 'Tipo Documento', render: (x) => `<a href="/doc/${x.id}" target="_blank" rel="noopener"><b>${esc(x.type)}</b></a><span class="sub">(${esc(x.context || '-')}) — ${esc(x.filename)}</span>` },
      { label: 'N.º Apólice', key: 'policy_number' }, { label: 'Matrícula', key: 'plate' }, { label: 'Data Criação', render: (x) => dt(x.created_at) },
      { label: 'Última Impressão', render: (x) => dt(x.last_print) }, { label: 'Canal', key: 'channel' },
      { label: 'Retido', render: (x) => `<button class="btn sm ${x.retained ? 'danger' : ''}" data-act="doc-retain" data-id="${x.id}" data-r="${x.retained ? 0 : 1}">${x.retained ? 'Retido' : 'Não'}</button>` },
      { label: '', cls: 'act', render: (x) => `<a class="btn ghost icon" href="/doc/${x.id}" target="_blank" rel="noopener" title="Ver / imprimir">${ic('eye', 'sm')}</a>` },
    ], r.documents)}</div>`;
  };
  const load = async () => draw(await api(`/api/clients/${d.client.id}/documents` + qs(state.tf.doc)));
  acts.doc = (v) => { state.tf.doc = v; return load(); };
  acts['doc-retain'] = async ({ id, r }) => { await api(`/api/documents/${id}`, { method: 'PUT', body: { retained: r === '1' } }); toast(r === '1' ? 'Documento retido' : 'Documento libertado'); load(); };
  acts['doc-send'] = async () => {
    const ids = $$('.docsel:checked', el).map((x) => Number(x.value));
    const channel = $('#sendCh', el).value;
    if (!ids.length) return toast('Selecione pelo menos um documento', 'error');
    if (!channel) return toast('Escolha o canal de envio', 'error');
    const r = await api(`/api/clients/${d.client.id}/documents/send`, { method: 'POST', body: { ids, channel } });
    toast(`${ids.length} documento(s) enviados para ${r.recipient}`); refresh();
  };
  acts['doc-gen'] = async () => {
    const type = $('#genType', el).value;
    if (!type) return toast('Escolha o tipo de documento', 'error');
    const r = await api(`/api/clients/${d.client.id}/documents`, { method: 'POST', body: { type, policy_id: $('#genPol', el).value || null } });
    toast(`${type} gerado`); window.open(`/doc/${r.id}`, '_blank', 'noopener'); refresh();
  };
  draw(first);
};

// ---- Processos ----
let processTypesCache = null;
const processTypes = async () => (processTypesCache ??= (await api('/api/process-types')).types);
function processEditModal(pr, after) {
  openModal({
    title: `Processo ${pr.number}`, values: pr,
    body: `<p class="muted" style="margin-top:0">${esc(pr.process_type)} · ${esc(pr.task)} · ${esc(pr.task_number)}</p>`,
    fields: [{ name: 'status', label: 'Estado', type: 'select', placeholder: false, options: ['Aberto', 'Em Curso', 'Concluído'] },
      { name: 'priority', label: 'Prioridade', type: 'select', placeholder: false, options: ['Baixa', 'Normal', 'Alta'] },
      { name: 'assigned_to', label: 'Atribuído a', type: 'select', options: state.meta.users.map((u) => [u.id, `${u.name} (${u.username})`]), placeholder: 'Por atribuir' },
      { name: 'expires_at', label: 'Expira em', type: 'date', value: d10(pr.expires_at) }, { name: 'notes', label: 'Notas', type: 'textarea', full: true }],
    onSubmit: async (v) => { await api(`/api/processes/${pr.id}`, { method: 'PUT', body: v }); toast('Processo atualizado'); after(); },
  });
}
TABS.processos = async (el, d) => {
  const f = state.tf.pr ??= {};
  const types = await processTypes();
  el.innerHTML = `<div class="toolbar"><div></div><button class="btn primary" data-act="pr-new">${ic('plus', 'sm')} Novo processo</button></div>` + filterForm('pr', [
    { name: 'branch', label: 'Ramo', type: 'select', options: state.meta.branches, placeholder: 'Todos' }, { name: 'plate', label: 'Matrícula' }, { name: 'policy', label: 'N.º Apólice' },
    { name: 'process_type', label: 'Processo', type: 'select', options: Object.keys(types) }, { name: 'number', label: 'N.º Processo' },
    { name: 'status', label: 'Situação', type: 'select', options: ['Aberto', 'Em Curso', 'Concluído'] }, { name: 'task_number', label: 'N.º Tarefa' },
  ], f) + '<div id="list"></div>';
  let rows = [];
  const load = async () => {
    rows = (await api(`/api/clients/${d.client.id}/processes` + qs(state.tf.pr))).processes;
    $('#list', el).innerHTML = `<div class="card">${table([
      { label: 'N.º Processo', render: (p) => `<b>${esc(p.number)}</b><span class="sub">${esc(p.process_type)}</span>` }, { label: 'N.º Apólice', key: 'policy_number' },
      { label: 'Tarefa', render: (p) => `${esc(p.task)}<span class="sub">${esc(p.task_number)}</span>` }, { label: 'Data Criação', render: (p) => dt(p.created_at) },
      { label: 'Expira Em', render: (p) => `<span class="${p.status !== 'Concluído' && p.expires_at && p.expires_at < todayStr() ? 'badge danger' : ''}">${d10(p.expires_at)}</span>` },
      { label: 'Prioridade', render: (p) => badge(p.priority) }, { label: 'Estado', render: (p) => badge(p.status) }, { label: 'Atribuído', render: (p) => dash(p.assigned_name) },
      { label: '', cls: 'act', render: (p) => (p.status !== 'Concluído' && p.assigned_to !== state.user.id ? `<button class="btn sm" data-act="pr-take" data-id="${p.id}">Assumir</button> ` : '') + btnIcon('pr-edit', 'edit', 'Atualizar', { id: p.id }) },
    ], rows)}</div>`;
  };
  acts.pr = (v) => { state.tf.pr = v; return load(); };
  acts['pr-take'] = async ({ id }) => { await api(`/api/processes/${id}`, { method: 'PUT', body: { take: true, status: 'Em Curso' } }); toast('Processo atribuído a si'); load(); };
  acts['pr-edit'] = ({ id }) => processEditModal(rows.find((p) => p.id == id), refresh);
  acts['pr-new'] = async () => {
    const pols = await clientPolicies(d.client.id);
    openModal({
      title: 'Novo processo', wide: true, submitLabel: 'Criar processo',
      fields: [{ name: 'process_type', label: 'Processo', type: 'select', required: true, options: Object.keys(types) },
        { name: 'task', label: 'Tarefa', type: 'select', required: true, options: [] },
        { name: 'policy_id', label: 'Apólice', type: 'select', options: pols.map(policyOpt), placeholder: 'Sem apólice' },
        { name: 'priority', label: 'Prioridade', type: 'select', placeholder: false, options: ['Normal', 'Alta', 'Baixa'] },
        { name: 'expires_at', label: 'Expira em', type: 'date' }, { name: 'assign_me', label: 'Atribuir a mim', type: 'checkbox', value: true },
        { name: 'notes', label: 'Notas', type: 'textarea', full: true }],
      onMount: (form) => { form.elements.process_type.onchange = (e) => setOptions(form.elements.task, types[e.target.value] || []); },
      onSubmit: async (v) => { const r = await api(`/api/clients/${d.client.id}/processes`, { method: 'POST', body: v }); toast(`Processo ${r.number} criado`); refresh(); },
    });
  };
  await load();
};

// ---- Mensagens ----
TABS.mensagens = async (el, d) => {
  const f = state.tf.msg ??= {};
  el.innerHTML = `<div class="toolbar"><form data-form="msg" class="group"><select class="input" name="channel" id="msgCh">
      <option value="">Todos os canais</option>${['Email', 'SMS', 'Carta', 'Nota de chamada'].map((c) => `<option ${f.channel === c ? 'selected' : ''}>${c}</option>`).join('')}</select></form>
    <button class="btn primary" data-act="msg-new">${ic('send', 'sm')} Nova mensagem</button></div><div id="list"></div>`;
  $('#msgCh', el).onchange = (e) => e.target.form.requestSubmit();
  const icons = { Email: 'mail', SMS: 'phone', Carta: 'file', 'Nota de chamada': 'msg' };
  const load = async () => {
    const r = await api(`/api/clients/${d.client.id}/messages` + qs(state.tf.msg));
    $('#list', el).innerHTML = r.messages.length ? `<ul class="timeline">${r.messages.map((m) => `<li><div class="ic">${ic(icons[m.channel] || 'msg')}</div><div class="body">
      <div><b>${esc(m.subject || m.channel)}</b> <span class="badge">${esc(m.channel)}</span> <span class="badge ${m.direction === 'Recebida' ? 'info' : ''}">${esc(m.direction)}</span></div>
      <small>${dt(m.created_at)}${m.recipient ? ' · para ' + esc(m.recipient) : ''}${m.username ? ' · por ' + esc(m.username) : ''}</small><p>${esc(m.body)}</p></div></li>`).join('')}</ul>`
      : '<p class="muted" style="text-align:center;padding:30px">Sem mensagens para mostrar…</p>';
  };
  acts.msg = (v) => { state.tf.msg = v; return load(); };
  acts['msg-new'] = () => {
    const email = d.contacts.find((k) => k.type === 'Email')?.value || '';
    const mobile = d.contacts.find((k) => k.type === 'Telemóvel')?.value || '';
    const a = d.addresses[0];
    const post = a ? `${a.description}, ${a.postal_code || ''} ${a.city || ''}` : '';
    openModal({
      title: 'Nova mensagem', wide: true, submitLabel: 'Enviar / registar',
      body: '<div class="note" style="margin-bottom:14px">A mensagem fica registada no histórico do cliente. O envio real por email/SMS depende da integração com o gateway da empresa.</div>',
      fields: [{ name: 'channel', label: 'Canal', type: 'select', required: true, placeholder: false, options: ['Email', 'SMS', 'Carta', 'Nota de chamada'] },
        { name: 'recipient', label: 'Destinatário', value: email }, { name: 'subject', label: 'Assunto', full: true },
        { name: 'body', label: 'Mensagem', type: 'textarea', required: true, full: true, attrs: 'maxlength="5000"' }],
      onMount: (form) => {
        form.elements.channel.onchange = (e) => {
          const ch = e.target.value;
          form.elements.recipient.value = ch === 'Email' ? email : ch === 'SMS' ? mobile : ch === 'Carta' ? post : '';
          form.elements.recipient.disabled = ch === 'Nota de chamada';
        };
      },
      onSubmit: async (v) => { await api(`/api/clients/${d.client.id}/messages`, { method: 'POST', body: v }); toast('Mensagem registada'); refresh(); },
    });
  };
  await load();
};

// ---- Outros dados ----
TABS.outros = async (el, d) => {
  const c = d.client;
  el.innerHTML = `<div class="grid g2">
    <div class="card"><div class="card-h"><h3>${ic('user')} Dados de registo</h3></div><div class="card-b"><dl class="dl" style="grid-template-columns:1fr">
      <div><dt>Cliente registado</dt><dd>${yesNo(c.registered)}</dd></div><div><dt>Canal de registo</dt><dd>${dash(c.register_channel)}</dd></div>
      <div><dt>Email de registo</dt><dd>${dash(c.register_email)}</dd></div><div><dt>Email Área de Cliente</dt><dd>${dash(c.area_email)}</dd></div>
      <div><dt>Último login na Área de Clientes</dt><dd>${dt(c.last_login_area)}</dd></div><div><dt>Último login na APP</dt><dd>${dt(c.last_login_app)}</dd></div></dl>
      <button class="btn primary mt" data-act="recover" ${c.registered ? '' : 'disabled'}>${ic('key', 'sm')} Recuperar password</button></div></div>
    <div class="card"><div class="card-h"><h3>${ic('mail')} Envio de documentos em formato digital</h3></div><div class="card-b">
      <dl class="dl" style="grid-template-columns:1fr"><div><dt>${c.digital_docs_at ? 'Autorizado em' : 'Estado'}</dt><dd>${c.digital_docs_at ? dt(c.digital_docs_at) : '<span class="badge">Não autorizado</span>'}</dd></div></dl>
      <div class="btns mt">${c.digital_docs_at ? `<button class="btn danger" data-act="digital" data-v="0">Não autorizar</button>` : `<button class="btn primary" data-act="digital" data-v="1">Autorizar envio digital</button>`}</div>
      <form data-form="cisa" class="mt"><b>Pretende que a CISA seja enviada por correio?</b>
        <div class="btns" style="margin-top:10px"><label><input type="radio" name="by_mail" value="1" ${c.cisa_by_mail ? 'checked' : ''}> Sim</label>
        <label><input type="radio" name="by_mail" value="0" ${c.cisa_by_mail ? '' : 'checked'}> Não</label>
        <button class="btn sm" type="submit">Guardar</button></div>
        <div class="muted" style="font-size:12px;margin-top:6px">Atualizado em: ${dt(c.cisa_updated_at)}</div></form></div></div>
    <div class="card"><div class="card-h"><h3>${ic('pin')} Aceitação de termos — alteração de morada</h3></div><div class="card-b flush">${table([
      { label: 'Alteração', key: 'details' }, { label: 'Data', render: (o) => dt(o.created_at) }, { label: 'Utilizador', key: 'username' }],
      d.operations.filter((o) => o.action.startsWith('Morada')))}</div></div>
    <div class="card"><div class="card-h"><h3>${ic('link')} Protocolos e campanhas</h3><button class="btn sm" data-act="camp-add">${ic('plus', 'sm')} Associar</button></div><div class="card-b flush">${table([
      { label: 'Nome', key: 'name' }, { label: 'Campanha', render: (k) => (k.active ? `<span class="badge ok">${ic('check', 'sm')} Ativa</span>` : '<span class="badge">Terminada</span>') }, { label: 'Protocolo', key: 'protocol' }],
      d.campaigns)}</div></div></div>`;
  acts.recover = async () => {
    if (!(await confirmModal('Recuperar password', `Enviar ligação de recuperação de password para ${c.area_email}?`, { label: 'Enviar' }))) return;
    const r = await api(`/api/clients/${c.id}/recover-password`, { method: 'POST', body: {} }); toast(`Recuperação enviada para ${r.email}`); refresh();
  };
  acts.digital = async ({ v }) => { await api(`/api/clients/${c.id}/digital-docs`, { method: 'POST', body: { authorized: v === '1' } }); toast(v === '1' ? 'Envio digital autorizado' : 'Autorização revogada'); refresh(); };
  acts.cisa = async (v) => { await api(`/api/clients/${c.id}/cisa`, { method: 'POST', body: { by_mail: v.by_mail === '1' } }); toast('Preferência CISA guardada'); refresh(); };
  acts['camp-add'] = () => openModal({
    title: 'Associar campanha / protocolo',
    fields: [{ name: 'campaign_id', label: 'Campanha', type: 'select', required: true, options: state.meta.campaigns.map((k) => [k.id, `${k.name}${k.active ? '' : ' (terminada)'}`]) }, { name: 'protocol', label: 'Protocolo' }],
    onSubmit: async (v) => { await api(`/api/clients/${c.id}/campaigns`, { method: 'POST', body: v }); toast('Campanha associada'); refresh(); },
  });
};

// ---- Consentimentos (ficha) ----
TABS.consentimentos = async (el, d) => {
  el.innerHTML = `<p class="muted" style="margin-top:0">Registe a resposta do cliente a cada consentimento RGPD. Todas as alterações ficam auditadas.</p><div class="card">${table([
    { label: 'Consentimento', render: (t) => `<b>${esc(t)}</b>` },
    { label: 'Estado', render: (t) => badge(d.consents.find((k) => k.type === t)?.status || 'Pendente') },
    { label: 'Atualizado em', render: (t) => dt(d.consents.find((k) => k.type === t)?.updated_at) },
    { label: 'Por', render: (t) => dash(d.consents.find((k) => k.type === t)?.updated_by) },
    { label: '', cls: 'act', render: (t) => ['Aceite', 'Recusado', 'Pendente'].map((s) => `<button class="btn sm ${s === 'Recusado' ? 'danger' : ''}" data-act="consent" data-type="${esc(t)}" data-status="${s}">${s}</button>`).join(' ') },
  ], state.meta.consentTypes)}</div>`;
};

// =====================================================================
// OPERAÇÃO
// =====================================================================
VIEWS.fila = async (el) => {
  const types = await processTypes();
  const f = state.tf.queue ??= { scope: 'all', status: 'abertos' };
  el.innerHTML = pageHead('Fila de Trabalho', 'Processos e tarefas a tratar, ordenados por prioridade e prazo.') + `<div class="card"><div class="card-b">
    ${filterForm('queue', [
      { name: 'scope', label: 'Mostrar', type: 'select', placeholder: false, options: [['all', 'Todos'], ['mine', 'Atribuídos a mim'], ['unassigned', 'Por atribuir']] },
      { name: 'status', label: 'Estado', type: 'select', placeholder: false, options: [['abertos', 'Em aberto'], ['Aberto', 'Aberto'], ['Em Curso', 'Em Curso'], ['Concluído', 'Concluído']] },
      { name: 'process_type', label: 'Processo', type: 'select', options: Object.keys(types), placeholder: 'Todos' },
      { name: 'priority', label: 'Prioridade', type: 'select', options: ['Alta', 'Normal', 'Baixa'], placeholder: 'Todas' }], f)}<div id="list"></div></div></div>`;
  let rows = [];
  const load = async () => {
    rows = (await api('/api/queue' + qs(state.tf.queue))).processes;
    $('#list', el).innerHTML = `<div class="muted" style="margin-bottom:8px">${rows.length} processo(s)</div><div class="card">${table([
      { label: 'Processo', render: (p) => `<b>${esc(p.number)}</b><span class="sub">${esc(p.process_type)}</span>` },
      { label: 'Tarefa', render: (p) => `${esc(p.task)}<span class="sub">${esc(p.task_number)}</span>` },
      { label: 'Cliente', render: (p) => `<a href="#" data-act="open-client" data-id="${p.client_id}">${esc(p.client_name)}</a><span class="sub">NIF ${dash(p.nif)}</span>` },
      { label: 'Apólice', key: 'policy_number' }, { label: 'Criado', render: (p) => d10(p.created_at) },
      { label: 'Expira', render: (p) => `<span class="${p.status !== 'Concluído' && p.expires_at && p.expires_at < todayStr() ? 'badge danger' : ''}">${d10(p.expires_at)}</span>` },
      { label: 'Prioridade', render: (p) => badge(p.priority) }, { label: 'Estado', render: (p) => badge(p.status) }, { label: 'Atribuído', render: (p) => dash(p.assigned_name) },
      { label: '', cls: 'act', render: (p) => (p.status === 'Concluído' ? '' : (p.assigned_to !== state.user.id ? `<button class="btn sm" data-act="q-take" data-id="${p.id}">Assumir</button> ` : '')
        + `<button class="btn sm primary" data-act="q-done" data-id="${p.id}">Concluir</button>`) + btnIcon('q-edit', 'edit', 'Editar', { id: p.id }) },
    ], rows, { empty: 'Fila vazia. Não há processos com estes filtros.' })}</div>`;
  };
  acts.queue = (v) => { state.tf.queue = v; return load(); };
  acts['q-take'] = async ({ id }) => { await api(`/api/processes/${id}`, { method: 'PUT', body: { take: true, status: 'Em Curso' } }); toast('Processo atribuído a si'); load(); };
  acts['q-done'] = async ({ id }) => { await api(`/api/processes/${id}`, { method: 'PUT', body: { status: 'Concluído' } }); toast('Processo concluído'); load(); };
  acts['q-edit'] = ({ id }) => processEditModal(rows.find((p) => p.id == id), load);
  await load();
};

function bars(rows, labelKey, valueKey, fmt = (v) => v) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return `<div class="bars">${rows.map((r) => `<div class="bar-row"><span>${esc(r[labelKey])}</span><div class="bar-track"><div class="bar-fill" style="width:${(r[valueKey] / max) * 100}%"></div></div><span class="num">${fmt(r[valueKey])}</span></div>`).join('') || '<p class="muted">Sem dados.</p>'}</div>`;
}
VIEWS.indicadores = async (el) => {
  const r = await api('/api/indicators');
  const max = Math.max(1, ...r.daily.map((x) => x.simulations + x.operations));
  const totalPrem = r.byBranch.reduce((s, x) => s + x.premium, 0);
  el.innerHTML = pageHead('Indicadores', 'Visão geral da carteira e da atividade da equipa.') + `
    <div class="grid g4">${kpi('shield', r.byBranch.reduce((s, x) => s + x.n, 0), 'Apólices em vigor', 'ok')}${kpi('euro', eur(totalPrem), 'Prémio anual em carteira')}
      ${kpi('calc', r.simulationsTotal, 'Simulações (total)')}${kpi('check', r.conversion + '%', 'Taxa de conversão de simulações', 'ok')}</div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-h"><h3>Atividade — últimos 14 dias</h3><div class="legend"><span><i style="background:var(--brand)"></i>Operações</span><span><i style="background:#9aa5ff"></i>Simulações</span></div></div>
        <div class="card-b"><div class="colchart">${r.daily.map((x) => `<div class="col" title="${x.day}: ${x.operations} operações, ${x.simulations} simulações">
          <div class="stack2"><div class="s1" style="height:${(x.operations / max) * 150}px"></div><div class="s2" style="height:${(x.simulations / max) * 150}px"></div></div><small>${x.day.slice(8)}</small></div>`).join('')}</div></div></div>
      <div class="card"><div class="card-h"><h3>Apólices em vigor por ramo</h3></div><div class="card-b">${bars(r.byBranch, 'branch', 'n')}
        <div class="section-title mt">Prémio por ramo</div>${bars(r.byBranch, 'branch', 'premium', eur)}</div></div>
      <div class="card"><div class="card-h"><h3>Sinistros por situação</h3></div><div class="card-b">${bars(r.claimsByStatus, 'status', 'n')}</div></div>
      <div class="card"><div class="card-h"><h3>Processos em aberto por tipo</h3></div><div class="card-b">${bars(r.processesByType, 'process_type', 'n')}</div></div>
      <div class="card"><div class="card-h"><h3>Recibos</h3></div><div class="card-b flush">${table([{ label: 'Estado', render: (x) => badge(x.status) }, { label: 'Quantidade', key: 'n', cls: 'num' }, { label: 'Total', cls: 'num', render: (x) => eur(x.total) }], r.payments)}</div></div>
      <div class="card"><div class="card-h"><h3>Operações por utilizador (30 dias)</h3></div><div class="card-b">${bars(r.topAgents, 'username', 'n')}</div></div>
      <div class="card"><div class="card-h"><h3>Assuntos das chamadas (30 dias)</h3></div><div class="card-b">${r.callSubjects.length ? bars(r.callSubjects, 'subject', 'n') : '<p class="empty">Ainda não há fichas fechadas com assunto registado.</p>'}</div></div>
    </div>`;
};

VIEWS.vistorias = async (el) => {
  const f = state.tf.insp ??= {};
  el.innerHTML = pageHead('Vistorias', 'Agendamento e acompanhamento de vistorias automóvel.', `<button class="btn primary" data-act="insp-new">${ic('plus')} Nova vistoria</button>`) +
    `<div class="card"><div class="card-b">${filterForm('insp', [{ name: 'status', label: 'Estado', type: 'select', options: ['Por agendar', 'Agendada', 'Realizada', 'Cancelada'], placeholder: 'Todos' }, { name: 'plate', label: 'Matrícula' }], f)}<div id="list"></div></div></div>`;
  let rows = [];
  const load = async () => {
    rows = (await api('/api/inspections' + qs(state.tf.insp))).inspections;
    $('#list', el).innerHTML = `<div class="card">${table([
      { label: 'Cliente', render: (i) => `<a href="#" data-act="open-client" data-id="${i.client_id}">${esc(i.client_name)}</a>` },
      { label: 'Apólice', key: 'policy_number' }, { label: 'Matrícula', key: 'plate' }, { label: 'Data / hora', render: (i) => dash(i.scheduled_at) },
      { label: 'Local', key: 'location' }, { label: 'Estado', render: (i) => badge(i.status) }, { label: 'Resultado', key: 'result' },
      { label: '', cls: 'act', render: (i) => (['Realizada', 'Cancelada'].includes(i.status) ? '' : `<button class="btn sm" data-act="insp-sched" data-id="${i.id}">Agendar</button>
        <button class="btn sm primary" data-act="insp-done" data-id="${i.id}">Realizada</button><button class="btn sm danger" data-act="insp-cancel" data-id="${i.id}">Cancelar</button>`) },
    ], rows)}</div>`;
  };
  acts.insp = (v) => { state.tf.insp = v; return load(); };
  acts['insp-new'] = () => openModal({
    title: 'Nova vistoria', submitLabel: 'Criar vistoria',
    fields: [{ name: 'lookup', label: 'Pesquisar apólice (n.º, matrícula ou NIF)', full: true }, { name: 'policy_id', label: 'Apólice Automóvel', type: 'select', required: true, options: [], full: true },
      { name: 'scheduled_at', label: 'Data e hora', type: 'datetime-local' }, { name: 'location', label: 'Local' }, { name: 'notes', label: 'Notas', type: 'textarea', full: true }],
    onMount: (form) => {
      let t;
      form.elements.lookup.oninput = (e) => {
        clearTimeout(t);
        t = setTimeout(async () => {
          const r = await api('/api/policies-lookup' + qs({ q: e.target.value.trim() }));
          const auto = r.policies.filter((p) => p.branch === 'Automóvel');
          setOptions(form.elements.policy_id, auto.map((p) => [p.id, `${p.number} · ${p.plate || ''} · ${p.client_name}`]), auto.length ? 'Selecione' : 'Nenhuma apólice Automóvel encontrada');
          if (auto.length === 1) form.elements.policy_id.value = auto[0].id;
        }, 250);
      };
    },
    onSubmit: async (v) => { await api('/api/inspections', { method: 'POST', body: { ...v, scheduled_at: v.scheduled_at.replace('T', ' ') } }); toast('Vistoria criada'); load(); },
  });
  acts['insp-sched'] = ({ id }) => {
    const i = rows.find((x) => x.id == id);
    openModal({ title: 'Agendar vistoria', values: { ...i, scheduled_at: (i.scheduled_at || '').replace(' ', 'T') },
      fields: [{ name: 'scheduled_at', label: 'Data e hora', type: 'datetime-local', required: true }, { name: 'location', label: 'Local', required: true }],
      onSubmit: async (v) => { await api(`/api/inspections/${id}`, { method: 'PUT', body: { ...v, scheduled_at: v.scheduled_at.replace('T', ' '), status: 'Agendada' } }); toast('Vistoria agendada'); load(); } });
  };
  acts['insp-done'] = ({ id }) => openModal({ title: 'Registar vistoria realizada', submitLabel: 'Registar',
    fields: [{ name: 'result', label: 'Resultado', type: 'select', required: true, options: ['Sem danos', 'Danos pré-existentes registados', 'Recusada'] }, { name: 'notes', label: 'Notas', type: 'textarea', full: true }],
    onSubmit: async (v) => { await api(`/api/inspections/${id}`, { method: 'PUT', body: { ...v, status: 'Realizada' } }); toast('Vistoria registada'); load(); } });
  acts['insp-cancel'] = async ({ id }) => { if (await confirmModal('Cancelar vistoria', 'Quer cancelar esta vistoria?', { label: 'Cancelar vistoria', danger: true })) { await api(`/api/inspections/${id}`, { method: 'PUT', body: { status: 'Cancelada' } }); toast('Vistoria cancelada'); load(); } };
  await load();
};

VIEWS.pagamentos = async (el) => {
  const f = state.tf.pay ??= { status: 'Pendente' };
  el.innerHTML = pageHead('Consulta de Pagamentos', 'Recibos emitidos e respetivo estado de cobrança.') + `<div class="card"><div class="card-b">${filterForm('payfilter', [
    { name: 'reference', label: 'Referência' }, { name: 'policy', label: 'N.º Apólice' }, { name: 'nif', label: 'NIF' },
    { name: 'status', label: 'Estado', type: 'select', options: ['Pendente', 'Pago', 'Anulado', 'Estorno', 'Devolvido'], placeholder: 'Todos' },
    { name: 'from', label: 'Vencimento (de)', type: 'date' }, { name: 'to', label: 'a', type: 'date' }], f)}<div id="list"></div></div></div>`;
  const load = async () => {
    const rows = (await api('/api/payments' + qs(state.tf.pay))).payments;
    const total = rows.reduce((s, y) => s + y.amount, 0);
    $('#list', el).innerHTML = `<div class="muted" style="margin-bottom:8px">${rows.length} recibo(s) · total ${eur(total)}</div><div class="card">${table([
      { label: 'Referência', key: 'reference' }, { label: 'Cliente', render: (y) => `<a href="#" data-act="open-client" data-id="${y.client_id}">${esc(y.client_name)}</a><span class="sub">NIF ${dash(y.nif)}</span>` },
      { label: 'Apólice', key: 'policy_number' }, { label: 'Vencimento', render: (y) => `<span class="${y.status === 'Pendente' && y.due_date < todayStr() ? 'badge danger' : ''}">${d10(y.due_date)}</span>` },
      { label: 'Valor', cls: 'num', render: (y) => eur(y.amount) }, { label: 'Estado', render: (y) => badge(y.status) }, { label: 'Método', key: 'method' }, { label: 'Pago em', render: (y) => dt(y.paid_at) },
      { label: '', cls: 'act', render: (y) => (y.status === 'Pendente' ? `<button class="btn sm primary" data-act="pay" data-id="${y.id}">Registar pagamento</button>`
        : y.status === 'Estorno' ? `<button class="btn sm" data-act="refund" data-id="${y.id}">${ic('euro', 'sm')} Registar devolução</button>` : invoiceBtn(y)) },
    ], rows)}</div>`;
  };
  acts.pay = ({ id }) => payModal(id);
  acts.payfilter = (v) => { state.tf.pay = v; return load(); };
  acts.refund = ({ id }) => openModal({
    title: 'Registar devolução do estorno', submitLabel: 'Registar devolução',
    fields: [{ name: 'method', label: 'Forma de devolução', type: 'select', required: true, full: true, options: ['Transferência bancária', 'Cheque', 'Crédito no próximo recibo'] }],
    onSubmit: async (v) => { await api(`/api/payments/${id}/refund`, { method: 'POST', body: v }); toast('Devolução do estorno registada'); load(); },
  });
  await load();
};

VIEWS.consentimentos = async (el) => {
  const f = state.tf.cons ??= {};
  el.innerHTML = pageHead('Consulta e Gestão de Consentimentos', 'Estado dos consentimentos RGPD de toda a carteira.') + '<div class="grid g3" id="sum"></div>' +
    `<div class="card mt"><div class="card-b">${filterForm('cons', [{ name: 'type', label: 'Consentimento', type: 'select', options: state.meta.consentTypes, placeholder: 'Todos' },
      { name: 'status', label: 'Estado', type: 'select', options: ['Aceite', 'Recusado', 'Pendente'], placeholder: 'Todos' }, { name: 'nif', label: 'NIF' }], f)}<div id="list"></div></div></div>`;
  const load = async () => {
    const r = await api('/api/consents' + qs(state.tf.cons));
    $('#sum', el).innerHTML = state.meta.consentTypes.map((t) => {
      const g = (s) => r.summary.find((x) => x.type === t && x.status === s)?.n || 0;
      return `<div class="card card-b"><b>${esc(t)}</b><div class="btns mt">${badge('Aceite')} ${g('Aceite')} ${badge('Recusado')} ${g('Recusado')} ${badge('Pendente')} ${g('Pendente')}</div></div>`;
    }).join('');
    $('#list', el).innerHTML = `<div class="card">${table([
      { label: 'Cliente', render: (k) => `<a href="#" data-act="open-client" data-id="${k.client_id}">${esc(k.client_name)}</a>` }, { label: 'NIF', key: 'nif' },
      { label: 'Consentimento', key: 'type' }, { label: 'Estado', render: (k) => badge(k.status) }, { label: 'Atualizado', render: (k) => dt(k.updated_at) }, { label: 'Por', key: 'updated_by' },
    ], r.consents)}</div>`;
  };
  acts.cons = (v) => { state.tf.cons = v; return load(); };
  await load();
};

// =====================================================================
// GESTÃO
// =====================================================================
VIEWS.monitorizacao = async (el) => {
  if (state.user.role === 'agente') { el.innerHTML = '<div class="card card-b">Sem permissão.</div>'; return; }
  const f = state.tf.mon ??= {};
  el.innerHTML = pageHead('Monitorização', 'Estado da equipa e registo de auditoria de todas as operações.', `<button class="btn" data-act="mon-refresh">${ic('refresh', 'sm')} Atualizar</button>`) +
    '<div class="card"><div class="card-h"><h3>Equipa</h3></div><div class="card-b flush" id="agents"></div></div>' +
    `<div class="card mt"><div class="card-h"><h3>Registo de auditoria</h3></div><div class="card-b">${filterForm('mon', [{ name: 'user', label: 'Utilizador', type: 'select', options: state.meta.users.map((u) => u.username), placeholder: 'Todos' },
      { name: 'action', label: 'Ação contém' }, { name: 'from', label: 'De', type: 'date' }, { name: 'to', label: 'Até', type: 'date' }], f)}<div id="audit"></div></div></div>`;
  const load = async () => {
    const r = await api('/api/monitor' + qs(state.tf.mon));
    $('#agents', el).innerHTML = table([
      { label: '', cls: 'act', render: (a) => `<span class="dot ${a.online ? esc(a.agent_status) : ''}"></span>` },
      { label: 'Nome', render: (a) => `<b>${esc(a.name)}</b><span class="sub">${esc(a.username)}</span>` }, { label: 'Perfil', render: (a) => esc(ROLE_LABEL[a.role]) },
      { label: 'Equipas', render: (a) => `<div class="team-chips">${teamChips(a.team, '-')}</div>` }, { label: 'Estado', render: (a) => (a.online ? esc(a.agent_status) : '<span class="muted">Offline</span>') },
      { label: 'Operações hoje', key: 'ops_today', cls: 'num' }, { label: 'Último login', render: (a) => dt(a.last_login) }, { label: 'Última atividade', render: (a) => dt(a.last_seen) },
    ], r.agents);
    $('#audit', el).innerHTML = `<div class="card">${table([
      { label: 'Data', render: (a) => `<span class="nowrap">${esc(a.created_at)}</span>` }, { label: 'Utilizador', key: 'username' }, { label: 'Ação', render: (a) => `<b>${esc(a.action)}</b>` },
      { label: 'Cliente', render: (a) => (a.client_id ? `<a href="#" data-act="open-client" data-id="${a.client_id}">${esc(a.client_name || a.client_id)}</a>` : '-') }, { label: 'Detalhes', key: 'details' },
    ], r.audit)}</div>`;
  };
  acts.mon = (v) => { state.tf.mon = v; return load(); };
  acts['mon-refresh'] = load;
  await load();
};

VIEWS.admin = async (el) => {
  if (lvl() < 3) { el.innerHTML = '<div class="card card-b">Apenas Administradores e Direção podem gerir utilizadores.</div>'; return; }
  const top = isTopUser();
  el.innerHTML = pageHead('Utilizadores', canGrantTop() ? 'Pode alterar tudo em qualquer utilizador e é quem decide quem tem "Acesso total".'
      : top ? 'Tem acesso total: pode alterar tudo em qualquer utilizador. Dar ou tirar "Acesso total" é reservado a quem tem essa permissão.' : 'Crie e gira as contas dos funcionários. Só pode gerir perfis inferiores ao seu.',
    `<button class="btn" data-act="lookups">${ic('edit')} Equipas e cargos</button><button class="btn primary" data-act="user-new">${ic('userplus')} Criar conta</button>`, '<a href="#/">Início</a> › Gestão › Utilizadores')
    + '<div class="grid g4" id="ukpi"></div><div class="card mt" id="ulist"></div>';
  let rows = [];
  const load = async () => {
    rows = (await api('/api/users')).users;
    const active = rows.filter((u) => u.active);
    $('#ukpi', el).innerHTML = kpi('users', active.length, 'Contas ativas', 'ok') + kpi('shield', active.filter((u) => lvl(u) >= 4).length, 'Direção')
      + kpi('key', active.filter((u) => u.role === 'admin').length, 'Administradores') + kpi('alert', rows.filter((u) => u.must_change_password).length, 'A aguardar 1.º login', 'warn');
    $('#ulist', el).innerHTML = table([
      { label: 'Nome', render: (u) => `<div style="display:flex;gap:10px;align-items:center"><div class="avatar">${esc(initials(u.name))}</div><div><b>${esc(u.name)}</b>${u.id === state.user.id ? ' <span class="badge brand">Você</span>' : ''}${u.job_title ? `<span class="sub" style="color:var(--ink-2)">${esc(u.job_title)}</span>` : ''}${u.email ? `<span class="sub">${esc(u.email)}</span>` : ''}</div></div>` },
      { label: 'Utilizador', render: (u) => `<code>${esc(u.username)}</code>` },
      { label: 'Perfil / equipa', render: (u) => `<span class="badge ${ROLE_BADGE[u.role] ?? ''}">${esc(ROLE_LABEL[u.role] || u.role)}</span>${u.can_grant_top ? ` <span class="badge brand" title="Pode conceder o perfil Acesso total">${ic('key', 'sm')} Concede Acesso total</span>` : ''}<div class="team-chips">${teamChips(u.team)}</div>` },
      { label: 'Estado', render: (u) => badge(u.active ? 'Ativo' : 'Inativo') + (u.must_change_password ? ' <span class="badge warn">Password temporária</span>' : '')
        + (u.locked ? ' <span class="badge danger">Bloqueado</span>' : '')
        + `<span class="sub">${u.last_login ? 'Último login ' + dt(u.last_login) : 'Nunca entrou'}${u.sessions ? ` · ${u.sessions} sessão(ões) aberta(s)` : ''}</span>` },
      { label: '', cls: 'act', render: (u) => (!u.can_manage
        ? `<span class="no-perm" title="${u.id === state.user.id ? 'A sua conta — altere-a em O meu perfil' : 'Sem permissão: perfil igual ou superior ao seu'}" aria-label="Sem permissão">${ic('lock', 'sm')}</span>`
        : btnIcon('user-edit', 'edit', 'Editar', { id: u.id }) + btnIcon('user-reset', 'key', 'Password', { id: u.id })
          + (u.sessions ? btnIcon('user-sessions', 'logout', 'Terminar sessões', { id: u.id }) : '')
          + (u.locked ? btnIcon('user-unlock', 'shield', 'Desbloquear login', { id: u.id }) : '')
          + (u.id === state.user.id ? '' : btnIcon('user-toggle', 'power', u.active ? 'Desativar' : 'Ativar', { id: u.id }))
          + btnIcon('user-del', 'trash', 'Eliminar', { id: u.id })) },
    ], rows);
  };
  const find = (id) => rows.find((u) => u.id == id);
  const reloadMeta = async () => { state.meta = await api('/api/meta'); };
  acts['user-new'] = () => openModal({ title: 'Criar conta', wide: true, submitLabel: 'Criar conta', fields: userFieldsNew(), onMount: (form) => fillNextUsername(form), onSubmit: async (v) => { await createUser(v); load(); } });
  acts['user-edit'] = ({ id }) => {
    const u = find(id);
    const roles = assignableRoles();
    openModal({
      title: `Editar ${u.username}`, wide: true, values: u, submitLabel: 'Guardar alterações',
      body: top ? `<div class="note" style="margin:0 0 14px">${ic('alert', 'sm')} Acesso total: pode alterar todos os dados desta conta, incluindo o login e o perfil.</div>` : '',
      fields: [
        { name: 'username', label: 'Utilizador (login)', required: true },
        { name: 'name', label: 'Nome completo', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'role', label: 'Perfil', type: 'select', placeholder: false, options: (u.role === 'superadmin' && !canGrantTop() ? ['superadmin'] : withCurrent(roles, u.role)).map((r) => [r, ROLE_LABEL[r]]),
          hint: u.role === 'superadmin' && !canGrantTop() ? 'Só quem tem a permissão "Pode conceder Acesso total" pode tirar este perfil.' : '' },
        { name: 'team', label: 'Equipas', type: 'multi', options: [...state.meta.teams, ...splitTeams(u.team).filter((t) => !state.meta.teams.includes(t))], hint: 'Pode marcar várias equipas.' },
        { name: 'job_title', label: 'Cargo', type: 'select', options: withCurrent(state.meta.jobTitles, u.job_title), placeholder: '— Sem cargo —' },
        ...(top ? [{ name: 'agent_status', label: 'Estado do agente', type: 'select', placeholder: false, options: ['Disponível', 'Em chamada', 'Pausa', 'Indisponível'] }] : []),
        { name: 'active', label: 'Conta ativa', type: 'checkbox' },
        { name: 'must_change_password', label: 'Obrigar a trocar a password no próximo login', type: 'checkbox' },
        ...(canGrantTop() ? [{ name: 'can_grant_top', label: 'Pode conceder "Acesso total" a outras pessoas', type: 'checkbox' }] : []),
      ],
      onSubmit: async (v) => {
        const r = await api(`/api/users/${id}`, { method: 'PUT', body: v });
        toast(r.changed ? 'Utilizador atualizado' : 'Sem alterações');
        if (u.id === state.user.id) { state.user = (await api('/api/me')).user; renderShell('admin'); }
        await reloadMeta(); load();
      },
    });
  };
  acts['user-reset'] = ({ id }) => {
    const u = find(id);
    openModal({
      title: `Password de ${u.name}`, submitLabel: 'Aplicar',
      body: '<p style="margin-top:0">As sessões abertas desta conta são terminadas.</p>',
      fields: [{ name: 'password', label: 'Nova password', type: 'password', full: true, hint: 'Deixe vazio para gerar uma password temporária (mostrada uma única vez).', attrs: 'autocomplete="new-password"' },
        ...(top ? [{ name: 'must_change', label: 'Obrigar a trocar no próximo login', type: 'checkbox', value: true }] : [])],
      onSubmit: async (v) => {
        const r = await api(`/api/users/${id}/reset-password`, { method: 'POST', body: v });
        if (r.temporaryPassword) setTimeout(() => showSecret('Password reposta', `Nova password temporária para ${u.name}.`, u.username, r.temporaryPassword), 0);
        else toast(`Password definida${r.mustChange ? ' · troca obrigatória no próximo login' : ''}`);
        load();
      },
    });
  };
  acts['user-sessions'] = async ({ id }) => {
    const u = find(id);
    if (!(await confirmModal('Terminar sessões', `Terminar as ${u.sessions} sessão(ões) abertas de ${u.name}? Terá de voltar a entrar.`, { label: 'Terminar sessões' }))) return;
    await api(`/api/users/${id}/end-sessions`, { method: 'POST', body: {} }); toast('Sessões terminadas'); load();
  };
  acts['user-unlock'] = async ({ id }) => { await api(`/api/users/${id}/unlock`, { method: 'POST', body: {} }); toast('Login desbloqueado'); load(); };
  acts['user-toggle'] = async ({ id }) => {
    const u = find(id);
    if (u.active && !(await confirmModal('Desativar conta', `Desativar a conta de ${u.name}? A pessoa deixa de conseguir entrar.`, { label: 'Desativar', danger: true }))) return;
    await api(`/api/users/${id}`, { method: 'PUT', body: { active: !u.active } }); toast(u.active ? 'Conta desativada' : 'Conta ativada'); load();
  };
  acts['user-del'] = async ({ id }) => {
    const u = find(id);
    const self = u.id === state.user.id;
    if (!(await confirmModal('Eliminar conta', `Eliminar definitivamente a conta de ${u.name}${self ? ' (a sua própria conta — vai sair da aplicação)' : ''}? O histórico de auditoria mantém o nome de utilizador. Esta ação não pode ser desfeita — se quiser apenas bloquear o acesso, use "Desativar".`, { label: 'Eliminar', danger: true }))) return;
    await api(`/api/users/${id}`, { method: 'DELETE' }); toast('Conta eliminada');
    if (self) { state.user = null; renderLogin('A sua conta foi eliminada.'); return; }
    await reloadMeta(); load();
  };
  acts.lookups = () => {
    const box = (kind, title, list) => `<div class="lk" data-kind="${kind}"><div class="section-title" style="margin-top:0">${esc(title)}</div>
      <ul class="lk-list">${list.map((v) => `<li><span>${esc(v)}</span><button type="button" class="btn ghost icon sm" data-lk="del" title="Remover">${ic('x', 'sm')}</button></li>`).join('')}</ul>
      <div class="lk-add"><input placeholder="Nova opção…" maxlength="60"><button type="button" class="btn sm" data-lk="add">${ic('plus', 'sm')} Adicionar</button></div></div>`;
    openModal({
      title: 'Equipas e cargos', wide: true, submitLabel: 'Guardar listas',
      body: `<p class="muted" style="margin-top:0">Estas são as opções que aparecem para selecionar ao criar ou editar contas. Remover uma opção não altera as contas que já a têm.</p>
        <div class="lk-grid">${box('team', 'Equipas', state.meta.teams)}${box('job', 'Cargos', state.meta.jobTitles)}</div>`,
      onMount: (form) => {
        form.addEventListener('click', (e) => {
          const b = e.target.closest('[data-lk]');
          if (!b) return;
          const wrap = b.closest('.lk');
          if (b.dataset.lk === 'del') b.closest('li').remove();
          if (b.dataset.lk === 'add') {
            const inp = $('.lk-add input', wrap), v = inp.value.trim();
            if (!v) return;
            if ($$('.lk-list span', wrap).some((x) => x.textContent.toLowerCase() === v.toLowerCase())) { toast('Essa opção já existe', 'error'); return; }
            $('.lk-list', wrap).insertAdjacentHTML('beforeend', `<li><span>${esc(v)}</span><button type="button" class="btn ghost icon sm" data-lk="del" title="Remover">${ic('x', 'sm')}</button></li>`);
            inp.value = ''; inp.focus();
          }
        });
        form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.lk-add input')) { e.preventDefault(); e.target.nextElementSibling.click(); } });
      },
      onSubmit: async (_v, form) => {
        for (const kind of ['team', 'job']) {
          const values = $$(`.lk[data-kind="${kind}"] .lk-list span`, form).map((x) => x.textContent);
          await api(`/api/lookups/${kind}`, { method: 'PUT', body: { values } });
        }
        await reloadMeta(); toast('Listas de equipas e cargos guardadas');
      },
    });
  };
  await load();
};

VIEWS.perfil = async (el) => {
  const u = state.user;
  el.innerHTML = pageHead('O meu perfil') + `<div class="grid g2">
    <div class="card"><div class="card-h"><h3>${ic('user')} Dados da conta</h3></div><div class="card-b"><dl class="dl" style="grid-template-columns:1fr">
      <div><dt>Nome</dt><dd>${esc(u.name)}</dd></div><div><dt>Utilizador</dt><dd>${esc(u.username)}</dd></div><div><dt>Email</dt><dd>${dash(u.email)}</dd></div>
      <div><dt>Perfil</dt><dd>${esc(ROLE_LABEL[u.role])}</dd></div><div><dt>Cargo</dt><dd>${dash(u.job_title)}</dd></div><div><dt>Equipas</dt><dd><div class="team-chips">${teamChips(u.team, '-')}</div></dd></div><div><dt>Último login</dt><dd>${dt(u.last_login)}</dd></div></dl>
      <p class="muted">Para alterar nome, email ou perfil contacte um administrador.</p></div></div>
    <div class="card"><div class="card-h"><h3>${ic('key')} Alterar password</h3></div><div class="card-b"><form data-form="pw">${formGrid(passwordFields())}
      <div class="btns mt" style="justify-content:flex-end"><button class="btn primary" type="submit">Alterar password</button></div></form></div></div></div>`;
  acts.pw = async (v, form) => {
    if (!form.reportValidity()) return;
    await changePassword(v); form.reset(); toast('Password alterada com sucesso');
  };
};

// =====================================================================
// ARRANQUE
// =====================================================================
(async function start() {
  try {
    const me = await api('/api/me');
    state.user = me.user;
    if (me.user.must_change_password) renderForceChange(); else boot();
  } catch (e) {
    if (e.status === 401 || e.handled) { if (!state.user) renderLogin(); } else { renderLogin('Não foi possível contactar o servidor.'); }
  }
})();
