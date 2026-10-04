/* Present — PowerPoint (.pptx) dosyalarını Present sunumuna dönüştürür */
'use strict';

const PptxImport = (() => {
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const SW = 960;
  const EMU_PER_PT = 12700;

  /* ---------- XML yardımcıları (ad alanından bağımsız, yerel adla) ---------- */
  const kids = (n, name) => (n ? Array.from(n.children).filter((c) => c.localName === name) : []);
  const kid = (n, name) => (n ? Array.from(n.children).find((c) => c.localName === name) || null : null);
  const path = (n, ...names) => names.reduce((acc, nm) => kid(acc, nm), n);
  const num = (v, d = 0) => (v === null || v === undefined || v === '' || Number.isNaN(+v) ? d : +v);
  const attr = (n, a) => (n ? n.getAttribute(a) : null);
  const rId = (n, name) => (n ? n.getAttributeNS(NS_R, name) || n.getAttribute(`r:${name}`) : null);
  const descendants = (n, name) => (n ? Array.from(n.getElementsByTagNameNS('*', name)) : []);

  function dirOf(p) { return p.slice(0, p.lastIndexOf('/') + 1); }
  function resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const out = [];
    for (const s of (dirOf(base) + target).split('/')) {
      if (s === '..') out.pop();
      else if (s !== '.' && s !== '') out.push(s);
    }
    return out.join('/');
  }

  /* ---------- Renkler ---------- */
  const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const hex2 = (n) => clampByte(n).toString(16).padStart(2, '0');
  const PRESET = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', darkGray: 'A9A9A9', lightGray: 'D3D3D3' };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const t2 = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [t2(p, q, h + 1 / 3) * 255, t2(p, q, h) * 255, t2(p, q, h - 1 / 3) * 255];
  }
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const toSrgb = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
  // Renk değiştiricileri sırayla uygular (tint/shade doğrusal RGB'de, diğerleri HSL'de — PowerPoint gibi)
  function applyMods(hex, node) {
    let rgb = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    let alpha = 1;
    const hsl = (fn) => { const [h, s0, l] = rgbToHsl(...rgb); rgb = hslToRgb(...fn(h, s0, l)); };
    const cl = (x) => Math.max(0, Math.min(1, x));
    for (const m of Array.from(node.children)) {
      const v = num(m.getAttribute('val'), 100000) / 100000;
      switch (m.localName) {
        case 'lumMod': hsl((h, s0, l) => [h, s0, cl(l * v)]); break;
        case 'lumOff': hsl((h, s0, l) => [h, s0, cl(l + v)]); break;
        case 'satMod': hsl((h, s0, l) => [h, cl(s0 * v), l]); break;
        case 'satOff': hsl((h, s0, l) => [h, cl(s0 + v), l]); break;
        case 'hueMod': hsl((h, s0, l) => [(h * v) % 1, s0, l]); break;
        case 'hueOff': hsl((h, s0, l) => [(((h + num(m.getAttribute('val')) / 21600000) % 1) + 1) % 1, s0, l]); break;
        case 'tint': rgb = rgb.map((c) => toSrgb(toLin(c) * v + (1 - v))); break;
        case 'shade': rgb = rgb.map((c) => toSrgb(toLin(c) * v)); break;
        case 'comp': hsl((h, s0, l) => [(h + 0.5) % 1, s0, l]); break;
        case 'inv': rgb = rgb.map((c) => 255 - c); break;
        case 'gray': { const g = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11; rgb = [g, g, g]; break; }
        case 'alpha': alpha = v; break;
        case 'alphaMod': alpha *= v; break;
        case 'alphaOff': alpha = cl(alpha + v); break;
        default: break;
      }
    }
    return `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}${alpha < 0.995 ? hex2(alpha * 255) : ''}`;
  }

  /* ---------- Görseller ---------- */
  // PowerPoint ile uyumlu biçime (PNG/JPEG) çevir, gerekirse kırp ve en fazla 1920px'e küçült
  function prepareImage(dataUrl, mime, crop) {
    const hasCrop = crop && (crop.l || crop.t || crop.r || crop.b);
    if (!hasCrop && (mime === 'image/png' || mime === 'image/jpeg') && dataUrl.length < 1.5e6) return Promise.resolve(dataUrl);
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const iw = img.naturalWidth || 300;
        const ih = img.naturalHeight || 150;
        const c0 = hasCrop ? crop : { l: 0, t: 0, r: 0, b: 0 };
        const sx = iw * c0.l;
        const sy = ih * c0.t;
        const sw = Math.max(1, iw * (1 - c0.l - c0.r));
        const sh = Math.max(1, ih * (1 - c0.t - c0.b));
        const k = Math.min(1, 1920 / Math.max(sw, sh));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sw * k));
        c.height = Math.max(1, Math.round(sh * k));
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        res(c.toDataURL(mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9));
      };
      img.onerror = () => res(null);
      img.src = dataUrl;
    });
  }

  /* ---------- Okuyucu ---------- */
  async function convert(input, fileName) {
    if (!window.JSZip) throw new Error('ZIP kütüphanesi yüklenemedi');
    const zip = input instanceof window.JSZip ? input : await window.JSZip.loadAsync(input);
    const xmlCache = new Map();
    let skipped = 0;

    async function xml(p) {
      if (!p) return null;
      if (xmlCache.has(p)) return xmlCache.get(p);
      const f = zip.file(p);
      const doc = f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null;
      xmlCache.set(p, doc);
      return doc;
    }
    async function rels(part) {
      const doc = await xml(`${dirOf(part)}_rels/${part.slice(part.lastIndexOf('/') + 1)}.rels`);
      const map = {};
      if (!doc) return map;
      for (const r of Array.from(doc.documentElement.children)) {
        if (r.getAttribute('TargetMode') === 'External') continue;
        map[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: resolve(part, r.getAttribute('Target') || '') };
      }
      return map;
    }
    const relOfType = (map, suffix) => Object.values(map).find((r) => r.type.endsWith(suffix));

    const presPath = 'ppt/presentation.xml';
    const pres = await xml(presPath);
    if (!pres) throw new Error('Geçerli bir PowerPoint dosyası değil');
    const presRels = await rels(presPath);
    const sz = path(pres.documentElement, 'sldSz');
    const cx = num(attr(sz, 'cx'), 9144000);
    const cy = num(attr(sz, 'cy'), 5143500);
    const scale = SW / cx;
    const SH = Math.round(cy * scale);
    const px = (emu) => emu * scale;
    const presDefaults = path(pres.documentElement, 'defaultTextStyle');

    // Ana (master) slaytlar: tema renkleri, yazı tipleri, renk eşlemesi
    const masterCache = new Map();
    async function loadMaster(p) {
      if (masterCache.has(p)) return masterCache.get(p);
      const doc = (await xml(p)) || new DOMParser().parseFromString('<sldMaster/>', 'application/xml');
      const r = await rels(p);
      const themeRel = relOfType(r, '/theme');
      const theme = themeRel ? await xml(themeRel.target) : null;
      const scheme = {};
      const fonts = { major: 'Calibri', minor: 'Calibri' };
      const styleLists = { fill: [], ln: [], bg: [] };
      let tableStyles = null;
      if (theme) {
        const te = path(theme.documentElement, 'themeElements');
        for (const c of Array.from(path(te, 'clrScheme')?.children || [])) {
          const s = kid(c, 'srgbClr');
          const sys = kid(c, 'sysClr');
          scheme[c.localName] = s ? s.getAttribute('val') : sys ? sys.getAttribute('lastClr') || '000000' : '000000';
        }
        const fs = path(te, 'fontScheme');
        const mj = path(fs, 'majorFont', 'latin');
        const mn = path(fs, 'minorFont', 'latin');
        if (attr(mj, 'typeface')) fonts.major = attr(mj, 'typeface');
        if (attr(mn, 'typeface')) fonts.minor = attr(mn, 'typeface');
        const fmt = path(te, 'fmtScheme');
        styleLists.fill = Array.from(path(fmt, 'fillStyleLst')?.children || []);
        styleLists.ln = kids(path(fmt, 'lnStyleLst'), 'ln');
        styleLists.bg = Array.from(path(fmt, 'bgFillStyleLst')?.children || []);
      }
      const tsRel = relOfType(presRels, '/tableStyles');
      if (tsRel) tableStyles = await xml(tsRel.target);
      const clrMap = {};
      for (const a of Array.from(path(doc.documentElement, 'clrMap')?.attributes || [])) clrMap[a.name] = a.value;
      const m = { path: p, doc, rels: r, scheme, fonts, clrMap, tableStyles, styleLists, txStyles: path(doc.documentElement, 'txStyles') };
      masterCache.set(p, m);
      return m;
    }

    function makeCtx(master) {
      const color = (n, phClr) => {
        if (!n) return null;
        let base = null;
        if (n.localName === 'srgbClr') base = n.getAttribute('val');
        else if (n.localName === 'sysClr') base = n.getAttribute('lastClr') || '000000';
        else if (n.localName === 'prstClr') base = PRESET[n.getAttribute('val')] || '000000';
        else if (n.localName === 'scrgbClr') base = ['r', 'g', 'b'].map((k) => hex2((num(n.getAttribute(k)) / 100000) * 255)).join('');
        else if (n.localName === 'hslClr') {
          const [r, g, b] = hslToRgb(num(n.getAttribute('hue')) / 21600000, num(n.getAttribute('sat')) / 100000, num(n.getAttribute('lum')) / 100000);
          base = hex2(r) + hex2(g) + hex2(b);
        } else if (n.localName === 'schemeClr') {
          let v = n.getAttribute('val');
          if (v === 'phClr') {
            if (!phClr) return null;
            return applyMods(phClr.slice(1, 7).toUpperCase(), n);
          }
          v = master.clrMap[v] || { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }[v] || v;
          base = master.scheme[v] || '000000';
        }
        return base ? applyMods(base.toUpperCase(), n) : null;
      };
      const scheme = (val) => color(new DOMParser().parseFromString(`<schemeClr val="${val}"/>`, 'application/xml').documentElement);
      // Dolgu öğesi: undefined = belirtilmemiş, null = dolgu yok, { color, grad?, blip? }
      const fillNode = (n, phClr) => {
        if (!n) return undefined;
        switch (n.localName) {
          case 'noFill': return null;
          case 'solidFill': { const c = color(n.firstElementChild, phClr); return c ? { color: c } : undefined; }
          case 'gradFill': {
            const stops = kids(path(n, 'gsLst'), 'gs')
              .map((gs) => [num(gs.getAttribute('pos')) / 100000, color(gs.firstElementChild, phClr)])
              .filter((st) => st[1])
              .sort((p, q) => p[0] - q[0]);
            if (!stops.length) return undefined;
            const pth = kid(n, 'path');
            if (pth) {
              const ftr = kid(pth, 'fillToRect');
              const cx0 = ftr ? (num(attr(ftr, 'l')) + (100000 - num(attr(ftr, 'r')))) / 2000 : 50;
              const cy0 = ftr ? (num(attr(ftr, 't')) + (100000 - num(attr(ftr, 'b')))) / 2000 : 50;
              return { color: stops[0][1], grad: { type: 'radial', cx: +cx0.toFixed(1), cy: +cy0.toFixed(1), stops } };
            }
            const lin = kid(n, 'lin');
            return { color: stops[0][1], grad: { angle: lin ? num(lin.getAttribute('ang')) / 60000 : 90, stops } };
          }
          case 'pattFill': { const c = color(path(n, 'fgClr')?.firstElementChild, phClr); return c ? { color: c } : undefined; }
          case 'blipFill': return { color: null, blip: n };
          default: return undefined;
        }
      };
      const FILL_TAGS = new Set(['noFill', 'solidFill', 'gradFill', 'pattFill', 'blipFill', 'grpFill']);
      const fillOf = (parent, phClr) => {
        if (!parent) return undefined;
        const n = Array.from(parent.children).find((c) => FILL_TAGS.has(c.localName));
        return n ? fillNode(n, phClr) : undefined;
      };
      // Tema stil başvuruları (p:style içindeki fillRef / lnRef / bgRef)
      const styleFill = (ref) => {
        if (!ref) return undefined;
        const idx = num(attr(ref, 'idx'));
        const ph = color(ref.firstElementChild);
        if (!idx) return null;
        const node = idx >= 1001 ? master.styleLists.bg[idx - 1001] : master.styleLists.fill[idx - 1];
        const f = node ? fillNode(node, ph) : undefined;
        if (f && f.blip) return ph ? { color: ph } : undefined;
        return f !== undefined ? f : ph ? { color: ph } : undefined;
      };
      const styleLine = (ref) => {
        if (!ref) return undefined;
        const idx = num(attr(ref, 'idx'));
        if (!idx) return null;
        const ph = color(ref.firstElementChild);
        const node = master.styleLists.ln[idx - 1];
        const f = node ? fillOf(node, ph) : undefined;
        return { color: f ? f.color : f === null ? null : ph, width: num(attr(node, 'w'), 9525) };
      };
      const fill = (parent, phClr) => { const f = fillOf(parent, phClr); return f === undefined ? undefined : f === null ? null : f.color; };
      const font = (tf) => (tf === '+mj-lt' ? master.fonts.major : tf === '+mn-lt' || !tf ? master.fonts.minor : tf);
      return { master, color, scheme, fill, fillOf, fillNode, styleFill, styleLine, font };
    }

    /* ---------- Yer tutucu kalıtımı ---------- */
    const phInfo = (sp) => {
      const ph = path(sp.firstElementChild, 'nvPr', 'ph');
      if (!ph) return null;
      return { type: ph.getAttribute('type') || 'obj', idx: ph.getAttribute('idx') };
    };
    const phKind = (t) => (t === 'title' || t === 'ctrTitle' ? 'title' : ['dt', 'ftr', 'sldNum'].includes(t) ? t : 'body');
    function findPh(tree, info, byKindOnly) {
      if (!tree || !info) return null;
      const all = descendants(tree, 'sp');
      if (!byKindOnly && info.idx !== null) {
        const hit = all.find((s) => phInfo(s)?.idx === info.idx);
        if (hit) return hit;
      }
      const exact = all.find((s) => phInfo(s)?.type === info.type);
      if (exact) return exact;
      return all.find((s) => { const i = phInfo(s); return i && phKind(i.type) === phKind(info.type); }) || null;
    }

    const imageCache = new Map();
    async function imageData(target, crop) {
      const key = `${target}|${crop ? JSON.stringify(crop) : ''}`;
      if (imageCache.has(key)) return imageCache.get(key);
      const f = zip.file(target);
      const ext = target.split('.').pop().toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' }[ext];
      let out = null;
      if (f && mime) out = await prepareImage(`data:${mime};base64,${await f.async('base64')}`, mime, crop);
      imageCache.set(key, out);
      return out;
    }

    /* ---------- Metin ---------- */
    const BULLET_FONTS = /wingdings|symbol|webdings/i;
    // Wingdings/Symbol madde karakterlerinin Unicode karşılıkları
    const WINGDINGS = {
      l: '●', m: '○', n: '■', o: '□', p: '◻', q: '❑', r: '❒', s: '⬧', t: '⧫', u: '◆', v: '❖', w: '⬥', x: '⌧',
      'Ø': '➢', '§': '▪', 'ü': '✓', 'û': '✗', 'à': '➔', 'è': '➜', 'ð': '⇨', 'Ÿ': '•', '¨': '◻', 'ª': '✦', '«': '★',
    };
    const symbolBullet = (ch) => {
      let c = ch;
      const code = ch.codePointAt(0);
      if (code >= 0xF000 && code <= 0xF0FF) c = String.fromCharCode(code - 0xF000);
      return WINGDINGS[c] || '•';
    };

    /**
     * Metin gövdesini paragraflara/parçalara çevirir.
     * opts: { chain (kalıtım sırasındaki şekiller), masterStyle, fontRefColor, defaultColor, slideNum, fontScale, lnRed, kind, override (tablo stili) }
     */
    function parseText(txBody, ctx, opts) {
      const { chain = [], masterStyle, fontRefColor, slideNum = 1, fontScale = 1, lnRed = 0, kind = 'other', override = {} } = opts;
      const lvlNodes = (lvl) => {
        const name = `lvl${lvl + 1}pPr`;
        const local = [path(txBody, 'lstStyle', name), ...chain.map((s) => path(s, 'txBody', 'lstStyle', name))].filter(Boolean);
        // Slayttaki serbest metin kutuları sunumun varsayılan stilini, yer tutucular ana slayt stilini kullanır
        const global = (kind === 'other' ? [path(presDefaults, name), path(masterStyle, name)] : [path(masterStyle, name), path(presDefaults, name)]).filter(Boolean);
        return { local, global };
      };
      const paras = [];
      let first = null;
      for (const p of kids(txBody, 'p')) {
        const pPr = kid(p, 'pPr');
        const lvl = Math.min(8, num(attr(pPr, 'lvl'), 0));
        const { local, global } = lvlNodes(lvl);
        const pChain = [pPr, ...local, ...global].filter(Boolean);
        const pAttr = (a) => { for (const n of pChain) { const v = n.getAttribute(a); if (v !== null && v !== '') return v; } return null; };
        const pKid = (k) => { for (const n of pChain) { const v = kid(n, k); if (v) return v; } return null; };

        // Biçim çözümleme: yerel → şekil stili → ana slayt/ sunum varsayılanı
        const localR = (rPr) => [rPr, kid(pPr, 'defRPr'), ...local.map((n) => kid(n, 'defRPr'))].filter(Boolean);
        const globalR = global.map((n) => kid(n, 'defRPr')).filter(Boolean);
        const resolveRun = (rPr) => {
          const l = localR(rPr);
          const all = [...l, ...globalR];
          const ra = (a) => { for (const n of all) { const v = n.getAttribute(a); if (v !== null && v !== '') return v; } return null; };
          let color = null;
          for (const n of l) { const c = ctx.fill(n); if (c) { color = c; break; } }
          if (!color && override.color) color = override.color;
          if (!color && fontRefColor) color = fontRefColor;
          if (!color) for (const n of globalR) { const c = ctx.fill(n); if (c) { color = c; break; } }
          if (!color) color = ctx.scheme('tx1');
          let face = null;
          for (const n of all) { const lt = kid(n, 'latin'); if (lt && lt.getAttribute('typeface')) { face = lt.getAttribute('typeface'); break; } }
          if (!face) face = kind === 'title' ? '+mj-lt' : '+mn-lt';
          const szv = num(ra('sz'), kind === 'title' ? 4400 : 1800) / 100;
          const b = ra('b');
          return {
            font: ctx.font(face),
            size: Math.max(4, +(szv * EMU_PER_PT * scale * fontScale).toFixed(1)),
            color,
            bold: override.bold !== undefined && b === null ? override.bold : b === '1' || b === 'true',
            italic: ra('i') === '1' || ra('i') === 'true',
            underline: !!ra('u') && ra('u') !== 'none',
            strike: !!ra('strike') && ra('strike') !== 'noStrike',
            caps: ra('cap') === 'all',
          };
        };

        // Madde işareti
        let bullet = null;
        let buChar = null;
        for (const n of pChain) {
          if (kid(n, 'buNone')) { bullet = null; break; }
          if (kid(n, 'buChar')) {
            bullet = 'char';
            const ch = attr(kid(n, 'buChar'), 'char') || '•';
            const bf = attr(pKid('buFont'), 'typeface') || '';
            buChar = BULLET_FONTS.test(bf) || /[\uF000-\uF8FF]/.test(ch) ? symbolBullet(ch) : ch;
            break;
          }
          if (kid(n, 'buAutoNum') || kid(n, 'buBlip')) { bullet = kid(n, 'buAutoNum') ? 'num' : 'char'; buChar = '•'; break; }
        }

        // Parçalar
        const runs = [];
        for (const c of Array.from(p.children)) {
          if (c.localName === 'r' || c.localName === 'fld') {
            let t = kid(c, 't')?.textContent || '';
            if (c.localName === 'fld' && /slidenum/i.test(attr(c, 'type') || '')) t = String(slideNum);
            if (!t) continue;
            runs.push({ text: t, ...resolveRun(kid(c, 'rPr')) });
          } else if (c.localName === 'br') {
            if (runs.length) runs[runs.length - 1].text += '\n';
            else runs.push({ text: '\n', ...resolveRun(kid(c, 'rPr')) });
          }
        }
        const endProps = resolveRun(kid(p, 'endParaRPr'));
        if (!first && runs.some((r) => r.text.trim())) first = runs.find((r) => r.text.trim());

        const spacing = (k, fontPx) => {
          const n = pKid(k);
          if (!n) return undefined;
          const pct = kid(n, 'spcPct');
          const pts = kid(n, 'spcPts');
          if (pct) return { pct: num(attr(pct, 'val')) / 100000 };
          if (pts) return { px: (num(attr(pts, 'val')) / 100) * EMU_PER_PT * scale, fontPx };
          return undefined;
        };
        const fontPx = (runs[0] || endProps).size;
        const para = { runs, align: { l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[pAttr('algn')] || 'left' };
        if (lvl) para.lvl = lvl;
        if (bullet && runs.some((r) => r.text.trim())) { para.bullet = bullet; if (bullet === 'char') para.buChar = buChar; }
        const marL = pAttr('marL');
        const ind = pAttr('indent');
        if (marL !== null) para.marL = +px(num(marL)).toFixed(1);
        if (ind !== null) para.indent = +px(num(ind)).toFixed(1);
        const ls = spacing('lnSpc', fontPx);
        if (ls) para.lineHeight = +((ls.pct !== undefined ? ls.pct * 1.2 : ls.px / fontPx) * (1 - lnRed)).toFixed(3);
        else if (lnRed) para.lineHeight = +(1.2 * (1 - lnRed)).toFixed(3);
        const sb = spacing('spcBef', fontPx);
        if (sb) para.spaceBefore = +(sb.pct !== undefined ? sb.pct * fontPx : sb.px).toFixed(1);
        const sa = spacing('spcAft', fontPx);
        if (sa) para.spaceAfter = +(sa.pct !== undefined ? sa.pct * fontPx : sa.px).toFixed(1);
        if (!runs.length) para.size = endProps.size;
        paras.push(para);
      }
      while (paras.length > 1 && !paras[paras.length - 1].runs.length) paras.pop();
      if (!first) return null;

      // Öğe varsayılanları = ilk dolu parçanın biçimi; parçalarda yalnızca farklar kalır
      const defaults = { font: first.font, fontSize: first.size, color: first.color, bold: first.bold, italic: first.italic, underline: first.underline };
      const align = paras.find((p) => p.runs.some((r) => r.text.trim()))?.align || 'left';
      for (const p of paras) {
        if (p.align === align) delete p.align;
        if (p.size === defaults.fontSize) delete p.size;
        p.runs = p.runs.map((r) => {
          const o = { text: r.text };
          if (r.font !== defaults.font) o.font = r.font;
          if (r.size !== defaults.fontSize) o.size = r.size;
          if (r.color.toLowerCase() !== defaults.color.toLowerCase()) o.color = r.color;
          for (const k of ['bold', 'italic', 'underline']) if (r[k] !== defaults[k]) o[k] = r[k];
          if (r.strike) o.strike = true;
          if (r.caps) o.caps = true;
          return o;
        });
        // Aynı biçimli komşu parçaları birleştir
        const merged = [];
        for (const r of p.runs) {
          const last = merged[merged.length - 1];
          const same = last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...r, text: '' });
          if (same) last.text += r.text; else merged.push(r);
        }
        p.runs = merged;
      }
      const text = paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
      return { paras, text, ...defaults, align };
    }

    const insetOf = (bodyPr) => {
      const v = (a, d) => +px(num(attr(bodyPr, a), d)).toFixed(1);
      return [v('lIns', 91440), v('tIns', 45720), v('rIns', 91440), v('bIns', 45720)];
    };

    /* ---------- Slayt dönüştürme ---------- */
    async function convertSlide(slidePath, slideNum) {
      const sDoc = await xml(slidePath);
      const sRels = await rels(slidePath);
      const layoutRel = relOfType(sRels, '/slideLayout');
      const layoutPath = layoutRel ? layoutRel.target : null;
      const lDoc = layoutPath ? await xml(layoutPath) : null;
      const lRels = layoutPath ? await rels(layoutPath) : {};
      const masterRel = relOfType(lRels, '/slideMaster');
      const master = await loadMaster(masterRel ? masterRel.target : 'ppt/slideMasters/slideMaster1.xml');
      const ctx = makeCtx(master);
      const sTree = path(sDoc.documentElement, 'cSld', 'spTree');
      const lTree = lDoc ? path(lDoc.documentElement, 'cSld', 'spTree') : null;
      const mTree = path(master.doc.documentElement, 'cSld', 'spTree');
      const elements = [];

      // Arka plan: slayt → düzen → ana slayt
      let bg = '#FFFFFF';
      let bgGrad = null;
      let bgImg = null;
      for (const [doc, r] of [[sDoc, sRels], [lDoc, lRels], [master.doc, master.rels]]) {
        const bgEl = doc ? path(doc.documentElement, 'cSld', 'bg') : null;
        if (!bgEl) continue;
        const bgPr = kid(bgEl, 'bgPr');
        const f = bgPr ? ctx.fillOf(bgPr) : ctx.styleFill(kid(bgEl, 'bgRef'));
        if (!f) continue;
        if (f.blip) {
          const blip = kid(f.blip, 'blip');
          const rel = blip && r[rId(blip, 'embed')];
          const src = rel ? await imageData(rel.target) : null;
          if (src) bgImg = { src, tile: !!kid(f.blip, 'tile') };
          break;
        }
        bg = f.color.slice(0, 7);
        bgGrad = f.grad || null;
        break;
      }

      const showMaster = (doc) => !doc || doc.documentElement.getAttribute('showMasterSp') !== '0';
      const ident = (x, y, w, h) => ({ x, y, w, h });

      // Dönüşüm: grup içi koordinatları slayt koordinatlarına çevirir
      const boxOf = (xfrm, map) => {
        const off = kid(xfrm, 'off');
        const ext = kid(xfrm, 'ext');
        const b = map(num(attr(off, 'x')), num(attr(off, 'y')), num(attr(ext, 'cx')), num(attr(ext, 'cy')));
        const o = { x: +px(b.x).toFixed(1), y: +px(b.y).toFixed(1), w: +px(b.w).toFixed(1), h: +px(b.h).toFixed(1) };
        const rot = num(attr(xfrm, 'rot')) / 60000;
        if (rot) o.rot = +rot.toFixed(2);
        if (attr(xfrm, 'flipH') === '1') o.flipH = true;
        if (attr(xfrm, 'flipV') === '1') o.flipV = true;
        return o;
      };

      async function walk(tree, map, owner, ownerRels, onlyStatic) {
        for (const node of Array.from(tree.children)) {
          const n = node.localName;
          try {
            if (n === 'sp' || n === 'cxnSp') await addShape(node, map, owner, ownerRels, onlyStatic);
            else if (n === 'pic') await addPic(node, map, ownerRels, onlyStatic);
            else if (n === 'grpSp') {
              const xf = path(node, 'grpSpPr', 'xfrm');
              if (!xf) { await walk(node, map, owner, ownerRels, onlyStatic); continue; }
              const off = kid(xf, 'off');
              const ext = kid(xf, 'ext');
              const cOff = kid(xf, 'chOff');
              const cExt = kid(xf, 'chExt');
              const gx = num(attr(off, 'x'));
              const gy = num(attr(off, 'y'));
              const sx = num(attr(ext, 'cx'), 1) / (num(attr(cExt, 'cx'), 1) || 1);
              const sy = num(attr(ext, 'cy'), 1) / (num(attr(cExt, 'cy'), 1) || 1);
              const ox = num(attr(cOff, 'x'));
              const oy = num(attr(cOff, 'y'));
              await walk(node, (x, y, w, h) => map(gx + (x - ox) * sx, gy + (y - oy) * sy, w * sx, h * sy), owner, ownerRels, onlyStatic);
            } else if (n === 'graphicFrame') {
              if (!onlyStatic) await addFrame(node, map, ownerRels);
            } else if (n === 'AlternateContent') {
              const choice = kid(node, 'Fallback') || kid(node, 'Choice');
              if (choice) await walk(choice, map, owner, ownerRels, onlyStatic);
            }
          } catch (e) {
            console.warn('Öğe dönüştürülemedi', n, e);
            skipped += 1;
          }
        }
      }

      async function addPic(node, map, ownerRels, onlyStatic) {
        const info = phInfo(node);
        if (onlyStatic && info) return;
        let xfrm = path(node, 'spPr', 'xfrm');
        if (!xfrm && info) xfrm = path(findPh(lTree, info), 'spPr', 'xfrm') || path(findPh(mTree, info, true), 'spPr', 'xfrm');
        const blipFill = kid(node, 'blipFill');
        const blip = kid(blipFill, 'blip');
        const rel = blip && ownerRels[rId(blip, 'embed')];
        if (!xfrm || !rel) { skipped += 1; return; }
        const sr = kid(blipFill, 'srcRect');
        const crop = sr ? { l: num(attr(sr, 'l')) / 1e5, t: num(attr(sr, 't')) / 1e5, r: num(attr(sr, 'r')) / 1e5, b: num(attr(sr, 'b')) / 1e5 } : null;
        const src = await imageData(rel.target, crop);
        if (!src) { skipped += 1; return; }
        const el = { type: 'image', src, ...boxOf(xfrm, map) };
        const geom = attr(path(node, 'spPr', 'prstGeom'), 'prst');
        if (geom === 'ellipse') el.round = 'ellipse';
        else if (geom === 'roundRect') el.radius = Math.round(Math.min(el.w, el.h) * 0.16667);
        const ln = path(node, 'spPr', 'ln');
        const stroke = ln ? ctx.fill(ln) : null;
        if (stroke) { el.stroke = stroke; el.strokeWidth = Math.max(1, Math.round(px(num(attr(ln, 'w'), 12700)))); }
        elements.push(el);
      }

      async function addFrame(node, map, ownerRels) {
        const xfrm = kid(node, 'xfrm');
        const gd = path(node, 'graphic', 'graphicData');
        const uri = attr(gd, 'uri') || '';
        if (!xfrm || !gd) { skipped += 1; return; }
        const box = boxOf(xfrm, map);
        if (uri.endsWith('/table')) return addTable(kid(gd, 'tbl'), box);
        if (uri.endsWith('/diagram')) {
          // SmartArt: PowerPoint'in kaydettiği çizim (dsp) şekillerini kullan
          const relIds = kid(gd, 'relIds');
          const dm = relIds && ownerRels[rId(relIds, 'dm')];
          let drawing = null;
          if (dm) {
            const dDoc = await xml(dm.target);
            const ext = dDoc ? descendants(dDoc, 'dataModelExt')[0] : null;
            const relId = attr(ext, 'relId');
            if (relId && ownerRels[relId]) drawing = ownerRels[relId].target;
          }
          if (!drawing) drawing = relOfType(ownerRels, '/diagramDrawing')?.target;
          const dDoc = drawing ? await xml(drawing) : null;
          const tree = dDoc ? descendants(dDoc, 'spTree')[0] : null;
          if (!tree) { skipped += 1; return; }
          const off = kid(xfrm, 'off');
          const fx = num(attr(off, 'x'));
          const fy = num(attr(off, 'y'));
          const dRels = await rels(drawing);
          await walk(tree, (x, y, w, h) => map(fx + x, fy + y, w, h), 'diagram', dRels, false);
          return;
        }
        // Grafik vb.: yer tutucu
        skipped += 1;
        elements.push({ type: 'rect', ...box, fill: '#F1F3F7', stroke: '#C5CAD6', strokeWidth: 1, radius: 0 });
        elements.push({
          type: 'text', ...box, text: uri.endsWith('/chart') ? 'Grafik (Present\'te gösterilemiyor)' : 'Desteklenmeyen öğe',
          font: ctx.font(null), fontSize: 16, color: '#6B7183', bold: false, italic: false, underline: false, align: 'center', valign: 'middle', fill: null,
        });
      }

      function addTable(tbl, box) {
        if (!tbl) { skipped += 1; return; }
        const tblPr = kid(tbl, 'tblPr');
        const flag = (a) => attr(tblPr, a) === '1';
        const cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => +px(num(attr(g, 'w'))).toFixed(1));
        const trs = kids(tbl, 'tr');
        const nrows = trs.length;
        const ncols = cols.length;

        // Tablo stili: tableStyles.xml içindeki tanım
        const styleId = path(tblPr, 'tableStyleId')?.textContent?.trim();
        const st = styleId && master.tableStyles ? descendants(master.tableStyles, 'tblStyle').find((x) => attr(x, 'styleId') === styleId) : null;
        const partFill = (part) => {
          const tcs = kid(part, 'tcStyle');
          if (!tcs) return undefined;
          const fEl = kid(tcs, 'fill');
          if (fEl) return ctx.fillOf(fEl);
          const fr = kid(tcs, 'fillRef');
          return fr ? ctx.styleFill(fr) : undefined;
        };
        const partText = (part) => {
          const tx = kid(part, 'tcTxStyle');
          if (!tx) return {};
          const o = {};
          if (attr(tx, 'b') === 'on') o.bold = true;
          if (attr(tx, 'b') === 'off') o.bold = false;
          const c = Array.from(tx.children).find((n) => /Clr$/.test(n.localName));
          if (c) o.color = ctx.color(c);
          else if (kid(tx, 'fontRef')) o.color = ctx.color(kid(tx, 'fontRef').firstElementChild);
          return o;
        };
        const partBorder = (part, side) => {
          const b0 = path(part, 'tcStyle', 'tcBdr', side);
          if (!b0) return undefined;
          const ln = kid(b0, 'ln');
          if (ln) return ctx.fill(ln);
          const lr = kid(b0, 'lnRef');
          return lr ? ctx.styleLine(lr)?.color : undefined;
        };
        // Tanım yoksa PowerPoint'in varsayılanına (Orta Stil 2 – Vurgu 1) yakın görünüm
        let fallbackAccent = null;
        if (!st && styleId) fallbackAccent = ctx.scheme('accent1');
        const mix = (c, t) => {
          const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
          return `#${v.map((x) => hex2(x + (255 - x) * t)).join('')}`;
        };
        const partsFor = (ri, ci) => {
          const parts = ['wholeTbl'];
          const bodyRow = ri - (flag('firstRow') ? 1 : 0);
          if (flag('bandRow') && bodyRow >= 0) parts.push(bodyRow % 2 === 0 ? 'band1H' : 'band2H');
          const bodyCol = ci - (flag('firstCol') ? 1 : 0);
          if (flag('bandCol') && bodyCol >= 0) parts.push(bodyCol % 2 === 0 ? 'band1V' : 'band2V');
          if (flag('firstCol') && ci === 0) parts.push('firstCol');
          if (flag('lastCol') && ci === ncols - 1) parts.push('lastCol');
          if (flag('lastRow') && ri === nrows - 1) parts.push('lastRow');
          if (flag('firstRow') && ri === 0) parts.push('firstRow');
          return parts.map((n) => kid(st, n)).filter(Boolean);
        };
        let border = null;
        let explicitBorder = null;
        if (st) {
          const whole = kid(st, 'wholeTbl');
          border = partBorder(whole, 'insideH') || partBorder(whole, 'top') || partBorder(whole, 'left') || null;
        } else if (fallbackAccent) border = '#FFFFFF';

        const rows = trs.map((tr, ri) => ({
          h: +px(num(attr(tr, 'h'))).toFixed(1),
          cells: kids(tr, 'tc').map((tc, ci) => {
            const tcPr = kid(tc, 'tcPr');
            if (attr(tc, 'hMerge') === '1') return { hidden: 'h' };
            if (attr(tc, 'vMerge') === '1') return { hidden: 'v' };
            let fill;
            const override = {};
            if (st) {
              for (const part of partsFor(ri, ci)) {
                const f = partFill(part);
                if (f !== undefined) fill = f ? f.color : null;
                Object.assign(override, partText(part));
              }
            } else if (fallbackAccent) {
              const header = flag('firstRow') && ri === 0;
              const band = flag('bandRow') && (ri - (flag('firstRow') ? 1 : 0)) % 2 === 0;
              fill = header ? fallbackAccent : mix(fallbackAccent, band ? 0.6 : 0.8);
              if (header) Object.assign(override, { color: ctx.scheme('lt1'), bold: true });
            }
            const own = ctx.fillOf(tcPr);
            if (own !== undefined) fill = own ? own.color : null;
            const t = parseText(kid(tc, 'txBody'), ctx, { masterStyle: path(master.txStyles, 'otherStyle'), slideNum, override });
            const cell = t ? { ...t } : {
              text: '', font: ctx.font(null), fontSize: +(18 * EMU_PER_PT * scale).toFixed(1), color: override.color || ctx.scheme('tx1'),
              bold: !!override.bold, italic: false, underline: false, align: 'left',
            };
            cell.fill = fill || null;
            cell.valign = { ctr: 'middle', b: 'bottom' }[attr(tcPr, 'anchor')] || 'top';
            const ins = (a, d) => +px(num(attr(tcPr, a), d)).toFixed(1);
            cell.inset = [ins('marL', 91440), ins('marT', 45720), ins('marR', 91440), ins('marB', 45720)];
            const gs = num(attr(tc, 'gridSpan'), 1);
            const rs = num(attr(tc, 'rowSpan'), 1);
            if (gs > 1) cell.colspan = gs;
            if (rs > 1) cell.rowspan = rs;
            // Hücrenin kendi kenarlığı tablo stilinden önce gelir
            if (!explicitBorder) {
              for (const side of ['lnB', 'lnT', 'lnL', 'lnR']) {
                const lb = kid(tcPr, side);
                const c = lb ? ctx.fill(lb) : null;
                if (c) { explicitBorder = { color: c, width: num(attr(lb, 'w'), 12700) }; break; }
              }
            }
            return cell;
          }),
        }));
        if (explicitBorder) border = explicitBorder.color;
        const borderWidth = explicitBorder ? Math.max(0.5, +px(explicitBorder.width).toFixed(1)) : 1;
        elements.push({ type: 'table', ...box, cols, rows, border: border ? border.slice(0, 7) : null, borderWidth });
      }

      async function addShape(node, map, owner, ownerRels, onlyStatic) {
        const info = phInfo(node);
        if (onlyStatic && info) return; // düzen/ana slayttaki yer tutucular yalnızca şablondur
        if (info && ['dt', 'ftr', 'sldNum'].includes(info.type) && owner !== 'slide') return;

        // Kalıtım zinciri: slayt şekli → düzen yer tutucusu → ana slayt yer tutucusu
        const chain = [node];
        if (info) {
          const l = owner === 'slide' ? findPh(lTree, info) : null;
          if (l) chain.push(l);
          const m = findPh(mTree, info, true);
          if (m && m !== node) chain.push(m);
        }
        const first = (fn) => { for (const s of chain) { const v = fn(s); if (v !== undefined && v !== null) return v; } return undefined; };
        const xfrm = first((s) => path(s, 'spPr', 'xfrm'));
        if (!xfrm) { skipped += 1; return; }
        const b = boxOf(xfrm, map);
        const spPr = kid(node, 'spPr');
        const style = kid(node, 'style');
        const prst = path(spPr, 'prstGeom');
        const geom = attr(prst, 'prst') || (kid(spPr, 'custGeom') ? 'custGeom' : 'rect');
        const adj = {};
        for (const gd of kids(path(prst, 'avLst'), 'gd')) {
          const m = /val\s+(-?\d+)/.exec(attr(gd, 'fmla') || '');
          if (m) adj[attr(gd, 'name')] = +m[1];
        }

        // Dolgu ve çizgi (şeklin kendi ayarı → tema stili → yer tutucu kalıtımı)
        let fillInfo = ctx.fillOf(spPr);
        if (fillInfo === undefined && style) fillInfo = ctx.styleFill(kid(style, 'fillRef'));
        if (fillInfo === undefined && info) fillInfo = first((s2) => (s2 === node ? undefined : ctx.fillOf(kid(s2, 'spPr')))) ?? null;
        let imgFill = null;
        if (fillInfo && fillInfo.blip) {
          const blip = kid(fillInfo.blip, 'blip');
          const rel = blip && ownerRels[rId(blip, 'embed')];
          const src = rel ? await imageData(rel.target) : null;
          if (src) imgFill = { src, tile: !!kid(fillInfo.blip, 'tile') };
          fillInfo = null;
        }
        const fill = fillInfo ? fillInfo.color : null;
        const ln = path(spPr, 'ln');
        const sLine = style ? ctx.styleLine(kid(style, 'lnRef')) : undefined;
        let stroke = ln ? ctx.fill(ln) : undefined;
        if (stroke === undefined && sLine) stroke = sLine.color;
        if (stroke === undefined && info) stroke = first((s2) => (s2 === node ? undefined : ctx.fill(path(s2, 'spPr', 'ln'))));
        stroke = stroke || null;
        const lnW = attr(ln, 'w') !== null ? num(attr(ln, 'w')) : sLine ? sLine.width : 12700;
        const strokeWidth = stroke ? Math.max(0.5, +px(lnW).toFixed(1)) : 0;
        const dash = attr(path(ln, 'prstDash'), 'val');

        const isLine = node.localName === 'cxnSp' || Shapes.isOpen(geom) || /Connector/.test(geom);
        if (isLine) {
          if (!stroke) return;
          const el = { type: 'shape', geom: Shapes.preset(geom, 10, 10, adj) ? geom : 'line', adj, ...b, fill: null, stroke, strokeWidth };
          if (dash && dash !== 'solid') el.dash = dash;
          const head = attr(path(ln, 'headEnd'), 'type');
          const tail = attr(path(ln, 'tailEnd'), 'type');
          if (head && head !== 'none') el.headEnd = head;
          if (tail && tail !== 'none') el.tailEnd = tail;
          elements.push(el);
          return;
        }

        if (fill || stroke || imgFill) {
          let el;
          if (!imgFill && (geom === 'rect' || geom === 'roundRect' || geom === 'ellipse')) {
            el = { type: geom === 'ellipse' ? 'ellipse' : 'rect', ...b, fill, stroke, strokeWidth, radius: 0 };
            if (geom === 'roundRect') el.radius = Math.round(Math.min(b.w, b.h) * ((adj.adj !== undefined ? adj.adj : 16667) / 100000));
          } else {
            el = { type: 'shape', geom, adj, ...b, fill, stroke, strokeWidth };
            if (geom === 'custGeom') el.paths = customPaths(kid(spPr, 'custGeom'));
          }
          if (fillInfo && fillInfo.grad) el.grad = fillInfo.grad;
          if (imgFill) el.imgFill = imgFill;
          if (dash && dash !== 'solid') el.dash = dash;
          elements.push(el);
        }

        // Metin
        const txBody = kid(node, 'txBody');
        if (!txBody || !descendants(txBody, 't').some((t) => t.textContent.trim())) return;
        const kind = info ? phKind(info.type) : 'other';
        const masterStyle = path(master.txStyles, kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle');
        const bodyPrs = chain.map((s) => path(s, 'txBody', 'bodyPr')).filter(Boolean);
        const bpAttr = (a) => { for (const n of bodyPrs) { const v = n.getAttribute(a); if (v !== null && v !== '') return v; } return null; };
        const auto = path(bodyPrs[0], 'normAutofit');
        const fontRef = style ? kid(style, 'fontRef') : null;
        const t = parseText(txBody, ctx, {
          chain: chain.slice(1),
          masterStyle,
          kind,
          slideNum,
          fontRefColor: fontRef ? ctx.color(fontRef.firstElementChild) : null,
          fontScale: num(attr(auto, 'fontScale'), 100000) / 100000,
          lnRed: num(attr(auto, 'lnSpcReduction'), 0) / 100000,
        });
        if (!t) return;
        // SmartArt çiziminde metin kutusu ayrı konumda olabilir
        const txX = kid(node, 'txXfrm');
        const tb = txX ? boxOf(txX, map) : b;
        const vert = bpAttr('vert');
        const el = {
          type: 'text', ...tb, ...t,
          valign: { ctr: 'middle', b: 'bottom' }[bpAttr('anchor')] || 'top',
          fill: null,
          inset: insetOf(bodyPrs.find((n) => n.hasAttribute('lIns') || n.hasAttribute('tIns')) || null),
        };
        if (txX && b.rot && !tb.rot) el.rot = b.rot;
        if (bpAttr('wrap') === 'none') el.wrap = false;
        if (vert && vert !== 'horz') el.vert = vert;
        delete el.flipH;
        delete el.flipV;
        elements.push(el);
      }

      function customPaths(cg) {
        const out = [];
        for (const p of kids(path(cg, 'pathLst'), 'path')) {
          const pw = num(attr(p, 'w'), 0) || 1;
          const ph = num(attr(p, 'h'), 0) || 1;
          const pt = (n) => [num(attr(n, 'x')) / pw, num(attr(n, 'y')) / ph];
          const cmds = [];
          let cur = [0, 0];
          let start = [0, 0];
          for (const c of Array.from(p.children)) {
            const pts = kids(c, 'pt').map(pt);
            if (c.localName === 'moveTo' && pts[0]) { cmds.push(['M', ...pts[0]]); cur = pts[0]; start = pts[0]; }
            else if (c.localName === 'lnTo' && pts[0]) { cmds.push(['L', ...pts[0]]); cur = pts[0]; }
            else if (c.localName === 'cubicBezTo' && pts.length === 3) { cmds.push(['C', ...pts[0], ...pts[1], ...pts[2]]); cur = pts[2]; }
            else if (c.localName === 'quadBezTo' && pts.length === 2) { cmds.push(['Q', ...pts[0], ...pts[1]]); cur = pts[1]; }
            else if (c.localName === 'arcTo') {
              const segs = Shapes.arcToCubics(cur[0] * pw, cur[1] * ph, num(attr(c, 'wR')), num(attr(c, 'hR')), num(attr(c, 'stAng')) / 60000, num(attr(c, 'swAng')) / 60000);
              for (const s of segs) {
                const n = ['C', s[1] / pw, s[2] / ph, s[3] / pw, s[4] / ph, s[5] / pw, s[6] / ph];
                cmds.push(n);
                cur = [n[5], n[6]];
              }
            } else if (c.localName === 'close') { cmds.push(['Z']); cur = start; }
          }
          if (cmds.length) {
            out.push({
              cmds: cmds.map((c) => c.map((v) => (typeof v === 'number' ? +v.toFixed(4) : v))),
              fill: attr(p, 'fill') !== 'none',
              stroke: attr(p, 'stroke') !== '0',
            });
          }
        }
        return out;
      }

      if (showMaster(sDoc) && showMaster(lDoc)) await walk(mTree, ident, 'master', master.rels, true);
      if (lTree && showMaster(sDoc)) await walk(lTree, ident, 'layout', lRels, true);
      await walk(sTree, ident, 'slide', sRels, false);

      // Konuşmacı notları
      let notes = '';
      const notesRel = relOfType(sRels, '/notesSlide');
      if (notesRel) {
        const nDoc = await xml(notesRel.target);
        const sp = nDoc ? descendants(nDoc, 'sp').find((s) => phInfo(s)?.type === 'body') : null;
        if (sp) {
          notes = kids(kid(sp, 'txBody'), 'p').map((p) => Array.from(p.children).map((c) => {
            if (c.localName === 'r' || c.localName === 'fld') return kid(c, 't')?.textContent || '';
            if (c.localName === 'br') return '\n';
            return '';
          }).join('')).join('\n').trim();
        }
      }
      const slide = { bg, notes, elements };
      if (bgGrad) slide.bgGrad = bgGrad;
      if (bgImg) slide.bgImg = bgImg;
      return slide;
    }

    // Slayt sırası
    const ids = kids(path(pres.documentElement, 'sldIdLst'), 'sldId');
    const slidePaths = ids.map((s) => presRels[rId(s, 'id')]?.target).filter(Boolean);
    const slides = [];
    for (let i = 0; i < slidePaths.length; i++) {
      try {
        slides.push(await convertSlide(slidePaths[i], i + 1));
      } catch (e) {
        console.warn('Slayt dönüştürülemedi', slidePaths[i], e);
        skipped += 1;
      }
    }

    let title = (fileName || '').replace(/\.(pptx|ppsx|potx|present)$/i, '').trim();
    if (!title) {
      const core = await xml('docProps/core.xml');
      title = core ? descendants(core, 'title')[0]?.textContent?.trim() : '';
    }
    return { deck: { title: title || 'İçe aktarılan sunum', theme: 'light', h: SH, slides }, skipped };
  }

  return { convert };
})();
