/* Present 1.0.0 — tarayıcı tabanlı sunum uygulaması */
'use strict';

const APP_VERSION = '1.0.0';
const FILE_FORMAT = 'present';
const W = 960;
let H = 540; // slayt yüksekliği; açık sunumun en-boy oranına göre değişir (16:9 = 540, 4:3 = 720)

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/* Temalar ve düzenler                                                 */
/* ------------------------------------------------------------------ */

const THEMES = [
  { id: 'light', name: 'Aydınlık', bg: '#ffffff', text: '#1f2937', accent: '#4f46e5', font: 'Arial' },
  { id: 'night', name: 'Gece', bg: '#0f172a', text: '#f1f5f9', accent: '#38bdf8', font: 'Arial' },
  { id: 'sand', name: 'Kum', bg: '#fbf5e9', text: '#3b2f22', accent: '#d97706', font: 'Georgia' },
  { id: 'forest', name: 'Orman', bg: '#10372a', text: '#ecfdf5', accent: '#6ee7b7', font: 'Verdana' },
  { id: 'rose', name: 'Gül', bg: '#fff1f2', text: '#4c0519', accent: '#e11d48', font: 'Trebuchet MS' },
  { id: 'ocean', name: 'Okyanus', bg: '#0c4a6e', text: '#f0f9ff', accent: '#fbbf24', font: 'Arial' },
];
const FONTS = ['Arial', 'Calibri', 'Georgia', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Courier New', 'Tahoma'];
const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

function textEl(t, props) {
  return Object.assign({
    id: uid(), type: 'text', x: 100, y: 100, w: 400, h: 80, text: '',
    font: t.font, fontSize: 28, color: t.text, bold: false, italic: false, underline: false,
    align: 'left', valign: 'top', fill: null,
  }, props);
}
function shapeEl(type, t, props) {
  return Object.assign({
    id: uid(), type, x: 380, y: 170, w: 200, h: 200, fill: t.accent, stroke: null, strokeWidth: 0, radius: 0,
  }, props);
}

function makeSlide(layout, t) {
  const els = [];
  switch (layout) {
    case 'title':
      els.push(textEl(t, { x: 80, y: 130, w: 800, h: 140, text: 'Sunum başlığı', fontSize: 60, bold: true, align: 'center', valign: 'bottom' }));
      els.push(shapeEl('rect', t, { x: 420, y: 290, w: 120, h: 6 }));
      els.push(textEl(t, { x: 80, y: 315, w: 800, h: 70, text: 'Alt başlık', fontSize: 26, align: 'center' }));
      break;
    case 'content':
      els.push(textEl(t, { x: 60, y: 36, w: 840, h: 80, text: 'Slayt başlığı', fontSize: 40, bold: true, valign: 'middle' }));
      els.push(shapeEl('rect', t, { x: 70, y: 118, w: 80, h: 5 }));
      els.push(textEl(t, { x: 60, y: 145, w: 840, h: 355, text: '• Birinci madde\n• İkinci madde\n• Üçüncü madde', fontSize: 26 }));
      break;
    case 'section':
      els.push(shapeEl('rect', t, { x: 0, y: 0, w: 24, h: 540 }));
      els.push(textEl(t, { x: 90, y: 180, w: 780, h: 110, text: 'Bölüm başlığı', fontSize: 54, bold: true, valign: 'bottom' }));
      els.push(textEl(t, { x: 90, y: 295, w: 780, h: 60, text: 'Kısa açıklama', fontSize: 24 }));
      break;
    case 'two':
      els.push(textEl(t, { x: 60, y: 36, w: 840, h: 80, text: 'Slayt başlığı', fontSize: 40, bold: true, valign: 'middle' }));
      els.push(shapeEl('rect', t, { x: 70, y: 118, w: 80, h: 5 }));
      els.push(textEl(t, { x: 60, y: 150, w: 410, h: 350, text: '• Sol sütun\n• Madde', fontSize: 24 }));
      els.push(textEl(t, { x: 490, y: 150, w: 410, h: 350, text: '• Sağ sütun\n• Madde', fontSize: 24 }));
      break;
    default:
      break;
  }
  return { id: uid(), bg: t.bg, notes: '', elements: els };
}

function newDeck(title = 'Adsız sunum') {
  const t = THEMES[0];
  const now = Date.now();
  return { id: uid(), title, theme: t.id, created: now, updated: now, version: APP_VERSION, slides: [makeSlide('title', t)] };
}

/* ------------------------------------------------------------------ */
/* Depolama (IndexedDB, yoksa bellekte)                                */
/* ------------------------------------------------------------------ */

const Store = {
  db: null,
  mem: new Map(),
  async open() {
    if (!('indexedDB' in window)) return;
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('present-db', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('decks', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) {
      console.warn('IndexedDB kullanılamıyor, bellek kullanılacak', e);
      this.db = null;
    }
  },
  req(mode, fn) {
    return new Promise((res, rej) => {
      const r = fn(this.db.transaction('decks', mode).objectStore('decks'));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async all() { return this.db ? this.req('readonly', (s) => s.getAll()) : [...this.mem.values()].map(clone); },
  async get(id) { return this.db ? this.req('readonly', (s) => s.get(id)) : clone(this.mem.get(id) || null); },
  async put(d) { return this.db ? this.req('readwrite', (s) => s.put(d)) : this.mem.set(d.id, clone(d)); },
  async del(id) { return this.db ? this.req('readwrite', (s) => s.delete(id)) : this.mem.delete(id); },
};

/* ------------------------------------------------------------------ */
/* Durum                                                               */
/* ------------------------------------------------------------------ */

let deck = null;
let cur = 0;          // aktif slayt
let selId = null;     // seçili öğe
let editingId = null; // metni düzenlenen öğe
let newTextId = null; // araç çubuğundan yeni eklenen metin kutusu
let clipboard = null;
let history = [];
let histIdx = -1;
let saveTimer = null;
let stageScale = 1;

const curSlide = () => deck && deck.slides[cur];
const selEl = () => (curSlide() ? curSlide().elements.find((e) => e.id === selId) : null);

// Geri alma geçmişinde büyük görseller her anlık görüntüde kopyalanmaz; ortak havuzda bir kez tutulur
const imgPool = new Map(); // anahtar → data URL
const imgKeys = new Map(); // data URL → anahtar
const internImg = (k, v) => {
  if (typeof v !== 'string' || v.length < 2048 || !v.startsWith('data:')) return v;
  let key = imgKeys.get(v);
  if (!key) { key = `@img:${imgKeys.size}`; imgKeys.set(v, key); imgPool.set(key, v); }
  return key;
};
const reviveImg = (k, v) => (typeof v === 'string' && v.startsWith('@img:') && imgPool.has(v) ? imgPool.get(v) : v);

function pushHistory() {
  history = history.slice(0, histIdx + 1);
  history.push(JSON.stringify({ deck, cur }, internImg));
  if (history.length > 60) history.shift();
  histIdx = history.length - 1;
  updateUndoButtons();
}
function resetHistory() { history = []; histIdx = -1; imgPool.clear(); imgKeys.clear(); pushHistory(); }
function restore(idx) {
  const snap = JSON.parse(history[idx], reviveImg);
  deck = snap.deck;
  cur = clamp(snap.cur, 0, deck.slides.length - 1);
  histIdx = idx;
  selId = null;
  editingId = null;
  scheduleSave();
  renderAll();
}
function undo() { if (histIdx > 0) restore(histIdx - 1); }
function redo() { if (histIdx < history.length - 1) restore(histIdx + 1); }
function updateUndoButtons() {
  $('#btnUndo').disabled = histIdx <= 0;
  $('#btnRedo').disabled = histIdx >= history.length - 1;
}

/** Bir değişikliği kaydeder: geçmiş + otomatik kayıt + yeniden çizim */
function commit({ list = true, props = true } = {}) {
  pushHistory();
  scheduleSave();
  renderStage();
  if (list) renderSlideList();
  if (props) renderProps();
}

function scheduleSave() {
  if (!deck) return;
  $('#saveState').textContent = 'Kaydediliyor…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
async function saveNow() {
  clearTimeout(saveTimer);
  if (!deck) return;
  deck.updated = Date.now();
  deck.version = APP_VERSION;
  try {
    await Store.put(deck);
    $('#saveState').textContent = 'Kaydedildi';
  } catch (e) {
    console.error(e);
    $('#saveState').textContent = 'Kaydedilemedi!';
    toast('Kaydedilemedi: depolama alanı dolu olabilir.');
  }
}

/* ------------------------------------------------------------------ */
/* Slayt çizimi                                                        */
/* ------------------------------------------------------------------ */

const FONT_FALLBACK = {
  Calibri: 'Carlito', 'Calibri Light': 'Carlito', Cambria: 'Caladea', Arial: '"Liberation Sans", Helvetica',
  'Times New Roman': '"Liberation Serif", Times', 'Courier New': '"Liberation Mono", monospace', 'Segoe UI': 'system-ui',
};
const fontStack = (f) => `"${f || 'Arial'}", ${FONT_FALLBACK[f] ? `${FONT_FALLBACK[f]}, ` : ''}Arial, sans-serif`;
const gradCss = (g) => {
  const stops = g.stops.map(([p, c]) => `${c} ${Math.round(p * 100)}%`).join(', ');
  if (g.type === 'radial') return `radial-gradient(ellipse farthest-corner at ${g.cx ?? 50}% ${g.cy ?? 50}%, ${stops})`;
  return `linear-gradient(${((g.angle || 0) + 90) % 360}deg, ${stops})`;
};
const imgCss = (img) => `url("${img.src}") ${img.tile ? 'left top / auto repeat' : 'center / 100% 100% no-repeat'}`;
const slideBgCss = (s) => [s.bgImg ? imgCss(s.bgImg) : '', paintCss(s.bg, s.bgGrad)].filter(Boolean).join(', ');
const paintCss = (color, grad) => (grad && grad.stops && grad.stops.length ? gradCss(grad) : color || 'transparent');
const DEFAULT_INSET = [10, 6, 10, 6];

// Paragraf girintisi (px): PowerPoint marL/indent değerleri, yoksa varsayılan
function paraIndent(p) {
  const def = p.bullet ? { marL: ((p.lvl || 0) + 1) * 36, indent: -36 } : { marL: (p.lvl || 0) * 36, indent: 0 };
  return { marL: p.marL !== undefined ? p.marL : def.marL, indent: p.indent !== undefined ? p.indent : def.indent };
}

function applyTextStyle(node, t) {
  Object.assign(node.style, {
    fontFamily: fontStack(t.font),
    fontSize: `${t.fontSize}px`,
    color: t.color,
    fontWeight: t.bold ? '700' : '400',
    fontStyle: t.italic ? 'italic' : 'normal',
    textDecoration: t.underline ? 'underline' : 'none',
    textAlign: t.align || 'left',
  });
}

/** Metin içeriğini (düz veya zengin) .txt kutusuna çizer */
function renderTextContent(t, box) {
  box.innerHTML = '';
  if (!t.paras) { box.textContent = t.text || ''; return; }
  for (const p of t.paras) {
    const d = document.createElement('div');
    d.className = 'p';
    if (p.align) d.style.textAlign = p.align;
    if (p.lvl) d.dataset.lvl = p.lvl;
    if (p.bullet) { d.dataset.bu = p.bullet; d.dataset.buc = p.buChar || '•'; }
    const { marL, indent } = paraIndent(p);
    if (marL) d.style.paddingLeft = `${marL}px`;
    if (indent) { d.style.textIndent = `${indent}px`; d.style.setProperty('--bw', `${Math.max(0, -indent)}px`); }
    if (p.marL !== undefined) d.dataset.marl = p.marL;
    if (p.indent !== undefined) d.dataset.ind = p.indent;
    if (p.spaceBefore) { d.style.marginTop = `${p.spaceBefore}px`; d.dataset.sb = p.spaceBefore; }
    if (p.spaceAfter) { d.style.marginBottom = `${p.spaceAfter}px`; d.dataset.sa = p.spaceAfter; }
    if (p.lineHeight) { d.style.lineHeight = String(p.lineHeight); d.dataset.lh = p.lineHeight; }
    if (p.size) { d.style.fontSize = `${p.size}px`; d.dataset.size = p.size; }
    for (const r of p.runs) {
      const span = document.createElement('span');
      if (r.font) { span.style.fontFamily = fontStack(r.font); span.dataset.font = r.font; }
      if (r.size) span.style.fontSize = `${r.size}px`;
      if (r.color) span.style.color = r.color;
      if (r.bold !== undefined) span.style.fontWeight = r.bold ? '700' : '400';
      if (r.italic !== undefined) span.style.fontStyle = r.italic ? 'italic' : 'normal';
      const deco = [r.underline ? 'underline' : '', r.strike ? 'line-through' : ''].filter(Boolean).join(' ');
      if (deco || r.underline === false) span.style.textDecoration = deco || 'none';
      if (r.caps) span.style.textTransform = 'uppercase';
      r.text.split('\n').forEach((part, i) => {
        if (i > 0) { const br = document.createElement('br'); br.dataset.soft = '1'; span.appendChild(br); }
        if (part) span.appendChild(document.createTextNode(part));
      });
      d.appendChild(span);
    }
    // HTML'de sondaki tek <br> satır oluşturmaz; PowerPoint'teki gibi boş satır için bir tane daha ekle
    const ptext = p.runs.map((r) => r.text).join('');
    if (!ptext || ptext.endsWith('\n')) d.appendChild(document.createElement('br'));
    box.appendChild(d);
  }
}

let svgSeq = 0;
function shapeSvg(el) {
  const w = Math.max(el.w, 0.01);
  const h = Math.max(el.h, 0.01);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  // viewBox yok: yollar piksel koordinatında, sıfır yükseklikli çizgiler de görünür
  svg.setAttribute('width', Math.max(w, 1));
  svg.setAttribute('height', Math.max(h, 1));
  svg.setAttribute('class', 'shape-svg');
  const open = Shapes.isOpen(el.geom) || /Connector/.test(el.geom || '');
  let fill = open ? 'none' : el.fill || 'none';
  const defs = document.createElementNS(NS, 'defs');
  if (!open && el.grad && el.grad.stops && el.grad.stops.length) {
    const gid = `g${++svgSeq}`;
    const radial = el.grad.type === 'radial';
    const lg = document.createElementNS(NS, radial ? 'radialGradient' : 'linearGradient');
    lg.setAttribute('id', gid);
    if (radial) {
      lg.setAttribute('cx', `${el.grad.cx ?? 50}%`); lg.setAttribute('cy', `${el.grad.cy ?? 50}%`); lg.setAttribute('r', '71%');
    } else {
      const a = ((el.grad.angle || 0) * Math.PI) / 180;
      lg.setAttribute('x1', `${50 - Math.cos(a) * 50}%`); lg.setAttribute('y1', `${50 - Math.sin(a) * 50}%`);
      lg.setAttribute('x2', `${50 + Math.cos(a) * 50}%`); lg.setAttribute('y2', `${50 + Math.sin(a) * 50}%`);
    }
    for (const [pos, c] of el.grad.stops) {
      const st = document.createElementNS(NS, 'stop');
      st.setAttribute('offset', `${pos * 100}%`);
      st.setAttribute('stop-color', c);
      lg.appendChild(st);
    }
    defs.appendChild(lg);
    fill = `url(#${gid})`;
  }
  const marker = (type, start) => {
    if (!type || type === 'none') return null;
    const mid = `m${++svgSeq}`;
    const m = document.createElementNS(NS, 'marker');
    m.setAttribute('id', mid);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '5'); m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '4'); m.setAttribute('markerHeight', '4');
    m.setAttribute('orient', start ? 'auto-start-reverse' : 'auto');
    const mp = document.createElementNS(NS, type === 'oval' ? 'circle' : 'path');
    if (type === 'oval') { mp.setAttribute('cx', '5'); mp.setAttribute('cy', '5'); mp.setAttribute('r', '4'); }
    else if (type === 'diamond') mp.setAttribute('d', 'M5 0 L10 5 L5 10 L0 5 Z');
    else mp.setAttribute('d', 'M0 0 L10 5 L0 10 Z');
    mp.setAttribute('fill', el.stroke || '#000');
    m.appendChild(mp);
    defs.appendChild(m);
    return `url(#${mid})`;
  };
  const ds = el.geom === 'custGeom' && el.paths ? Shapes.custom(el.paths, w, h) : [Shapes.preset(el.geom, w, h, el.adj) || Shapes.preset('rect', w, h)];
  const sw = el.stroke && el.strokeWidth ? el.strokeWidth : 0;
  const dashes = { dash: [4, 3], sysDash: [3, 1], dot: [1, 1], sysDot: [1, 1], lgDash: [8, 3], dashDot: [4, 3, 1, 3], lgDashDot: [8, 3, 1, 3], sysDashDot: [3, 1, 1, 1] };
  const ms = marker(el.headEnd, true);
  const me = marker(el.tailEnd, false);
  ds.forEach((d, i) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    const pinfo = el.paths && el.paths[i];
    p.setAttribute('fill', pinfo && pinfo.fill === false ? 'none' : fill);
    if (Shapes.evenOdd(el.geom)) p.setAttribute('fill-rule', 'evenodd');
    if (sw && !(pinfo && pinfo.stroke === false)) {
      p.setAttribute('stroke', el.stroke);
      p.setAttribute('stroke-width', sw);
      p.setAttribute('stroke-linejoin', 'round');
      if (el.dash && dashes[el.dash]) p.setAttribute('stroke-dasharray', dashes[el.dash].map((v) => v * sw).join(' '));
      if (ms) p.setAttribute('marker-start', ms);
      if (me) p.setAttribute('marker-end', me);
    }
    svg.appendChild(p);
  });
  if (defs.childNodes.length) svg.insertBefore(defs, svg.firstChild);
  return svg;
}

function flipCss(el) {
  const sx = el.flipH ? -1 : 1;
  const sy = el.flipV ? -1 : 1;
  return sx === 1 && sy === 1 ? '' : `scale(${sx}, ${sy})`;
}

function tableNode(el) {
  const tbl = document.createElement('table');
  tbl.className = 'ptable';
  const colSum = el.cols.reduce((s, c) => s + c, 0) || 1;
  const rowSum = el.rows.reduce((s, r) => s + (r.h || 0), 0) || 1;
  const cg = document.createElement('colgroup');
  for (const c of el.cols) {
    const col = document.createElement('col');
    col.style.width = `${(c / colSum) * 100}%`;
    cg.appendChild(col);
  }
  tbl.appendChild(cg);
  el.rows.forEach((r, ri) => {
    const tr = document.createElement('tr');
    tr.style.height = `${((r.h || 0) / rowSum) * el.h}px`;
    r.cells.forEach((c, ci) => {
      if (c.hidden) return;
      const td = document.createElement('td');
      td.dataset.r = ri;
      td.dataset.c = ci;
      if (c.colspan > 1) td.colSpan = c.colspan;
      if (c.rowspan > 1) td.rowSpan = c.rowspan;
      const [l, t, rr, b] = c.inset || [10, 5, 10, 5];
      td.style.padding = `${t}px ${rr}px ${b}px ${l}px`;
      td.style.background = c.fill || 'transparent';
      td.style.verticalAlign = c.valign || 'top';
      if (el.border) td.style.border = `${el.borderWidth || 1}px solid ${el.border}`;
      applyTextStyle(td, c);
      const box = document.createElement('div');
      box.className = 'txt';
      renderTextContent(c, box);
      td.appendChild(box);
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  });
  return tbl;
}

function elNode(el) {
  const d = document.createElement('div');
  d.className = `el el-${el.type}`;
  d.dataset.id = el.id;
  applyBox(d, el);
  if (el.rot) d.style.transform = `rotate(${el.rot}deg)`;
  if (el.type === 'text') {
    d.classList.add(`va-${el.valign || 'top'}`);
    if (!el.text) d.classList.add('empty');
    applyTextStyle(d, el);
    d.style.background = paintCss(el.fill, el.grad);
    const [l, t, r, b] = el.inset || DEFAULT_INSET;
    d.style.padding = `${t}px ${r}px ${b}px ${l}px`;
    if (el.vert && el.vert !== 'horz') d.style.writingMode = 'vertical-rl';
    const box = document.createElement('div');
    box.className = 'txt';
    if (el.wrap === false) box.style.whiteSpace = 'pre';
    renderTextContent(el, box);
    d.appendChild(box);
  } else if (el.type === 'rect' || el.type === 'ellipse') {
    d.style.background = paintCss(el.fill, el.grad);
    if (el.stroke && el.strokeWidth) d.style.border = `${el.strokeWidth}px ${el.dash && el.dash !== 'solid' ? 'dashed' : 'solid'} ${el.stroke}`;
    if (el.type === 'rect' && el.radius) d.style.borderRadius = `${el.radius}px`;
  } else if (el.type === 'shape') {
    if (Shapes.isOpen(el.geom) || /Connector/.test(el.geom || '')) d.classList.add('el-line');
    if (el.imgFill) {
      // Resim/doku dolgusu: şekil yoluyla kırpılmış arka plan, kenarlık SVG ile üstte
      const bgDiv = document.createElement('div');
      bgDiv.className = 'shape-img';
      bgDiv.style.background = imgCss(el.imgFill);
      const dd = el.geom === 'custGeom' && el.paths ? Shapes.custom(el.paths, el.w, el.h).join(' ') : Shapes.preset(el.geom, el.w, el.h, el.adj) || Shapes.preset('rect', el.w, el.h);
      bgDiv.style.clipPath = `path('${dd}')`;
      const f = flipCss(el);
      if (f) bgDiv.style.transform = f;
      d.appendChild(bgDiv);
    }
    const svg = shapeSvg(el.imgFill ? { ...el, fill: null, grad: null } : el);
    const f = flipCss(el);
    if (f) svg.style.transform = f;
    d.appendChild(svg);
  } else if (el.type === 'image') {
    const img = document.createElement('img');
    img.src = el.src;
    img.alt = '';
    img.draggable = false;
    const f = flipCss(el);
    if (f) img.style.transform = f;
    if (el.round === 'ellipse') d.style.borderRadius = '50%';
    else if (el.radius) d.style.borderRadius = `${el.radius}px`;
    if (el.round || el.radius) d.style.overflow = 'hidden';
    if (el.stroke && el.strokeWidth) d.style.outline = `${el.strokeWidth}px solid ${el.stroke}`;
    d.appendChild(img);
  } else if (el.type === 'table') {
    d.appendChild(tableNode(el));
  }
  return d;
}
function applyBox(node, el) {
  node.style.left = `${el.x}px`;
  node.style.top = `${el.y}px`;
  node.style.width = `${el.w}px`;
  node.style.height = `${el.h}px`;
}

function slideNode(slide, h = H) {
  const s = document.createElement('div');
  s.className = 'slide';
  s.style.height = `${h}px`;
  s.style.background = slideBgCss(slide);
  slide.elements.forEach((el) => s.appendChild(elNode(el)));
  return s;
}

// Küçük resimler kapsayıcı genişliğine göre ölçeklenir
const thumbObserver = new ResizeObserver((entries) => {
  for (const en of entries) fitThumb(en.target);
});
function fitThumb(box) {
  const s = box.firstElementChild;
  if (s) s.style.transform = `scale(${(box.clientWidth || 160) / W})`;
}
function mountThumb(box, slide, h = H) {
  box.innerHTML = '';
  box.style.aspectRatio = `${W} / ${h}`;
  box.appendChild(slideNode(slide, h));
  fitThumb(box);
  thumbObserver.observe(box);
}

/* ------------------------------------------------------------------ */
/* Ana sayfa                                                           */
/* ------------------------------------------------------------------ */

async function renderHome() {
  const decks = (await Store.all()).sort((a, b) => b.updated - a.updated);
  const grid = $('#deckGrid');
  grid.innerHTML = '';
  $('#emptyHint').hidden = decks.length > 0;
  for (const d of decks) {
    const card = document.createElement('div');
    card.className = 'deck-card';
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="thumb"></div>
      <div class="info">
        <div class="name">${esc(d.title || 'Adsız sunum')}</div>
        <div class="meta">${d.slides.length} slayt · ${new Date(d.updated).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>
      <div class="card-actions">
        <button data-act="dup" title="Kopyasını oluştur">⧉</button>
        <button data-act="dl" title="İndir (.present)">⬇</button>
        <button data-act="del" title="Sil">🗑</button>
      </div>`;
    if (d.slides[0]) mountThumb($('.thumb', card), d.slides[0], d.h || 540);
    card.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return openDeck(d.id);
      e.stopPropagation();
      if (act === 'del') {
        if (confirm(`“${d.title}” silinsin mi? Bu işlem geri alınamaz.`)) {
          await Store.del(d.id);
          renderHome();
        }
      } else if (act === 'dup') {
        const copy = clone(d);
        copy.id = uid();
        copy.title = `${d.title} (kopya)`;
        copy.created = copy.updated = Date.now();
        await Store.put(copy);
        renderHome();
      } else if (act === 'dl') {
        exportFile(d, 'present');
      }
    });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDeck(d.id); });
    grid.appendChild(card);
  }
}

function showHome() {
  document.body.classList.remove('in-editor');
  $('#editorView').hidden = true;
  $('#homeView').hidden = false;
  deck = null;
  renderHome();
}

async function openDeck(id) {
  if (location.hash !== `#/d/${id}`) { location.hash = `#/d/${id}`; return; }
  const d = await Store.get(id);
  if (!d) { toast('Sunum bulunamadı.'); location.hash = ''; return; }
  deck = d;
  H = deck.h || 540;
  cur = 0;
  selId = null;
  editingId = null;
  document.body.classList.add('in-editor');
  $('#homeView').hidden = true;
  $('#editorView').hidden = false;
  $('#deckTitle').value = deck.title;
  $('#saveState').textContent = 'Kaydedildi';
  resetHistory();
  renderAll();
  fitStage();
}

async function createDeck() {
  const d = newDeck();
  await Store.put(d);
  openDeck(d.id);
}

async function route() {
  if (deck) await saveNow();
  if (location.hash === '#/new') {
    const d = newDeck();
    await Store.put(d);
    location.replace(`#/d/${d.id}`);
    return;
  }
  const m = location.hash.match(/^#\/d\/(.+)$/);
  if (m) openDeck(decodeURIComponent(m[1]));
  else showHome();
}

/* ------------------------------------------------------------------ */
/* Düzenleyici çizimi                                                  */
/* ------------------------------------------------------------------ */

function renderAll() {
  if (!deck) return;
  renderSlideList();
  renderStage();
  renderProps();
  updateUndoButtons();
}

function renderSlideList() {
  const list = $('#slideList');
  list.innerHTML = '';
  deck.slides.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = `slide-item${i === cur ? ' active' : ''}`;
    item.draggable = true;
    item.dataset.index = i;
    item.innerHTML = `
      <div class="num">${i + 1}</div>
      <div class="thumb"></div>
      <div class="s-actions">
        <button data-sact="up" title="Yukarı taşı">▲</button>
        <button data-sact="down" title="Aşağı taşı">▼</button>
        <button data-sact="dup" title="Çoğalt">⧉</button>
        <button data-sact="del" title="Sil">✕</button>
      </div>`;
    mountThumb($('.thumb', item), s);
    list.appendChild(item);
  });
  $('.slide-item.active', list)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function refreshActiveThumb() {
  const box = $(`.slide-item[data-index="${cur}"] .thumb`);
  if (box) mountThumb(box, curSlide());
}

function renderStage() {
  const stage = $('#stage');
  const slide = curSlide();
  stage.innerHTML = '';
  stage.style.height = `${H}px`;
  stage.style.background = slideBgCss(slide);
  for (const el of slide.elements) {
    const n = elNode(el);
    if (el.id === selId) {
      n.classList.add('selected');
      if (el.id !== editingId) {
        for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const hd = document.createElement('div');
          hd.className = 'handle';
          hd.dataset.h = h;
          n.appendChild(hd);
        }
      }
    }
    stage.appendChild(n);
  }
  $('#notes').value = slide.notes || '';
  $('#btnDupEl').disabled = !selId;
  $('#btnDelEl').disabled = !selId;
}

function fitStage() {
  const wrap = $('#stageWrap');
  if (!wrap || wrap.offsetParent === null) return;
  const pad = window.innerWidth < 900 ? 24 : 48;
  const sw = Math.max(50, wrap.clientWidth - pad);
  const sh = Math.max(50, wrap.clientHeight - pad);
  stageScale = Math.min(sw / W, sh / H);
  const scaler = $('#stageScaler');
  scaler.style.width = `${W * stageScale}px`;
  scaler.style.height = `${H * stageScale}px`;
  $('#stage').style.transform = `scale(${stageScale})`;
}

/* ------------------------------------------------------------------ */
/* Zengin metin yardımcıları                                           */
/* ------------------------------------------------------------------ */

const RUN_KEY = { fontSize: 'size', color: 'color', font: 'font', bold: 'bold', italic: 'italic', underline: 'underline' };
const PARA_KEYS = ['align', 'lvl', 'bullet', 'marL', 'indent', 'spaceBefore', 'spaceAfter', 'lineHeight', 'size'];

/** Biçimsiz paragraflar düz metne indirgenir */
function simplifyText(t) {
  if (!t.paras) return t;
  t.text = t.paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
  const plain = t.paras.every((p) => PARA_KEYS.every((k) => p[k] === undefined || p[k] === null)
    && p.runs.every((r) => Object.keys(r).every((k) => k === 'text') && !r.text.includes('\n')));
  if (plain) delete t.paras;
  return t;
}

function setTextProp(t, k, v) {
  t[k] = v;
  if (!t.paras) return;
  if (k === 'align') t.paras.forEach((p) => { delete p.align; });
  else if (RUN_KEY[k]) {
    t.paras.forEach((p) => {
      if (k === 'fontSize') delete p.size;
      p.runs.forEach((r) => { delete r[RUN_KEY[k]]; });
    });
  }
  simplifyText(t);
}

/** Metin hedefleri: metin kutusu veya tablonun tüm hücreleri */
function textTargets(el) {
  if (el.type === 'text') return [el];
  if (el.type === 'table') return el.rows.flatMap((r) => r.cells.filter((c) => !c.hidden));
  return [];
}
function applyTextProp(el, k, v) { textTargets(el).forEach((t) => setTextProp(t, k, v)); }

const toHex = (css) => {
  if (!css) return null;
  if (css.startsWith('#')) return css.length === 4 ? `#${[...css.slice(1)].map((c) => c + c).join('')}` : css;
  const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(css);
  if (!m) return null;
  const h = (n) => Math.round(+n).toString(16).padStart(2, '0');
  const a = m[4] !== undefined && +m[4] < 1 ? h(+m[4] * 255) : '';
  return `#${h(m[1])}${h(m[2])}${h(m[3])}${a}`;
};

/** Düzenlenebilir alanı paragraflara/parçalara çözümler */
function parseEditable(root, t) {
  const paras = [];
  let cur = null;
  const paraAttrs = (n) => {
    if (!n || !n.dataset) return {};
    const d = n.dataset;
    const o = {};
    if (n.style && n.style.textAlign) o.align = n.style.textAlign;
    if (d.lvl) o.lvl = +d.lvl;
    if (d.bu) { o.bullet = d.bu; if (d.bu === 'char') o.buChar = d.buc || '•'; }
    if (d.marl !== undefined) o.marL = +d.marl;
    if (d.ind !== undefined) o.indent = +d.ind;
    if (d.sb) o.spaceBefore = +d.sb;
    if (d.sa) o.spaceAfter = +d.sa;
    if (d.lh) o.lineHeight = +d.lh;
    if (d.size) o.size = +d.size;
    return o;
  };
  const newPara = (src) => { cur = { ...paraAttrs(src), runs: [] }; paras.push(cur); };
  const inlineFmt = (n) => {
    const f = {};
    const tag = n.tagName;
    if (tag === 'B' || tag === 'STRONG') f.bold = true;
    if (tag === 'I' || tag === 'EM') f.italic = true;
    if (tag === 'U') f.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') f.strike = true;
    if (tag === 'FONT') {
      if (n.getAttribute('color')) f.color = toHex(n.getAttribute('color'));
      if (n.getAttribute('face')) f.font = n.getAttribute('face');
    }
    const st = n.style;
    if (st) {
      if (st.fontWeight) f.bold = st.fontWeight === 'bold' || +st.fontWeight >= 600;
      if (st.fontStyle) f.italic = st.fontStyle === 'italic';
      const td = st.textDecorationLine || st.textDecoration;
      if (td) { f.underline = td.includes('underline'); if (td.includes('line-through')) f.strike = true; }
      if (st.color) f.color = toHex(st.color);
      if (st.fontSize && st.fontSize.endsWith('px')) f.size = parseFloat(st.fontSize);
      if (n.dataset && n.dataset.font) f.font = n.dataset.font;
      else if (st.fontFamily) f.font = st.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (st.textTransform === 'uppercase') f.caps = true;
    }
    return f;
  };
  const isBlock = (n) => /^(DIV|P|LI|H[1-6])$/.test(n.tagName);
  // Bloğun sonundaki <br> yalnızca yer tutucudur (arkasında metin veya başka <br> yoksa)
  const isTrailingBr = (br, block) => {
    const brs = block.getElementsByTagName('br');
    if (brs[brs.length - 1] !== br) return false;
    const r = document.createRange();
    r.setStartAfter(br);
    r.setEnd(block, block.childNodes.length);
    return r.toString() === '';
  };
  const walk = (node, fmt, block) => {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType === 3) {
        const parts = c.data.replace(/[\r\u200B]/g, '').split('\n');
        parts.forEach((txt, i) => {
          if (i > 0 || !cur) newPara(block);
          if (txt) cur.runs.push({ text: txt, ...fmt });
        });
      } else if (c.nodeType === 1) {
        if (c.tagName === 'BR') {
          if (c.dataset.soft && !isTrailingBr(c, block)) {
            if (!cur) newPara(block);
            cur.runs.push({ text: '\n', ...fmt }); // paragraf içi satır sonu
            continue;
          }
          if (isTrailingBr(c, block)) {
            if (!cur) newPara(block);
            continue; // blok sonundaki yer tutucu satır sonu
          }
          if (block && block !== root) {
            if (!cur) newPara(block);
            cur.runs.push({ text: '\n', ...fmt }); // paragraf içi satır sonu
          } else newPara(block);
        } else if (isBlock(c)) {
          newPara(c);
          walk(c, fmt, c);
          cur = null;
        } else {
          walk(c, { ...fmt, ...inlineFmt(c) }, block);
        }
      }
    }
  };
  walk(root, {}, root);
  if (!paras.length) paras.push({ runs: [] });

  // Öğe varsayılanlarına eşit biçimleri kaldır, komşu parçaları birleştir
  for (const p of paras) {
    if (p.align && p.align === t.align) delete p.align;
    p.runs = p.runs.map((r) => {
      const o = { text: r.text };
      if (r.font && r.font !== t.font) o.font = r.font;
      if (r.size && Math.abs(r.size - (p.size || t.fontSize)) > 0.05) o.size = r.size;
      if (r.color && r.color.toLowerCase() !== String(t.color).toLowerCase()) o.color = r.color;
      for (const k of ['bold', 'italic', 'underline']) if (r[k] !== undefined && r[k] !== !!t[k]) o[k] = r[k];
      if (r.strike) o.strike = true;
      if (r.caps) o.caps = true;
      return o;
    });
    const merged = [];
    for (const r of p.runs) {
      const last = merged[merged.length - 1];
      if (last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...r, text: '' })) last.text += r.text;
      else merged.push(r);
    }
    p.runs = merged;
  }
  while (paras.length > 1 && !paras[paras.length - 1].runs.length && !paras[paras.length - 1].bullet) paras.pop();
  return paras;
}

/* ------------------------------------------------------------------ */
/* Özellikler paneli                                                   */
/* ------------------------------------------------------------------ */

function renderProps() {
  const p = $('#props');
  const el = selEl();
  const slide = curSlide();
  if (!el) {
    p.innerHTML = `
      <h3>Slayt</h3>
      <div class="prop-row"><label>Arka plan</label><input type="color" data-slide="bg" value="${slide.bg}"></div>
      <button class="btn" data-action="bg-all">Arka planı tüm slaytlara uygula</button>
      <h3>Tema</h3>
      <div class="theme-grid">
        ${THEMES.map((t) => `<button class="theme-swatch${deck.theme === t.id ? ' on' : ''}" data-theme="${t.id}" title="${t.name}"
          style="background:${t.bg};color:${t.text};font-family:'${t.font}'"><span style="border-bottom:3px solid ${t.accent}">${t.name}</span></button>`).join('')}
      </div>
      <p class="hint">Tema tüm slaytların arka planını, metin ve vurgu renklerini değiştirir.</p>
      <h3>İpuçları</h3>
      <p class="hint">Metni düzenlemek için kutuya çift tıklayın. Öğeleri sürükleyerek taşıyın, kenarlardaki tutamaçlarla boyutlandırın (Shift: oranı koru). Görselleri sürükleyip bırakabilir veya yapıştırabilirsiniz.</p>
      <p class="hint">Kısayollar: Ctrl+Z / Ctrl+Y, Ctrl+C / Ctrl+V, Ctrl+D, Del, ok tuşları, F5.</p>`;
    return;
  }
  const num = (k, label) => `<label>${label}<input type="number" data-prop="${k}" value="${Math.round(el[k] || 0)}"></label>`;
  const NAMES = { text: 'Metin kutusu', rect: 'Dikdörtgen', ellipse: 'Elips', image: 'Görsel', shape: 'Şekil', table: 'Tablo' };
  let html = `<h3>${NAMES[el.type] || 'Öğe'}</h3>
    <div class="grid4">${num('x', 'X')}${num('y', 'Y')}${num('w', 'Genişlik')}${num('h', 'Yükseklik')}</div>
    ${el.type !== 'table' ? `<div class="prop-row"><label>Döndür (°)</label><input type="number" min="-360" max="360" data-prop="rot" value="${Math.round(el.rot || 0)}"></div>` : ''}`;
  const color6 = (c, d) => (c && /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : d);

  const tt = textTargets(el)[0];
  if (tt) {
    html += `
      <h3>Yazı</h3>
      ${tt.paras ? '<p class="hint">Bu metinde karışık biçim var. Buradaki ayarlar tüm metne uygulanır; tek bir kelimeyi biçimlendirmek için metni düzenlerken seçip Ctrl+B / Ctrl+I / Ctrl+U kullanın.</p>' : ''}
      <div class="prop-row"><label>Yazı tipi</label><select data-prop="font">${[...new Set([...FONTS, tt.font])].map((f) => `<option${f === tt.font ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
      <div class="prop-row"><label>Boyut</label><input type="number" min="4" max="400" step="0.5" data-prop="fontSize" value="${+(+tt.fontSize).toFixed(1)}"></div>
      <div class="prop-row"><label>Renk</label><input type="color" data-prop="color" value="${color6(tt.color, '#000000')}"></div>
      <div class="prop-row"><label>Stil</label><div class="seg">
        <button data-toggle="bold" class="${tt.bold ? 'on' : ''}" title="Kalın (Ctrl+B)"><b>K</b></button>
        <button data-toggle="italic" class="${tt.italic ? 'on' : ''}" title="İtalik (Ctrl+I)"><i>İ</i></button>
        <button data-toggle="underline" class="${tt.underline ? 'on' : ''}" title="Altı çizili (Ctrl+U)"><u>A</u></button>
      </div></div>
      <div class="prop-row"><label>Hizalama</label><div class="seg">
        ${[['left', '⯇'], ['center', '≡'], ['right', '⯈'], ['justify', '☰']].map(([v, i]) => `<button data-set="align" data-val="${v}" class="${(tt.align || 'left') === v ? 'on' : ''}">${i}</button>`).join('')}
      </div></div>`;
  }
  if (el.type === 'text') {
    html += `
      <div class="prop-row"><label>Dikey</label><div class="seg">
        ${[['top', 'Üst'], ['middle', 'Orta'], ['bottom', 'Alt']].map(([v, i]) => `<button data-set="valign" data-val="${v}" class="${(el.valign || 'top') === v ? 'on' : ''}">${i}</button>`).join('')}
      </div></div>
      <div class="prop-row"><label>Dolgu</label><input type="color" data-prop="fill" value="${color6(el.fill, '#ffffff')}" ${el.fill ? '' : 'disabled'}>
        <label class="chk"><input type="checkbox" data-fill-toggle ${el.fill ? 'checked' : ''}> Var</label></div>`;
  }
  if (el.type === 'rect' || el.type === 'ellipse' || el.type === 'shape') {
    const open = el.type === 'shape' && (Shapes.isOpen(el.geom) || /Connector/.test(el.geom || ''));
    html += `
      <h3>Görünüm</h3>
      ${open ? '' : `<div class="prop-row"><label>Dolgu</label><input type="color" data-prop="fill" value="${color6(el.fill, '#ffffff')}" ${el.fill ? '' : 'disabled'}>
        <label class="chk"><input type="checkbox" data-fill-toggle ${el.fill ? 'checked' : ''}> Var</label></div>`}
      <div class="prop-row"><label>${open ? 'Çizgi' : 'Kenarlık'}</label><input type="color" data-prop="stroke" value="${color6(el.stroke, '#000000')}">
        <input type="number" min="0" max="40" step="0.5" data-prop="strokeWidth" value="${el.strokeWidth || 0}" title="Kalınlık"></div>
      ${el.type === 'rect' ? `<div class="prop-row"><label>Köşe</label><input type="number" min="0" max="270" data-prop="radius" value="${el.radius || 0}"></div>` : ''}`;
  }
  if (el.type === 'table') {
    html += `
      <h3>Tablo</h3>
      <div class="prop-row"><label>Kenarlık</label><input type="color" data-prop="border" value="${color6(el.border, '#9aa0b4')}"></div>
      <p class="hint">Hücre metnini düzenlemek için hücreye çift tıklayın.</p>`;
  }
  if (el.type === 'image') {
    html += `<button class="btn" data-action="img-ratio">Orijinal oranı geri yükle</button>`;
  }
  html += `
    <h3>Düzen</h3>
    <div class="btn-row"><button class="btn" data-action="front" title="Öne getir">⬆ Öne</button><button class="btn" data-action="back" title="Arkaya gönder">⬇ Arkaya</button></div>
    <div class="btn-row"><button class="btn" data-action="center-h">↔ Ortala</button><button class="btn" data-action="center-v">↕ Ortala</button></div>
    <button class="btn" data-action="dup">⧉ Çoğalt</button>
    <button class="btn danger" data-action="delete">🗑 Sil</button>`;
  p.innerHTML = html;
}

function onPropInput(e) {
  const t = e.target;
  const el = selEl();
  if (t.dataset.slide === 'bg') {
    curSlide().bg = t.value;
    delete curSlide().bgGrad;
    delete curSlide().bgImg;
    $('#stage').style.background = t.value;
    refreshActiveThumb();
    scheduleSave();
    return;
  }
  if (!el || !t.dataset.prop) return;
  const k = t.dataset.prop;
  let v = t.type === 'number' ? parseFloat(t.value) : t.value;
  if (t.type === 'number' && Number.isNaN(v)) return;
  if (k === 'fontSize') v = clamp(v, 4, 400);
  if (k === 'w' || k === 'h') v = Math.max(10, v);
  if (k === 'stroke' && !el.strokeWidth) el.strokeWidth = 2;
  if (RUN_KEY[k] && textTargets(el).length) applyTextProp(el, k, v);
  else el[k] = v;
  if (k === 'rot' && !v) delete el.rot;
  renderStage();
  refreshActiveThumb();
  scheduleSave();
}

function onPropChange(e) {
  const t = e.target;
  if (t.dataset.slide || t.dataset.prop) { commit({ props: t.dataset.prop === 'stroke' }); return; }
  if (t.hasAttribute('data-fill-toggle')) {
    const el = selEl();
    if (!el) return;
    el.fill = t.checked ? (el.type === 'text' ? '#ffffff' : themeById(deck.theme).accent) : null;
    commit();
  }
}

function onPropClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const el = selEl();
  if (b.dataset.theme) return applyTheme(b.dataset.theme);
  if (b.dataset.toggle && el) {
    const k = b.dataset.toggle;
    const tt = textTargets(el)[0];
    applyTextProp(el, k, !(tt && tt[k]));
    return commit();
  }
  if (b.dataset.set && el) {
    if (b.dataset.set === 'align') applyTextProp(el, 'align', b.dataset.val);
    else el[b.dataset.set] = b.dataset.val;
    return commit();
  }
  switch (b.dataset.action) {
    case 'bg-all': deck.slides.forEach((s) => { s.bg = curSlide().bg; s.bgGrad = curSlide().bgGrad; s.bgImg = curSlide().bgImg; if (!s.bgGrad) delete s.bgGrad; if (!s.bgImg) delete s.bgImg; }); commit(); toast('Arka plan tüm slaytlara uygulandı.'); break;
    case 'front': reorderEl(1); break;
    case 'back': reorderEl(-1); break;
    case 'center-h': el.x = Math.round((W - el.w) / 2); commit(); break;
    case 'center-v': el.y = Math.round((H - el.h) / 2); commit(); break;
    case 'dup': duplicateEl(); break;
    case 'delete': deleteEl(); break;
    case 'img-ratio': {
      const img = new Image();
      img.onload = () => { el.h = Math.round(el.w * (img.naturalHeight / img.naturalWidth)); commit(); };
      img.src = el.src;
      break;
    }
    default: break;
  }
}

function applyTheme(id) {
  const from = themeById(deck.theme);
  const to = themeById(id);
  const map = (c) => (c && c.toLowerCase() === from.text ? to.text : c && c.toLowerCase() === from.accent ? to.accent : c);
  for (const s of deck.slides) {
    s.bg = to.bg;
    for (const el of s.elements) {
      for (const t of textTargets(el)) {
        t.color = map(t.color);
        if (t.font === from.font) t.font = to.font;
        (t.paras || []).forEach((p) => p.runs.forEach((r) => { if (r.color) r.color = map(r.color); }));
        if (t.fill) t.fill = map(t.fill);
      }
      if (el.fill && el.type !== 'text') el.fill = map(el.fill);
      if (el.stroke) el.stroke = map(el.stroke);
    }
    delete s.bgGrad;
  }
  deck.theme = id;
  commit();
}

/* ------------------------------------------------------------------ */
/* Öğe işlemleri                                                       */
/* ------------------------------------------------------------------ */

const SHAPE_PRESETS = {
  triangle: 'Üçgen', diamond: 'Elmas', pentagon: 'Beşgen', hexagon: 'Altıgen', star5: 'Yıldız',
  rightArrow: 'Sağ ok', leftArrow: 'Sol ok', chevron: 'Köşeli ok', homePlate: 'Ok kutusu', heart: 'Kalp', line: 'Ok çizgisi',
};

function addElement(type) {
  const t = themeById(deck.theme);
  let el;
  if (type === 'text') {
    el = textEl(t, { x: 280, y: 220, w: 400, h: 70, fontSize: 28 });
  } else if (type === 'rect' || type === 'ellipse') {
    el = shapeEl(type, t, { y: Math.round((H - 200) / 2) });
  } else if (type === 'table') {
    const cell = (hdr) => ({ text: '', font: t.font, fontSize: 18, color: hdr ? '#ffffff' : t.text, bold: hdr, italic: false, underline: false, align: 'left', valign: 'middle', fill: hdr ? t.accent : null, inset: [10, 5, 10, 5] });
    el = {
      id: uid(), type: 'table', x: 180, y: Math.round((H - 180) / 2), w: 600, h: 180, cols: [200, 200, 200], border: '#9aa0b4', borderWidth: 1,
      rows: [0, 1, 2].map((ri) => ({ h: 60, cells: [0, 1, 2].map(() => cell(ri === 0)) })),
    };
  } else if (SHAPE_PRESETS[type]) {
    const line = type === 'line';
    el = { id: uid(), type: 'shape', geom: type, adj: {}, x: 380, y: Math.round((H - 160) / 2), w: line ? 240 : 200, h: line ? 0 : 160, fill: line ? null : t.accent, stroke: line ? t.text : null, strokeWidth: line ? 3 : 0 };
    if (line) el.tailEnd = 'triangle';
  } else if (type === 'image') {
    $('#fileImage').click();
    return;
  }
  curSlide().elements.push(el);
  selId = el.id;
  commit();
  if (type === 'text') {
    newTextId = el.id;
    startEdit(el.id);
  }
}

function deleteEl() {
  if (!selId) return;
  const s = curSlide();
  s.elements = s.elements.filter((e) => e.id !== selId);
  selId = null;
  commit();
}

function duplicateEl() {
  const el = selEl();
  if (!el) return;
  const c = Object.assign(clone(el), { id: uid(), x: el.x + 20, y: el.y + 20 });
  curSlide().elements.push(c);
  selId = c.id;
  commit();
}

function reorderEl(dir) {
  const els = curSlide().elements;
  const i = els.findIndex((e) => e.id === selId);
  if (i < 0) return;
  const [e] = els.splice(i, 1);
  if (dir > 0) els.push(e); else els.unshift(e);
  commit();
}

function readImageFile(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        // PowerPoint uyumluluğu ve boyut için PNG/JPEG'e dönüştür, en fazla 1920px
        const max = 1920;
        const r = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const cw = Math.max(1, Math.round((img.naturalWidth || 800) * r));
        const ch = Math.max(1, Math.round((img.naturalHeight || 600) * r));
        const c = document.createElement('canvas');
        c.width = cw;
        c.height = ch;
        c.getContext('2d').drawImage(img, 0, 0, cw, ch);
        const jpeg = file.type === 'image/jpeg';
        res({ src: c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9), w: cw, h: ch });
      };
      img.onerror = () => rej(new Error('Görsel okunamadı'));
      img.src = fr.result;
    };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

async function addImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const { src, w, h } = await readImageFile(file);
    const r = Math.min(1, 600 / w, 400 / h);
    const ew = Math.round(w * r);
    const eh = Math.round(h * r);
    const el = { id: uid(), type: 'image', src, x: Math.round((W - ew) / 2), y: Math.round((H - eh) / 2), w: ew, h: eh };
    curSlide().elements.push(el);
    selId = el.id;
    commit();
  } catch (e) {
    toast(e.message);
  }
}

/* ------------------------------------------------------------------ */
/* Metin düzenleme                                                     */
/* ------------------------------------------------------------------ */

let editTarget = null; // düzenlenen metin (metin kutusu veya tablo hücresi)
let editBox = null;    // düzenlenebilir .txt alanı

function startEdit(id, cell = null) {
  const el = curSlide().elements.find((e) => e.id === id);
  if (!el) return;
  let target = null;
  if (el.type === 'text') target = el;
  else if (el.type === 'table' && cell) target = el.rows[cell.r]?.cells[cell.c];
  if (!target || target.hidden) return;
  selId = id;
  editingId = id;
  editTarget = target;
  renderStage();
  renderProps();
  const node = $(`#stage .el[data-id="${id}"]`);
  const txt = cell ? $(`td[data-r="${cell.r}"][data-c="${cell.c}"] .txt`, node) : $('.txt', node);
  editBox = txt;
  node.classList.add('editing');
  node.classList.remove('empty');
  txt.contentEditable = 'true';
  txt.spellcheck = false;
  txt.focus();
  try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* desteklenmiyor */ }
  const range = document.createRange();
  range.selectNodeContents(txt);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  txt.addEventListener('input', () => scheduleSave());
  txt.addEventListener('keydown', (e) => {
    // Shift+Enter: PowerPoint'teki gibi paragraf içinde satır sonu
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const br = document.createElement('br');
      br.dataset.soft = '1';
      r.insertNode(br);
      // İmlecin yeni satırda durabilmesi için arkasına görünmez karakter koy (ayrıştırırken atılır)
      const next = br.nextSibling;
      if (!next || (next.nodeType === 3 && !next.data) || next.nodeName === 'BR') br.parentNode.insertBefore(document.createTextNode('\u200B'), br.nextSibling);
      r.setStartAfter(br);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      scheduleSave();
    }
  });
  txt.addEventListener('blur', () => finishEdit(), { once: true });
  txt.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
}

function finishEdit() {
  if (!editingId) return;
  const s = curSlide();
  const el = s.elements.find((e) => e.id === editingId);
  if (editTarget && editBox) {
    editTarget.paras = parseEditable(editBox, editTarget);
    simplifyText(editTarget);
  }
  editingId = null;
  editTarget = null;
  editBox = null;
  let removed = false;
  if (el && el.type === 'text' && !el.text.trim() && el.id === newTextId) {
    s.elements = s.elements.filter((e) => e !== el);
    selId = null;
    removed = true;
  }
  newTextId = null;
  // Panel zaten bu öğeyi gösteriyor; yeniden çizmek panelde yapılan tıklamayı kaybettirir
  commit({ props: removed || !el });
}

/** Düzenleme sırasında Ctrl+B/I/U: seçili kısma, seçim yoksa tüm metne uygular */
function formatSelection(prop) {
  const sel = window.getSelection();
  if (editBox && sel && !sel.isCollapsed && editBox.contains(sel.anchorNode)) {
    document.execCommand(prop, false, null);
    scheduleSave();
    return;
  }
  if (!editTarget) return;
  editTarget.paras = parseEditable(editBox, editTarget);
  setTextProp(editTarget, prop, !editTarget[prop]);
  const node = editBox.closest('td') || editBox.closest('.el');
  applyTextStyle(node, editTarget);
  renderTextContent(editTarget, editBox);
  scheduleSave();
}

/* ------------------------------------------------------------------ */
/* Sahnede sürükle / boyutlandır                                       */
/* ------------------------------------------------------------------ */

function stagePoint(e) {
  const r = $('#stage').getBoundingClientRect();
  return { x: (e.clientX - r.left) / stageScale, y: (e.clientY - r.top) / stageScale };
}

function clearGuides() { $$('#stage .guide').forEach((g) => g.remove()); }
function showGuide(kind, pos) {
  const g = document.createElement('div');
  g.className = `guide ${kind}`;
  if (kind === 'v') g.style.left = `${pos}px`; else g.style.top = `${pos}px`;
  $('#stage').appendChild(g);
}

function snapMove(el, nx, ny) {
  const SNAP = 6;
  const others = curSlide().elements.filter((o) => o.id !== el.id);
  const xs = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const ys = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
  let gx = null;
  let gy = null;
  for (const off of [0, el.w / 2, el.w]) {
    for (const x of xs) {
      if (gx === null && Math.abs(nx + off - x) < SNAP) { nx = x - off; gx = x; }
    }
  }
  for (const off of [0, el.h / 2, el.h]) {
    for (const y of ys) {
      if (gy === null && Math.abs(ny + off - y) < SNAP) { ny = y - off; gy = y; }
    }
  }
  clearGuides();
  if (gx !== null) showGuide('v', gx);
  if (gy !== null) showGuide('h', gy);
  return { x: nx, y: ny };
}

function onStagePointerDown(e) {
  if (e.button !== 0) return;
  const handle = e.target.closest('.handle');
  const node = e.target.closest('.el');
  if (editingId) {
    if (node && node.dataset.id === editingId && (!node.classList.contains('el-table') || editBox?.contains(e.target))) return; // metin içinde imleç
    editBox?.blur();
  }
  if (!node) {
    if (selId) { selId = null; renderStage(); renderProps(); }
    return;
  }
  const id = node.dataset.id;
  if (selId !== id) {
    selId = id;
    renderStage();
    renderProps();
  }
  const el = selEl();
  const live = $(`#stage .el[data-id="${id}"]`);
  const start = stagePoint(e);
  const box0 = { x: el.x, y: el.y, w: el.w, h: el.h };
  const dir = handle ? handle.dataset.h : null;
  let moved = false;
  e.preventDefault();
  live.setPointerCapture?.(e.pointerId);

  const onMove = (ev) => {
    const p = stagePoint(ev);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    moved = true;
    if (!dir) {
      const s = ev.altKey ? { x: box0.x + dx, y: box0.y + dy } : snapMove(el, box0.x + dx, box0.y + dy);
      el.x = Math.round(s.x);
      el.y = Math.round(s.y);
    } else {
      const MIN = 16;
      let { x, y, w, h } = box0;
      if (dir.includes('e')) w = box0.w + dx;
      if (dir.includes('s')) h = box0.h + dy;
      if (dir.includes('w')) { w = box0.w - dx; x = box0.x + dx; }
      if (dir.includes('n')) { h = box0.h - dy; y = box0.y + dy; }
      const corner = dir.length === 2;
      if (corner && (ev.shiftKey || el.type === 'image')) {
        const ratio = box0.w / box0.h;
        if (Math.abs(w - box0.w) / box0.w > Math.abs(h - box0.h) / box0.h) h = w / ratio; else w = h * ratio;
        if (dir.includes('w')) x = box0.x + box0.w - w;
        if (dir.includes('n')) y = box0.y + box0.h - h;
      }
      if (w < MIN) { if (dir.includes('w')) x -= MIN - w; w = MIN; }
      if (h < MIN) { if (dir.includes('n')) y -= MIN - h; h = MIN; }
      Object.assign(el, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    }
    applyBox(live, el);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    clearGuides();
    if (moved) commit();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

/* ------------------------------------------------------------------ */
/* Slayt işlemleri                                                     */
/* ------------------------------------------------------------------ */

function selectSlide(i) {
  if (editingId) editBox?.blur();
  cur = clamp(i, 0, deck.slides.length - 1);
  selId = null;
  renderAll();
}
function addSlide(layout) {
  deck.slides.splice(cur + 1, 0, makeSlide(layout, themeById(deck.theme)));
  cur += 1;
  selId = null;
  commit();
}
function duplicateSlide(i) {
  const c = clone(deck.slides[i]);
  c.id = uid();
  c.elements.forEach((e) => { e.id = uid(); });
  deck.slides.splice(i + 1, 0, c);
  cur = i + 1;
  selId = null;
  commit();
}
function deleteSlide(i) {
  if (deck.slides.length === 1) { toast('Sunumda en az bir slayt olmalı.'); return; }
  deck.slides.splice(i, 1);
  cur = clamp(cur > i || cur === deck.slides.length ? cur - 1 : cur, 0, deck.slides.length - 1);
  selId = null;
  commit();
}
function moveSlide(from, to) {
  if (to < 0 || to >= deck.slides.length || from === to) return;
  const [s] = deck.slides.splice(from, 1);
  deck.slides.splice(to, 0, s);
  cur = to;
  commit();
}

/* ------------------------------------------------------------------ */
/* Sunum modu                                                          */
/* ------------------------------------------------------------------ */

let pIndex = 0;
let pCursorTimer = null;

function startPresentation(fromStart = false) {
  if (editingId) editBox?.blur();
  pIndex = fromStart ? 0 : cur;
  const p = $('#presenter');
  p.hidden = false;
  if (p.requestFullscreen) p.requestFullscreen().catch(() => {});
  showPresented();
}
function showPresented() {
  const scaler = $('#presenterScaler');
  scaler.innerHTML = '';
  const s = slideNode(deck.slides[pIndex]);
  s.classList.add('enter');
  scaler.appendChild(s);
  fitPresenter();
  $('#pCount').textContent = `${pIndex + 1} / ${deck.slides.length}`;
}
function fitPresenter() {
  const s = $('#presenterScaler .slide');
  if (!s) return;
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  const scaler = $('#presenterScaler');
  scaler.style.left = `${(window.innerWidth - W * k) / 2}px`;
  scaler.style.top = `${(window.innerHeight - H * k) / 2}px`;
  s.style.transform = `scale(${k})`;
}
function presentGo(d) {
  const n = clamp(pIndex + d, 0, deck.slides.length - 1);
  if (n !== pIndex) { pIndex = n; showPresented(); }
}
function endPresentation() {
  $('#presenter').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  selectSlide(pIndex);
}

/* ------------------------------------------------------------------ */
/* Dışa / içe aktarma                                                  */
/* ------------------------------------------------------------------ */

// Bazı tarayıcılar ASCII olmayan indirme adlarını yok sayar; Türkçe harfleri sadeleştir
const TR_MAP = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C' };
const safeName = (s) => (s || '')
  .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_MAP[c])
  .normalize('NFKD').replace(/[^\x20-\x7e]/g, '')
  .replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'sunum';

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// .present dosyası = PowerPoint ile açılabilen geçerli bir .pptx paketi
// + Present'in kayıpsız verisi (present/deck.json) aynı paketin içinde.
const PRESENT_PART = 'present/deck.json';
const PRESENT_REL = 'https://present.app/2026/relationships/deck';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

let libPromise = null;
function loadLib() {
  if (window.PptxGenJS && window.JSZip) return Promise.resolve();
  if (libPromise) return libPromise;
  libPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/pptxgen.bundle.js';
    s.onload = () => res();
    s.onerror = () => { libPromise = null; rej(new Error('PowerPoint kütüphanesi yüklenemedi')); };
    document.head.appendChild(s);
  });
  return libPromise;
}

async function buildPackage(d) {
  await loadLib();
  const zip = await PptxExport.build(d);

  // Present verisini pakete göm (PowerPoint bilinmeyen ilişki türlerini yok sayar)
  const data = { format: FILE_FORMAT, version: APP_VERSION, exported: new Date().toISOString(), deck: d };
  zip.file(PRESENT_PART, JSON.stringify(data));
  let ct = await zip.file('[Content_Types].xml').async('string');
  if (!/Extension="json"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="json" ContentType="application/json"/><Default ');
  zip.file('[Content_Types].xml', ct);
  let rels = await zip.file('_rels/.rels').async('string');
  if (!rels.includes(PRESENT_REL)) rels = rels.replace('</Relationships>', `<Relationship Id="rIdPresentDeck" Type="${PRESENT_REL}" Target="${PRESENT_PART}"/></Relationships>`);
  zip.file('_rels/.rels', rels);
  return zip.generateAsync({ type: 'blob', mimeType: PPTX_MIME, compression: 'DEFLATE' });
}

async function exportFile(d = deck, ext = 'present') {
  toast('Dosya hazırlanıyor…');
  try {
    const blob = await buildPackage(d);
    downloadBlob(blob, `${safeName(d.title)}.${ext}`);
    toast(ext === 'pptx' ? 'PowerPoint dosyası indirildi.' : 'Present dosyası indirildi.');
  } catch (e) {
    console.error(e);
    toast(`İndirme başarısız: ${e.message}`);
  }
}

function exportPdf() {
  const area = $('#printArea');
  area.innerHTML = '';
  deck.slides.forEach((s) => area.appendChild(slideNode(s)));
  let pageStyle = $('#printPageSize');
  if (!pageStyle) { pageStyle = document.createElement('style'); pageStyle.id = 'printPageSize'; document.head.appendChild(pageStyle); }
  pageStyle.textContent = `@media print { @page { size: 10in ${(H / 96).toFixed(3)}in; margin: 0; } }`;
  const prevTitle = document.title;
  document.title = safeName(deck.title);
  const imgs = $$('img', area).filter((i) => !i.complete);
  Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(() => {
    window.print();
    document.title = prevTitle;
    area.innerHTML = '';
  });
}

const ELEMENT_TYPES = ['text', 'rect', 'ellipse', 'image', 'shape', 'table'];

function normalizeDeck(d) {
  if (!d || !Array.isArray(d.slides)) throw new Error('Geçersiz dosya');
  const t = themeById(d.theme);
  d.id = uid();
  d.title = String(d.title || 'İçe aktarılan sunum');
  d.theme = t.id;
  d.created = d.created || Date.now();
  d.updated = Date.now();
  d.slides = d.slides.map((s) => ({
    id: uid(),
    bg: s.bg || t.bg,
    notes: String(s.notes || ''),
    ...(s.bgGrad ? { bgGrad: s.bgGrad } : {}),
    ...(s.bgImg ? { bgImg: s.bgImg } : {}),
    elements: (s.elements || []).filter((e) => ELEMENT_TYPES.includes(e.type)).map((e) => {
      const el = { ...e, id: uid() };
      if (el.type === 'text') simplifyText(el);
      if (el.type === 'table') el.rows.forEach((r) => r.cells.forEach((c) => { if (!c.hidden) simplifyText(c); }));
      return el;
    }),
  }));
  d.h = d.h && d.h > 100 && d.h < 3000 ? Math.round(d.h) : 540;
  if (!d.slides.length) d.slides.push(makeSlide('title', t));
  return d;
}

// Dosya türünü içerikten anla: ZIP (PK) = .pptx, OLE (D0 CF) = eski .ppt
async function sniff(file) {
  const h = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (h[0] === 0x50 && h[1] === 0x4b) return 'zip';
  if (h[0] === 0xd0 && h[1] === 0xcf) return 'ole';
  return 'text';
}

async function importFile(file) {
  try {
    let d;
    let skipped = 0;
    const kind = await sniff(file);
    if (kind === 'ole') {
      toast('Eski .ppt biçimi (veya parola korumalı dosya) desteklenmiyor. PowerPoint\'te “Farklı Kaydet → .pptx” ile kaydedip tekrar deneyin.');
      return;
    }
    if (kind === 'zip') {
      await loadLib();
      const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
      const own = zip.file(PRESENT_PART);
      if (own) {
        // Present ile kaydedilmiş dosya: kayıpsız veri
        const data = JSON.parse(await own.async('string'));
        d = normalizeDeck(data.deck);
      } else {
        toast('PowerPoint dosyası açılıyor…');
        const res = await PptxImport.convert(zip, file.name);
        d = normalizeDeck(res.deck);
        skipped = res.skipped;
      }
    } else {
      const data = JSON.parse(await file.text());
      d = normalizeDeck(data.format === FILE_FORMAT ? data.deck : data);
    }
    await Store.put(d);
    toast(skipped ? `“${d.title}” açıldı. Desteklenmeyen ${skipped} öğe (grafik vb.) atlandı.` : `“${d.title}” açıldı.`);
    openDeck(d.id);
  } catch (e) {
    console.error(e);
    toast(`Dosya açılamadı: ${e.message || 'bilinmeyen hata'}. Geçerli bir .present veya .pptx dosyası seçin.`);
  }
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, Math.max(2600, msg.length * 70));
}

const isTyping = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/* ------------------------------------------------------------------ */
/* Olaylar                                                             */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $('#btnHome').addEventListener('click', () => { location.hash = ''; });
  $('#btnNewDeck').addEventListener('click', createDeck);
  $('#btnImport').addEventListener('click', () => $('#fileImport').click());
  $('#fileImport').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
  $('#fileImage').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });

  $('#deckTitle').addEventListener('input', (e) => { deck.title = e.target.value; scheduleSave(); });
  $('#deckTitle').addEventListener('change', (e) => { deck.title = e.target.value.trim() || 'Adsız sunum'; e.target.value = deck.title; pushHistory(); });
  $('#deckTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnPresent').addEventListener('click', () => startPresentation(false));

  // İndir menüsü: .present (varsayılan) veya aynı içerik .pptx uzantısıyla
  const menu = $('#downloadMenu');
  $('#btnDownload').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-export]');
    if (!b) return;
    menu.hidden = true;
    await saveNow();
    exportFile(deck, b.dataset.export);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) menu.hidden = true; });
  $('#btnPrint').addEventListener('click', async () => {
    await saveNow();
    exportPdf();
  });

  // Dosya sürükle-bırak ile açma (ana sayfa)
  const home = $('#homeView');
  home.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  home.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) { e.preventDefault(); importFile(f); }
  });

  // Slayt ekleme
  const picker = $('#layoutPicker');
  $('#btnAddSlide').addEventListener('click', (e) => { e.stopPropagation(); picker.hidden = !picker.hidden; });
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (b) { picker.hidden = true; addSlide(b.dataset.layout); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-slide')) picker.hidden = true;
  });

  // Slayt listesi
  const list = $('#slideList');
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.slide-item');
    if (!item) return;
    const i = +item.dataset.index;
    const act = e.target.closest('[data-sact]')?.dataset.sact;
    if (act === 'up') moveSlide(i, i - 1);
    else if (act === 'down') moveSlide(i, i + 1);
    else if (act === 'dup') duplicateSlide(i);
    else if (act === 'del') deleteSlide(i);
    else selectSlide(i);
  });
  let dragFrom = null;
  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.slide-item');
    if (!item) return;
    dragFrom = +item.dataset.index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  list.addEventListener('dragover', (e) => {
    const item = e.target.closest('.slide-item');
    if (dragFrom === null || !item) return;
    e.preventDefault();
    $$('.slide-item.drag-over', list).forEach((x) => x.classList.remove('drag-over'));
    item.classList.add('drag-over');
  });
  list.addEventListener('drop', (e) => {
    const item = e.target.closest('.slide-item');
    if (dragFrom === null || !item) return;
    e.preventDefault();
    moveSlide(dragFrom, +item.dataset.index);
    dragFrom = null;
  });
  list.addEventListener('dragend', () => { dragFrom = null; $$('.slide-item.drag-over', list).forEach((x) => x.classList.remove('drag-over')); });

  // Araç çubuğu
  const shapeMenu = $('#shapeMenu');
  const NS = 'http://www.w3.org/2000/svg';
  for (const [geom, name] of Object.entries(SHAPE_PRESETS)) {
    const b = document.createElement('button');
    b.dataset.add = geom;
    b.title = name;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-2 -2 36 28');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', Shapes.preset(geom, 32, geom === 'line' ? 24 : 24, {}));
    path.setAttribute('fill', geom === 'line' ? 'none' : 'currentColor');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);
    b.appendChild(svg);
    shapeMenu.appendChild(b);
  }
  $('#btnShapes').addEventListener('click', (e) => {
    e.stopPropagation();
    // Araç çubuğu kaydırılabilir olduğu için menü sabit konumda açılır
    const r = e.currentTarget.getBoundingClientRect();
    Object.assign(shapeMenu.style, { position: 'fixed', left: `${Math.min(r.left, window.innerWidth - 230)}px`, top: `${r.bottom + 4}px` });
    shapeMenu.hidden = !shapeMenu.hidden;
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#btnShapes')) shapeMenu.hidden = true; });
  $$('[data-add]').forEach((b) => b.addEventListener('click', () => addElement(b.dataset.add)));
  $('#btnDupEl').addEventListener('click', duplicateEl);
  $('#btnDelEl').addEventListener('click', deleteEl);

  // Sahne
  const stage = $('#stage');
  stage.addEventListener('pointerdown', onStagePointerDown);
  stage.addEventListener('dblclick', (e) => {
    const node = e.target.closest('.el-text, .el-table');
    if (!node) return;
    // Sürükleme için işaretçi yakalandığından hedef tablo kutusu olabilir: hücreyi tıklanan noktadan bul
    const td = (document.elementFromPoint(e.clientX, e.clientY) || e.target).closest('td[data-r]');
    if (node.classList.contains('el-table')) {
      if (td && !editBox?.contains(e.target)) startEdit(node.dataset.id, { r: +td.dataset.r, c: +td.dataset.c });
    } else if (node.dataset.id !== editingId) startEdit(node.dataset.id);
  });
  $('#stageWrap').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'stageWrap' || e.target.id === 'stageScaler') {
      if (editingId) editBox?.blur();
      if (selId) { selId = null; renderStage(); renderProps(); }
    }
  });
  new ResizeObserver(fitStage).observe($('#stageWrap'));

  // Görsel sürükle-bırak
  const wrap = $('#stageWrap');
  wrap.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('drop', (e) => {
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); addImageFile(f); }
  });

  // Notlar
  $('#notes').addEventListener('input', (e) => { curSlide().notes = e.target.value; scheduleSave(); });
  $('#notes').addEventListener('change', () => pushHistory());

  // Özellikler
  const props = $('#props');
  props.addEventListener('input', onPropInput);
  props.addEventListener('change', onPropChange);
  props.addEventListener('click', onPropClick);

  // Pano: görsel yapıştırma
  document.addEventListener('paste', (e) => {
    if (!deck || isTyping(e.target) || !$('#presenter').hidden) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); addImageFile(f); }
  });

  // Sunum modu
  const pres = $('#presenter');
  $('#pPrev').addEventListener('click', (e) => { e.stopPropagation(); presentGo(-1); });
  $('#pNext').addEventListener('click', (e) => { e.stopPropagation(); presentGo(1); });
  $('#pExit').addEventListener('click', (e) => { e.stopPropagation(); endPresentation(); });
  pres.addEventListener('click', (e) => { if (!e.target.closest('.presenter-bar')) presentGo(1); });
  pres.addEventListener('contextmenu', (e) => { e.preventDefault(); presentGo(-1); });
  pres.addEventListener('pointermove', () => {
    pres.classList.add('show-cursor');
    clearTimeout(pCursorTimer);
    pCursorTimer = setTimeout(() => pres.classList.remove('show-cursor'), 2000);
  });
  let touchX = null;
  pres.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  pres.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { e.preventDefault(); presentGo(dx < 0 ? 1 : -1); }
    touchX = null;
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !pres.hidden) fitPresenter(); });
  window.addEventListener('resize', () => { fitPresenter(); fitStage(); });

  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', () => { if (deck) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && deck) saveNow(); });
}

function onKey(e) {
  const pres = !$('#presenter').hidden;
  if (pres) {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n'].includes(e.key)) { e.preventDefault(); presentGo(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].includes(e.key)) { e.preventDefault(); presentGo(-1); }
    else if (e.key === 'Home') { pIndex = 0; showPresented(); }
    else if (e.key === 'End') { pIndex = deck.slides.length - 1; showPresented(); }
    else if (e.key === 'Escape') endPresentation();
    return;
  }
  if (!deck) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();

  if (editingId) {
    if (e.key === 'Escape') { e.preventDefault(); editBox?.blur(); }
    else if (mod && ['b', 'i', 'u'].includes(k)) {
      e.preventDefault();
      formatSelection({ b: 'bold', i: 'italic', u: 'underline' }[k]);
    }
    return;
  }
  if (e.key === 'F5') { e.preventDefault(); startPresentation(e.shiftKey ? false : true); return; }
  if (mod && k === 's') { e.preventDefault(); saveNow(); toast('Kaydedildi.'); return; }
  if (isTyping(e.target)) return;

  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

  const el = selEl();
  if (mod && k === 'c' && el) { clipboard = clone(el); return; }
  if (mod && k === 'x' && el) { clipboard = clone(el); deleteEl(); return; }
  if (mod && k === 'v' && clipboard) {
    e.preventDefault();
    const c = Object.assign(clone(clipboard), { id: uid() });
    if (curSlide().elements.some((o) => o.x === c.x && o.y === c.y)) { c.x += 20; c.y += 20; }
    clipboard = clone(c);
    curSlide().elements.push(c);
    selId = c.id;
    commit();
    return;
  }
  if (mod && k === 'd') { e.preventDefault(); duplicateEl(); return; }

  if (el) {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteEl(); return; }
    if (e.key === 'Enter' && el.type === 'text') { e.preventDefault(); startEdit(el.id); return; }
    if (e.key === 'Escape') { selId = null; renderStage(); renderProps(); return; }
    if (mod && ['b', 'i', 'u'].includes(k) && textTargets(el).length) {
      e.preventDefault();
      const prop = { b: 'bold', i: 'italic', u: 'underline' }[k];
      applyTextProp(el, prop, !textTargets(el)[0][prop]);
      commit();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key]) {
      e.preventDefault();
      el.x += arrows[e.key][0];
      el.y += arrows[e.key][1];
      commit();
    }
  } else {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); selectSlide(cur + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); selectSlide(cur - 1); }
  }
}

/* ------------------------------------------------------------------ */
/* PWA                                                                 */
/* ------------------------------------------------------------------ */

function setupPwa() {
  let deferred = null;
  const btn = $('#btnInstall');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btn.hidden = true; toast('Present yüklendi!'); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Yeni service worker devraldığında güncel kodla bir kez yeniden yükle
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', async () => {
      if (!hadController || reloading) return;
      reloading = true;
      if (deck) await saveNow();
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch((e) => console.warn('Service worker kaydedilemedi', e));
  }

  // Yüklü uygulamada .present dosyası ile açma
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      for (const h of params.files || []) importFile(await h.getFile());
    });
  }
}

/* ------------------------------------------------------------------ */
/* Başlat                                                              */
/* ------------------------------------------------------------------ */

(async function init() {
  $$('.app-version').forEach((n) => { n.textContent = `v${APP_VERSION}`; });
  await Store.open();
  bindEvents();
  setupPwa();
  await route();
})();
