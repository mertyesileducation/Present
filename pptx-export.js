/* Present — sunumu PowerPoint (Office Open XML) paketine yazar.
 * Paket iskeleti (tema, ana slayt, düzen, notlar) PptxGenJS ile, slayt içeriği
 * (şekiller, metin, tablolar, görseller) PowerPoint şemasına uygun olarak burada üretilir. */
'use strict';

const PptxExport = (() => {
  const EMU = 9525; // 1px (96 dpi) = 9525 EMU
  const NS_REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

  const e = (px) => Math.round((Number(px) || 0) * EMU);
  const xmlEsc = (s) => String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]/g, '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex6 = (c) => (/^#[0-9a-f]{6}/i.test(c || '') ? c.slice(1, 7).toUpperCase() : '000000');
  const alphaOf = (c) => (/^#[0-9a-f]{8}$/i.test(c || '') ? parseInt(c.slice(7, 9), 16) / 255 : 1);
  const clr = (c) => {
    const a = alphaOf(c);
    return a < 1 ? `<a:srgbClr val="${hex6(c)}"><a:alpha val="${Math.round(a * 100000)}"/></a:srgbClr>` : `<a:srgbClr val="${hex6(c)}"/>`;
  };
  const solid = (c) => `<a:solidFill>${clr(c)}</a:solidFill>`;
  const fillXml = (color, grad, imgRid, tile) => {
    if (imgRid) {
      const mode = tile ? '<a:tile tx="0" ty="0" sx="100000" sy="100000" flip="none" algn="tl"/>' : '<a:stretch><a:fillRect/></a:stretch>';
      return `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${imgRid}"/><a:srcRect/>${mode}</a:blipFill>`;
    }
    if (grad && grad.stops && grad.stops.length) {
      const gs = grad.stops.map(([p, c]) => `<a:gs pos="${Math.round(Math.max(0, Math.min(1, p)) * 100000)}">${clr(c)}</a:gs>`).join('');
      if (grad.type === 'radial') {
        const cx = Math.round((grad.cx ?? 50) * 1000);
        const cy = Math.round((grad.cy ?? 50) * 1000);
        return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst><a:path path="circle"><a:fillToRect l="${cx}" t="${cy}" r="${100000 - cx}" b="${100000 - cy}"/></a:path></a:gradFill>`;
      }
      return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst><a:lin ang="${Math.round((((grad.angle || 0) % 360) + 360) % 360 * 60000)}" scaled="0"/></a:gradFill>`;
    }
    return color ? solid(color) : '<a:noFill/>';
  };
  const DASHES = new Set(['solid', 'dot', 'dash', 'lgDash', 'dashDot', 'lgDashDot', 'lgDashDotDot', 'sysDash', 'sysDot', 'sysDashDot', 'sysDashDotDot']);
  const lnXml = (el) => {
    if (!el.stroke || !el.strokeWidth) return '<a:ln><a:noFill/></a:ln>';
    let x = `<a:ln w="${e(el.strokeWidth)}">${solid(el.stroke)}`;
    if (el.dash && DASHES.has(el.dash)) x += `<a:prstDash val="${el.dash}"/>`;
    if (el.headEnd) x += `<a:headEnd type="${el.headEnd}"/>`;
    if (el.tailEnd) x += `<a:tailEnd type="${el.tailEnd}"/>`;
    return `${x}</a:ln>`;
  };
  const xfrm = (el, tag = 'a:xfrm') => {
    let a = '';
    const rot = Math.round(((((el.rot || 0) % 360) + 360) % 360) * 60000);
    if (rot) a += ` rot="${rot}"`;
    if (el.flipH) a += ' flipH="1"';
    if (el.flipV) a += ' flipV="1"';
    return `<${tag}${a}><a:off x="${e(el.x)}" y="${e(el.y)}"/><a:ext cx="${Math.max(0, e(el.w))}" cy="${Math.max(0, e(el.h))}"/></${tag}>`;
  };
  const prstGeom = (prst, adj = {}) => {
    const gd = Object.entries(adj || {}).map(([k, v]) => `<a:gd name="${xmlEsc(k)}" fmla="val ${Math.round(v)}"/>`).join('');
    return `<a:prstGeom prst="${prst}"><a:avLst>${gd}</a:avLst></a:prstGeom>`;
  };

  /* ---------- Metin ---------- */
  const sz = (px) => Math.max(100, Math.min(400000, Math.round(px * 75))); // px → pt × 100
  function rPr(r, t, p) {
    const size = r.size || p.size || t.fontSize;
    const bold = r.bold !== undefined ? r.bold : t.bold;
    const italic = r.italic !== undefined ? r.italic : t.italic;
    const underline = r.underline !== undefined ? r.underline : t.underline;
    const font = xmlEsc(r.font || t.font || 'Arial');
    let a = ` lang="tr-TR" sz="${sz(size)}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}"`;
    if (underline) a += ' u="sng"';
    if (r.strike) a += ' strike="sngStrike"';
    if (r.caps) a += ' cap="all"';
    return `<a:rPr${a} dirty="0">${solid(r.color || t.color || '#000000')}<a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:rPr>`;
  }
  function parasOf(t) {
    if (t.paras && t.paras.length) return t.paras;
    return String(t.text || '').split('\n').map((line) => ({ runs: line ? [{ text: line }] : [] }));
  }
  function parasXml(t) {
    return parasOf(t).map((p) => {
      let attrs = '';
      const align = { left: 'l', center: 'ctr', right: 'r', justify: 'just' }[p.align || t.align || 'left'] || 'l';
      attrs += ` algn="${align}"`;
      if (p.lvl) attrs += ` lvl="${Math.min(8, p.lvl)}"`;
      const def = p.bullet ? { marL: ((p.lvl || 0) + 1) * 36, indent: -36 } : { marL: (p.lvl || 0) * 36, indent: 0 };
      const marL = p.marL !== undefined ? p.marL : def.marL;
      const indent = p.indent !== undefined ? p.indent : def.indent;
      attrs += ` marL="${e(marL)}" indent="${e(indent)}"`;
      let kids = '';
      if (p.lineHeight) kids += `<a:lnSpc><a:spcPct val="${Math.round((p.lineHeight / 1.2) * 100000)}"/></a:lnSpc>`;
      if (p.spaceBefore) kids += `<a:spcBef><a:spcPts val="${Math.round(p.spaceBefore * 75)}"/></a:spcBef>`;
      if (p.spaceAfter) kids += `<a:spcAft><a:spcPts val="${Math.round(p.spaceAfter * 75)}"/></a:spcAft>`;
      if (p.bullet === 'num') kids += '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>';
      else if (p.bullet === 'char') kids += `<a:buFont typeface="Arial"/><a:buChar char="${xmlEsc(p.buChar || '•')}"/>`;
      else kids += '<a:buNone/>';
      let body = '';
      for (const r of p.runs || []) {
        const parts = String(r.text || '').split('\n');
        parts.forEach((txt, i) => {
          if (i > 0) body += `<a:br>${rPr(r, t, p)}</a:br>`;
          if (txt) body += `<a:r>${rPr(r, t, p)}<a:t>${xmlEsc(txt)}</a:t></a:r>`;
        });
      }
      const endR = rPr({}, t, p).replace('<a:rPr', '<a:endParaRPr').replace('</a:rPr>', '</a:endParaRPr>');
      return `<a:p><a:pPr${attrs}>${kids}</a:pPr>${body}${endR}</a:p>`;
    }).join('');
  }
  function bodyPr(t) {
    const [l, tp, r, b] = t.inset || [10, 6, 10, 6];
    const anchor = { top: 't', middle: 'ctr', bottom: 'b' }[t.valign || 'top'] || 't';
    let a = ` wrap="${t.wrap === false ? 'none' : 'square'}" lIns="${e(l)}" tIns="${e(tp)}" rIns="${e(r)}" bIns="${e(b)}" anchor="${anchor}" rtlCol="0"`;
    if (t.vert) a += ` vert="${t.vert}"`;
    return `<a:bodyPr${a}><a:noAutofit/></a:bodyPr>`;
  }

  /* ---------- Öğeler ---------- */
  function shapeXml(id, name, el, geomXml, fill, txBody = '', txBox = false) {
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)} ${id}"/><p:cNvSpPr${txBox ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr>`
      + `<p:spPr>${xfrm(el)}${geomXml}${fill}${lnXml(el)}</p:spPr>${txBody}</p:sp>`;
  }

  function custGeomXml(el) {
    const cx = Math.max(1, e(el.w));
    const cy = Math.max(1, e(el.h));
    const pt = (x, y) => `<a:pt x="${Math.round(x * cx)}" y="${Math.round(y * cy)}"/>`;
    const paths = (el.paths || []).map((p) => {
      let a = ` w="${cx}" h="${cy}"`;
      if (p.fill === false) a += ' fill="none"';
      if (p.stroke === false) a += ' stroke="0"';
      const body = p.cmds.map((c) => {
        const [op, ...n] = c;
        if (op === 'M') return `<a:moveTo>${pt(n[0], n[1])}</a:moveTo>`;
        if (op === 'L') return `<a:lnTo>${pt(n[0], n[1])}</a:lnTo>`;
        if (op === 'C') return `<a:cubicBezTo>${pt(n[0], n[1])}${pt(n[2], n[3])}${pt(n[4], n[5])}</a:cubicBezTo>`;
        if (op === 'Q') return `<a:quadBezTo>${pt(n[0], n[1])}${pt(n[2], n[3])}</a:quadBezTo>`;
        if (op === 'Z') return '<a:close/>';
        return '';
      }).join('');
      return `<a:path${a}>${body}</a:path>`;
    }).join('');
    return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst>${paths}</a:pathLst></a:custGeom>`;
  }

  function tableXml(id, el) {
    // PowerPoint her satırda sütun sayısı kadar hücre bekler: eksikleri tamamla
    const ncol = Math.max(el.cols ? el.cols.length : 0, ...el.rows.map((r) => r.cells.length), 1); // her <a:tc> (birleşik olanlar dahil) bir sütundur
    const avg = el.cols && el.cols.length ? el.cols.reduce((a, b) => a + b, 0) / el.cols.length : el.w;
    const cols = [...(el.cols || [])];
    while (cols.length < ncol) cols.push(avg);
    const blank = { text: '', font: 'Arial', fontSize: 18, color: '#000000' };
    el = { ...el, rows: el.rows.map((r) => ({ ...r, cells: [...r.cells.slice(0, ncol), ...Array(Math.max(0, ncol - r.cells.length)).fill(blank)] })) };
    const colSum = cols.reduce((s, c) => s + c, 0) || 1;
    const rowSum = el.rows.reduce((s, r) => s + (r.h || 0), 0) || 1;
    const border = el.border ? `${solid(el.border)}` : '<a:noFill/>';
    const bw = e(el.borderWidth || 1);
    const ln = (tag) => (el.border ? `<a:${tag} w="${bw}">${border}</a:${tag}>` : `<a:${tag}><a:noFill/></a:${tag}>`);
    const grid = cols.map((c) => `<a:gridCol w="${e((c / colSum) * el.w)}"/>`).join('');
    const rows = el.rows.map((r) => {
      const cells = r.cells.map((c) => {
        if (c.hidden) {
          const m = c.hidden === 'v' ? ' vMerge="1"' : ' hMerge="1"';
          return `<a:tc${m}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="tr-TR"/></a:p></a:txBody><a:tcPr/></a:tc>`;
        }
        let a = '';
        if (c.colspan > 1) a += ` gridSpan="${c.colspan}"`;
        if (c.rowspan > 1) a += ` rowSpan="${c.rowspan}"`;
        const [l, t, rr, b] = c.inset || [10, 5, 10, 5];
        const anchor = { top: 't', middle: 'ctr', bottom: 'b' }[c.valign || 'top'] || 't';
        const tcPr = `<a:tcPr marL="${e(l)}" marR="${e(rr)}" marT="${e(t)}" marB="${e(b)}" anchor="${anchor}">`
          + `${ln('lnL')}${ln('lnR')}${ln('lnT')}${ln('lnB')}${c.fill ? solid(c.fill) : '<a:noFill/>'}</a:tcPr>`;
        return `<a:tc${a}><a:txBody><a:bodyPr/><a:lstStyle/>${parasXml(c)}</a:txBody>${tcPr}</a:tc>`;
      }).join('');
      return `<a:tr h="${e(((r.h || 0) / rowSum) * el.h)}">${cells}</a:tr>`;
    }).join('');
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tablo ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>`
      + `${xfrm({ x: el.x, y: el.y, w: el.w, h: el.h }, 'p:xfrm')}<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">`
      + `<a:tbl><a:tblPr firstRow="0" bandRow="0"/><a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  }

  function elementXml(el, id, media) {
    switch (el.type) {
      case 'text': {
        const tx = `<p:txBody>${bodyPr(el)}<a:lstStyle/>${parasXml(el)}</p:txBody>`;
        return shapeXml(id, 'Metin', { ...el, stroke: null, flipH: false, flipV: false }, prstGeom('rect'), fillXml(el.fill, el.grad), tx, true);
      }
      case 'rect': {
        const ss = Math.min(el.w, el.h) || 1;
        const geom = el.radius > 0 ? prstGeom('roundRect', { adj: Math.min(50000, (el.radius / ss) * 100000) }) : prstGeom('rect');
        return shapeXml(id, 'Dikdörtgen', el, geom, fillXml(el.fill, el.grad));
      }
      case 'ellipse':
        return shapeXml(id, 'Elips', el, prstGeom('ellipse'), fillXml(el.fill, el.grad));
      case 'shape': {
        if (Shapes.isOpen(el.geom) || /Connector/.test(el.geom || '')) {
          return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Bağlayıcı ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>`
            + `<p:spPr>${xfrm(el)}${prstGeom(el.geom || 'line', el.adj)}<a:noFill/>${lnXml({ ...el, strokeWidth: el.strokeWidth || 1, stroke: el.stroke || '#000000' })}</p:spPr></p:cxnSp>`;
        }
        const geom = el.geom === 'custGeom' ? custGeomXml(el) : prstGeom(el.geom || 'rect', el.adj);
        const rid = el.imgFill ? media(el.imgFill.src) : null;
        return shapeXml(id, 'Şekil', el, geom, fillXml(el.fill, el.grad, rid, el.imgFill && el.imgFill.tile));
      }
      case 'image': {
        const rid = media(el.src);
        if (!rid) return '';
        let geom = prstGeom('rect');
        if (el.round === 'ellipse') geom = prstGeom('ellipse');
        else if (el.radius > 0) geom = prstGeom('roundRect', { adj: Math.min(50000, (el.radius / (Math.min(el.w, el.h) || 1)) * 100000) });
        return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Resim ${id}" descr=""/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
          + `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`
          + `<p:spPr>${xfrm(el)}${geom}${el.stroke && el.strokeWidth ? lnXml(el) : ''}</p:spPr></p:pic>`;
      }
      case 'table':
        return tableXml(id, el);
      default:
        return '';
    }
  }

  const SPTREE_HEAD = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
    + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

  /** Sunumu .pptx paketine (JSZip nesnesi) dönüştürür */
  async function build(deck) {
    const H = deck.h || 540;
    const pptx = new window.PptxGenJS();
    pptx.defineLayout({ name: 'PRESENT', width: 10, height: +(H / 96).toFixed(4) });
    pptx.layout = 'PRESENT';
    pptx.title = deck.title || 'Sunum';
    pptx.company = 'Present';
    for (const s of deck.slides) {
      const ps = pptx.addSlide();
      if (s.notes) ps.addNotes(String(s.notes).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''));
    }
    const zip = await window.JSZip.loadAsync(await pptx.write({ outputType: 'arraybuffer' }));

    const mediaFiles = new Map(); // src → dosya adı
    let mediaN = 0;
    let usesJpeg = false;
    let usesPng = false;

    for (let i = 0; i < deck.slides.length; i++) {
      const s = deck.slides[i];
      const slidePath = `ppt/slides/slide${i + 1}.xml`;
      const relsPath = `ppt/slides/_rels/slide${i + 1}.xml.rels`;
      let rels = await zip.file(relsPath).async('string');
      const slideRels = new Map();
      const media = (src) => {
        const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(src || '');
        if (!m) return null;
        if (!mediaFiles.has(src)) {
          const ext = m[1] === 'png' ? 'png' : 'jpeg';
          if (ext === 'png') usesPng = true; else usesJpeg = true;
          const name = `present_${++mediaN}.${ext}`;
          zip.file(`ppt/media/${name}`, m[2], { base64: true });
          mediaFiles.set(src, name);
        }
        if (!slideRels.has(src)) {
          const rid = `rIdPm${slideRels.size + 1}`;
          slideRels.set(src, rid);
          rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${NS_REL_IMAGE}" Target="../media/${mediaFiles.get(src)}"/></Relationships>`);
        }
        return slideRels.get(src);
      };

      let id = 2;
      const shapes = s.elements.map((el) => elementXml(el, id++, media)).join('');
      const bgRid = s.bgImg ? media(s.bgImg.src) : null;
      const bg = `<p:bg><p:bgPr>${fillXml(s.bg || '#FFFFFF', s.bgGrad, bgRid, s.bgImg && s.bgImg.tile)}<a:effectLst/></p:bgPr></p:bg>`;
      let xml = await zip.file(slidePath).async('string');
      xml = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, '');
      xml = xml.replace(/<p:spTree>[\s\S]*<\/p:spTree>/, `${SPTREE_HEAD}${shapes}</p:spTree>`);
      xml = xml.replace(/(<p:cSld[^>]*>)/, `$1${bg}`);
      zip.file(slidePath, xml);
      zip.file(relsPath, rels);
    }

    let ct = await zip.file('[Content_Types].xml').async('string');
    const addDefault = (ext, type) => {
      if (!new RegExp(`Extension="${ext}"`, 'i').test(ct)) ct = ct.replace('<Default ', `<Default Extension="${ext}" ContentType="${type}"/><Default `);
    };
    if (usesPng) addDefault('png', 'image/png');
    if (usesJpeg) addDefault('jpeg', 'image/jpeg');
    zip.file('[Content_Types].xml', ct);
    return zip;
  }

  return { build };
})();
