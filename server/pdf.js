// Praxis CRM — gerador de PDF mínimo (sem dependências): texto Helvetica, linhas e retângulos.
// Suporta acentos portugueses e o símbolo € (codificação WinAnsi / cp1252).

// Larguras das fontes base (AFM Adobe, por 1000 unidades) para os caracteres 32..126
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// caracteres fora do Latin-1 que existem em cp1252
const CP1252 = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‰': 0x89, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
const SPECIAL_W = { '€': 556, '•': 350, '–': 556, '—': 1000, '…': 1000, 'º': 365, 'ª': 370, '°': 400, '·': 278, '«': 556, '»': 556 };

function charCode(ch) {
  if (CP1252[ch]) return CP1252[ch];
  const c = ch.codePointAt(0);
  if (c >= 32 && c <= 126) return c;
  if (c >= 0xa0 && c <= 0xff) return c;
  if (ch === '→') return 0x3e; // '>'
  return 0x3f; // '?'
}
function charWidth(ch, bold) {
  const t = bold ? W_BOLD : W_REG;
  const c = ch.codePointAt(0);
  if (c >= 32 && c <= 126) return t[c - 32];
  if (SPECIAL_W[ch]) return SPECIAL_W[ch];
  const base = ch.normalize('NFD')[0]; // á → a
  const b = base.codePointAt(0);
  return b >= 32 && b <= 126 ? t[b - 32] : 556;
}
export function textWidth(str, size, bold = false) {
  let w = 0;
  for (const ch of String(str)) w += charWidth(ch, bold);
  return (w * size) / 1000;
}
function pdfString(str) {
  let out = '';
  for (const ch of String(str)) {
    const b = charCode(ch);
    const s = String.fromCharCode(b);
    out += s === '(' || s === ')' || s === '\\' ? '\\' + s : s;
  }
  return `(${out})`;
}
const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' '); };
const f = (n) => Number(n.toFixed(2));

export class PdfPage {
  constructor(width = 595.28, height = 841.89) { this.w = width; this.h = height; this.ops = []; }
  // coordenadas a partir do canto superior esquerdo (y cresce para baixo)
  text(x, y, str, { size = 10, bold = false, color = '#0f1430', align = 'left', spacing = 0 } = {}) {
    const s = String(str ?? '');
    const tw = textWidth(s, size, bold) + spacing * Math.max(0, [...s].length - 1);
    const tx = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
    this.ops.push(`q BT /${bold ? 'F2' : 'F1'} ${size} Tf ${spacing ? `${spacing} Tc ` : ''}${hex(color)} rg ${f(tx)} ${f(this.h - y)} Td ${pdfString(s)} Tj ET Q`);
    return tw;
  }
  // carimbo rodado (moldura dupla) centrado em (cx, cy)
  stamp(cx, cy, title, sub, { color = '#0f9d58', angle = 9, width = 132, height = 50 } = {}) {
    const a = (angle * Math.PI) / 180, cos = Math.cos(a).toFixed(4), sin = Math.sin(a).toFixed(4);
    const tw = textWidth(title, 21, true) + 3 * ([...title].length - 1), sw = textWidth(sub, 7.5, false);
    const w = width, h = height;
    this.ops.push(`q ${cos} ${sin} ${-sin} ${cos} ${f(cx)} ${f(this.h - cy)} cm ${hex(color)} RG ${hex(color)} rg
      1.6 w ${f(-w / 2)} ${f(-h / 2)} ${w} ${h} re S 0.6 w ${f(-w / 2 + 3.5)} ${f(-h / 2 + 3.5)} ${w - 7} ${h - 7} re S
      BT /F2 21 Tf 3 Tc ${f(-tw / 2)} -1 Td ${pdfString(title)} Tj ET BT /F1 7.5 Tf 0 Tc ${f(-sw / 2)} ${f(-h / 2 + 10)} Td ${pdfString(sub)} Tj ET Q`);
  }
  // texto com quebra de linha; devolve o y seguinte
  wrap(x, y, str, maxWidth, { size = 10, bold = false, color, lineHeight = 1.35 } = {}) {
    const words = String(str ?? '').split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && textWidth(test, size, bold) > maxWidth) { this.text(x, y, line, { size, bold, color }); y += size * lineHeight; line = w; } else line = test;
    }
    if (line) { this.text(x, y, line, { size, bold, color }); y += size * lineHeight; }
    return y;
  }
  rect(x, y, w, h, { fill, stroke, lineWidth = 0.6, radius = 0 } = {}) {
    const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
    const colors = `${fill ? hex(fill) + ' rg ' : ''}${stroke ? hex(stroke) + ' RG ' : ''}${lineWidth} w`;
    const X = x, Y = this.h - y - h;
    if (!radius) { this.ops.push(`q ${colors} ${f(X)} ${f(Y)} ${f(w)} ${f(h)} re ${op} Q`); return; }
    const r = Math.min(radius, w / 2, h / 2), k = 0.5523 * r;
    this.ops.push(`q ${colors} ${f(X + r)} ${f(Y)} m ${f(X + w - r)} ${f(Y)} l ${f(X + w - r + k)} ${f(Y)} ${f(X + w)} ${f(Y + r - k)} ${f(X + w)} ${f(Y + r)} c
      ${f(X + w)} ${f(Y + h - r)} l ${f(X + w)} ${f(Y + h - r + k)} ${f(X + w - r + k)} ${f(Y + h)} ${f(X + w - r)} ${f(Y + h)} c ${f(X + r)} ${f(Y + h)} l
      ${f(X + r - k)} ${f(Y + h)} ${f(X)} ${f(Y + h - r + k)} ${f(X)} ${f(Y + h - r)} c ${f(X)} ${f(Y + r)} l ${f(X)} ${f(Y + r - k)} ${f(X + r - k)} ${f(Y)} ${f(X + r)} ${f(Y)} c h ${op} Q`);
  }
  line(x1, y1, x2, y2, { color = '#e3e7f1', lineWidth = 0.6 } = {}) {
    this.ops.push(`q ${hex(color)} RG ${lineWidth} w ${f(x1)} ${f(this.h - y1)} m ${f(x2)} ${f(this.h - y2)} l S Q`);
  }
}

// Monta o ficheiro PDF (uma ou mais páginas) e devolve um Buffer
export function buildPdf(pages, { title = 'Documento', author = 'Praxis CRM' } = {}) {
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(null), pagesObj = add(null);
  const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const pg of pages) {
    const content = pg.ops.join('\n');
    const stream = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pg.w} ${pg.h}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const info = add(`<< /Title ${pdfString(title)} /Author ${pdfString(author)} /Producer (Praxis CRM) /CreationDate (D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}) >>`);

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
