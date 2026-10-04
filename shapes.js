/* Present — PowerPoint hazır şekilleri (prstGeom) ve serbest çizimler için SVG yolları */
'use strict';

const Shapes = (() => {
  const f = (n) => +n.toFixed(2);
  const poly = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
  const roundRect = (w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (!r) return poly([[0, 0], [w, 0], [w, h], [0, h]]);
    return `M${f(r)} 0 H${f(w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}`
      + ` H${f(r)} A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)} V${f(r)} A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0 Z`;
  };
  const star = (n, w, h, inner) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const k = i % 2 ? inner : 1;
      pts.push([w / 2 + (w / 2) * k * Math.cos(a), h / 2 + (h / 2) * k * Math.sin(a)]);
    }
    return poly(pts);
  };

  const regular = (n, w, h, rot = -Math.PI / 2) => poly(Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)];
  }));
  // Elips üzerinde bir açı (derece, saat yönünde, 0 = sağ) → nokta
  const onEllipse = (w, h, deg, rx = w / 2, ry = h / 2) => {
    const t = (deg * Math.PI) / 180;
    return [w / 2 + rx * Math.cos(t), h / 2 + ry * Math.sin(t)];
  };
  const arcPath = (w, h, st, en, rx = w / 2, ry = h / 2, move = true) => {
    let sw = (((en - st) % 360) + 360) % 360;
    if (sw === 0) sw = 360;
    const [x0, y0] = onEllipse(w, h, st, rx, ry);
    const [x1, y1] = onEllipse(w, h, st + Math.min(sw, 359.99), rx, ry);
    return `${move ? `M${f(x0)} ${f(y0)} ` : `L${f(x0)} ${f(y0)} `}A${f(rx)} ${f(ry)} 0 ${sw > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
  };
  const arcRev = (w, h, st, en, rx, ry) => {
    let sw = (((en - st) % 360) + 360) % 360;
    if (sw === 0) sw = 360;
    const [x0, y0] = onEllipse(w, h, st + Math.min(sw, 359.99), rx, ry);
    const [x1, y1] = onEllipse(w, h, st, rx, ry);
    return `L${f(x0)} ${f(y0)} A${f(rx)} ${f(ry)} 0 ${sw > 180 ? 1 : 0} 0 ${f(x1)} ${f(y1)}`;
  };
  const ellipseD = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;

  // Yalnızca çizgisi olan (dolgusuz) şekiller
  const OPEN = new Set(['line', 'straightConnector1', 'bentConnector2', 'bentConnector3', 'bentConnector4', 'curvedConnector2', 'curvedConnector3', 'arc', 'leftBracket', 'rightBracket', 'leftBrace', 'rightBrace', 'bracketPair', 'bracePair']);

  /** Hazır şeklin SVG yolu (piksel koordinatlarında). Bilinmiyorsa null. */
  function preset(geom, w, h, adj = {}) {
    const ss = Math.min(w, h);
    const a = (name, d) => (adj[name] !== undefined ? adj[name] : d) / 100000;
    switch (geom) {
      case 'rect': case 'flowChartProcess': case 'snip2SameRect': return poly([[0, 0], [w, 0], [w, h], [0, h]]);
      case 'roundRect': case 'flowChartAlternateProcess': case 'round2SameRect': case 'round1Rect':
        return roundRect(w, h, ss * a('adj', 16667));
      case 'flowChartTerminator': return roundRect(w, h, ss / 2);
      case 'ellipse': case 'flowChartConnector':
        return `M0 ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w)} ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 0 0 ${f(h / 2)} Z`;
      case 'triangle': case 'flowChartExtract': return poly([[w * a('adj', 50000), 0], [w, h], [0, h]]);
      case 'rtTriangle': return poly([[0, 0], [w, h], [0, h]]);
      case 'diamond': case 'flowChartDecision': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
      case 'parallelogram': case 'flowChartInputOutput': {
        const x = ss * a('adj', 25000);
        return poly([[x, 0], [w, 0], [w - x, h], [0, h]]);
      }
      case 'trapezoid': {
        const x = ss * a('adj', 25000);
        return poly([[0, h], [x, 0], [w - x, 0], [w, h]]);
      }
      case 'pentagon': return poly([[w / 2, 0], [w, h * 0.382], [w * 0.809, h], [w * 0.191, h], [0, h * 0.382]]);
      case 'hexagon': {
        const x = ss * a('adj', 25000);
        return poly([[x, 0], [w - x, 0], [w, h / 2], [w - x, h], [x, h], [0, h / 2]]);
      }
      case 'octagon': {
        const x = ss * a('adj', 29289);
        return poly([[x, 0], [w - x, 0], [w, x], [w, h - x], [w - x, h], [x, h], [0, h - x], [0, x]]);
      }
      case 'snip1Rect': {
        const x = ss * a('adj', 16667);
        return poly([[0, 0], [w - x, 0], [w, x], [w, h], [0, h]]);
      }
      case 'homePlate': {
        const x = w - ss * a('adj', 50000);
        return poly([[0, 0], [x, 0], [w, h / 2], [x, h], [0, h]]);
      }
      case 'chevron': {
        const x = ss * a('adj', 50000);
        return poly([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h], [x, h / 2]]);
      }
      case 'rightArrow': {
        const t = (h * a('adj1', 50000)) / 2;
        const x = w - ss * a('adj2', 50000);
        return poly([[0, h / 2 - t], [x, h / 2 - t], [x, 0], [w, h / 2], [x, h], [x, h / 2 + t], [0, h / 2 + t]]);
      }
      case 'leftArrow': {
        const t = (h * a('adj1', 50000)) / 2;
        const x = ss * a('adj2', 50000);
        return poly([[w, h / 2 - t], [x, h / 2 - t], [x, 0], [0, h / 2], [x, h], [x, h / 2 + t], [w, h / 2 + t]]);
      }
      case 'upArrow': {
        const t = (w * a('adj1', 50000)) / 2;
        const y = ss * a('adj2', 50000);
        return poly([[w / 2 - t, h], [w / 2 - t, y], [0, y], [w / 2, 0], [w, y], [w / 2 + t, y], [w / 2 + t, h]]);
      }
      case 'downArrow': {
        const t = (w * a('adj1', 50000)) / 2;
        const y = h - ss * a('adj2', 50000);
        return poly([[w / 2 - t, 0], [w / 2 - t, y], [0, y], [w / 2, h], [w, y], [w / 2 + t, y], [w / 2 + t, 0]]);
      }
      case 'leftRightArrow': {
        const t = (h * a('adj1', 50000)) / 2;
        const x = ss * a('adj2', 50000);
        return poly([[0, h / 2], [x, 0], [x, h / 2 - t], [w - x, h / 2 - t], [w - x, 0], [w, h / 2], [w - x, h], [w - x, h / 2 + t], [x, h / 2 + t], [x, h]]);
      }
      case 'star4': return star(4, w, h, 0.25);
      case 'star5': return star(5, w, h, 0.382);
      case 'star6': return star(6, w, h, 0.5);
      case 'star8': return star(8, w, h, 0.7);
      case 'plus': case 'mathPlus': {
        const x = ss * a('adj', 25000);
        return poly([[x, 0], [w - x, 0], [w - x, x], [w, x], [w, h - x], [w - x, h - x], [w - x, h], [x, h], [x, h - x], [0, h - x], [0, x], [x, x]]);
      }
      case 'heart':
        return `M${f(w / 2)} ${f(h * 0.25)} C${f(w / 2)} 0 0 0 0 ${f(h * 0.3)} C0 ${f(h * 0.6)} ${f(w / 2)} ${f(h * 0.8)} ${f(w / 2)} ${f(h)}`
          + ` C${f(w / 2)} ${f(h * 0.8)} ${f(w)} ${f(h * 0.6)} ${f(w)} ${f(h * 0.3)} C${f(w)} 0 ${f(w / 2)} 0 ${f(w / 2)} ${f(h * 0.25)} Z`;
      case 'wedgeRectCallout': case 'wedgeRoundRectCallout': {
        const tx = w / 2 + w * a('adj1', -20833);
        const ty = h / 2 + h * a('adj2', 62500);
        const bx = Math.max(w * 0.2, Math.min(w * 0.8, tx));
        if (ty > h) return poly([[0, 0], [w, 0], [w, h], [bx + w * 0.08, h], [tx, ty], [bx - w * 0.08, h], [0, h]]);
        if (ty < 0) return poly([[0, 0], [bx - w * 0.08, 0], [tx, ty], [bx + w * 0.08, 0], [w, 0], [w, h], [0, h]]);
        return poly([[0, 0], [w, 0], [w, h], [0, h]]);
      }
      case 'line': case 'straightConnector1': return `M0 0 L${f(w)} ${f(h)}`;
      case 'bentConnector2': return `M0 0 L${f(w)} 0 L${f(w)} ${f(h)}`;
      case 'bentConnector3': {
        const x = w * a('adj1', 50000);
        return `M0 0 L${f(x)} 0 L${f(x)} ${f(h)} L${f(w)} ${f(h)}`;
      }
      case 'curvedConnector3': return `M0 0 C${f(w / 2)} 0 ${f(w / 2)} ${f(h)} ${f(w)} ${f(h)}`;
      case 'pie': {
        const st = a('adj1', 0) * 100000 / 60000;
        const en = a('adj2', 16200000) * 100000 / 60000;
        return `M${f(w / 2)} ${f(h / 2)} ${arcPath(w, h, st, en).replace(/^M/, 'L')} Z`;
      }
      case 'chord': {
        const st = a('adj1', 2700000) * 100000 / 60000;
        const en = a('adj2', 16200000) * 100000 / 60000;
        return `${arcPath(w, h, st, en)} Z`;
      }
      case 'arc': {
        const st = a('adj1', 16200000) * 100000 / 60000;
        const en = a('adj2', 0) * 100000 / 60000;
        return arcPath(w, h, st, en);
      }
      case 'blockArc': {
        const st = a('adj1', 10800000) * 100000 / 60000;
        const en = a('adj2', 0) * 100000 / 60000;
        const t = ss * a('adj3', 25000);
        return `${arcPath(w, h, st, en)} ${arcRev(w, h, st, en, w / 2 - t, h / 2 - t)} Z`;
      }
      case 'donut': {
        const t = ss * a('adj', 25000);
        return `${ellipseD(w / 2, h / 2, w / 2, h / 2)} ${ellipseD(w / 2, h / 2, w / 2 - t, h / 2 - t)}`;
      }
      case 'noSmoking': {
        const t = ss * a('adj', 18750);
        return `${ellipseD(w / 2, h / 2, w / 2, h / 2)} ${ellipseD(w / 2, h / 2, w / 2 - t, h / 2 - t)}`;
      }
      case 'sun': {
        const rays = [];
        for (let i = 0; i < 8; i++) {
          const c = (i * Math.PI) / 4;
          const tip = [w / 2 + (w / 2) * Math.cos(c), h / 2 + (h / 2) * Math.sin(c)];
          const b1 = [w / 2 + w * 0.34 * Math.cos(c - 0.16), h / 2 + h * 0.34 * Math.sin(c - 0.16)];
          const b2 = [w / 2 + w * 0.34 * Math.cos(c + 0.16), h / 2 + h * 0.34 * Math.sin(c + 0.16)];
          rays.push(poly([tip, b1, b2]));
        }
        return `${ellipseD(w / 2, h / 2, w * 0.25, h * 0.25)} ${rays.join(' ')}`;
      }
      case 'moon': {
        const x = w * a('adj', 50000);
        return `M${f(w)} 0 A${f(w)} ${f(h / 2)} 0 0 0 ${f(w)} ${f(h)} A${f(w - x)} ${f(h / 2)} 0 0 1 ${f(w)} 0 Z`;
      }
      case 'teardrop':
        return `M${f(w / 2)} 0 L${f(w)} 0 L${f(w)} ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(w / 2)} 0 Z`;
      case 'can': case 'flowChartMagneticDisk': {
        const ry = Math.min(h / 2, ss * a('adj', 25000) / 2);
        return `M0 ${f(ry)} A${f(w / 2)} ${f(ry)} 0 0 1 ${f(w)} ${f(ry)} V${f(h - ry)} A${f(w / 2)} ${f(ry)} 0 0 1 0 ${f(h - ry)} Z`
          + ` M0 ${f(ry)} A${f(w / 2)} ${f(ry)} 0 0 0 ${f(w)} ${f(ry)}`;
      }
      case 'cube': {
        const d = ss * a('adj', 25000);
        return `${poly([[0, d], [w - d, d], [w - d, h], [0, h]])} ${poly([[0, d], [d, 0], [w, 0], [w - d, d]])} ${poly([[w - d, d], [w, 0], [w, h - d], [w - d, h]])}`;
      }
      case 'bevel': case 'frame': {
        const d = ss * a('adj1', geom === 'frame' ? 12500 : 12500);
        return `${poly([[0, 0], [w, 0], [w, h], [0, h]])} ${poly([[d, d], [d, h - d], [w - d, h - d], [w - d, d]])}`;
      }
      case 'plaque': {
        const d = ss * a('adj', 16667);
        return `M${f(d)} 0 H${f(w - d)} A${f(d)} ${f(d)} 0 0 0 ${f(w)} ${f(d)} V${f(h - d)} A${f(d)} ${f(d)} 0 0 0 ${f(w - d)} ${f(h)} H${f(d)} A${f(d)} ${f(d)} 0 0 0 0 ${f(h - d)} V${f(d)} A${f(d)} ${f(d)} 0 0 0 ${f(d)} 0 Z`;
      }
      case 'cloud': case 'cloudCallout':
        return [[0.28, 0.35, 0.2, 0.22], [0.5, 0.25, 0.22, 0.22], [0.72, 0.35, 0.2, 0.22], [0.78, 0.6, 0.2, 0.22], [0.55, 0.72, 0.24, 0.24], [0.3, 0.68, 0.22, 0.22], [0.2, 0.52, 0.18, 0.2], [0.5, 0.5, 0.3, 0.25]]
          .map(([cx, cy, rx, ry]) => ellipseD(cx * w, cy * h, rx * w, ry * h)).join(' ');
      case 'heptagon': return regular(7, w, h);
      case 'decagon': return regular(10, w, h, 0);
      case 'dodecagon': return regular(12, w, h, -Math.PI / 12);
      case 'star7': return star(7, w, h, 0.5);
      case 'star10': return star(10, w, h, 0.65);
      case 'star12': return star(12, w, h, 0.7);
      case 'star16': return star(16, w, h, 0.75);
      case 'star24': return star(24, w, h, 0.8);
      case 'star32': return star(32, w, h, 0.85);
      case 'irregularSeal1': case 'irregularSeal2': return star(12, w, h, 0.6);
      case 'upDownArrow': {
        const t = (w * a('adj1', 50000)) / 2;
        const y = ss * a('adj2', 50000);
        return poly([[w / 2, 0], [w, y], [w / 2 + t, y], [w / 2 + t, h - y], [w, h - y], [w / 2, h], [0, h - y], [w / 2 - t, h - y], [w / 2 - t, y], [0, y]]);
      }
      case 'notchedRightArrow': case 'stripedRightArrow': {
        const t = (h * a('adj1', 50000)) / 2;
        const x = w - ss * a('adj2', 50000);
        const n = geom === 'notchedRightArrow' ? t : 0;
        return poly([[0, h / 2 - t], [x, h / 2 - t], [x, 0], [w, h / 2], [x, h], [x, h / 2 + t], [0, h / 2 + t], [n, h / 2]]);
      }
      case 'rightArrowCallout': {
        const x = w * a('adj4', 64977);
        const t = h * a('adj1', 25000) / 2;
        const hh = h * a('adj2', 25000);
        return poly([[0, 0], [x, 0], [x, h / 2 - t], [w - ss * a('adj3', 25000), h / 2 - t], [w - ss * a('adj3', 25000), h / 2 - hh], [w, h / 2], [w - ss * a('adj3', 25000), h / 2 + hh], [w - ss * a('adj3', 25000), h / 2 + t], [x, h / 2 + t], [x, h], [0, h]]);
      }
      case 'flowChartDocument':
        return `M0 0 H${f(w)} V${f(h * 0.83)} C${f(w * 0.7)} ${f(h * 0.6)} ${f(w * 0.35)} ${f(h * 1.12)} 0 ${f(h * 0.9)} Z`;
      case 'flowChartMultidocument':
        return `M0 ${f(h * 0.12)} H${f(w * 0.88)} V${f(h * 0.85)} C${f(w * 0.6)} ${f(h * 0.7)} ${f(w * 0.3)} ${f(h * 1.08)} 0 ${f(h * 0.92)} Z M${f(w * 0.06)} ${f(h * 0.06)} H${f(w * 0.94)} V${f(h * 0.78)} M${f(w * 0.12)} 0 H${f(w)} V${f(h * 0.72)}`;
      case 'flowChartMerge': return poly([[0, 0], [w, 0], [w / 2, h]]);
      case 'flowChartSort': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
      case 'flowChartManualInput': return poly([[0, h * 0.2], [w, 0], [w, h], [0, h]]);
      case 'flowChartManualOperation': return poly([[0, 0], [w, 0], [w * 0.8, h], [w * 0.2, h]]);
      case 'flowChartPreparation': return poly([[w * 0.2, 0], [w * 0.8, 0], [w, h / 2], [w * 0.8, h], [w * 0.2, h], [0, h / 2]]);
      case 'flowChartPredefinedProcess':
        return `${poly([[0, 0], [w, 0], [w, h], [0, h]])} M${f(w / 8)} 0 V${f(h)} M${f(w * 7 / 8)} 0 V${f(h)}`;
      case 'flowChartInternalStorage':
        return `${poly([[0, 0], [w, 0], [w, h], [0, h]])} M${f(w / 8)} 0 V${f(h)} M0 ${f(h / 8)} H${f(w)}`;
      case 'flowChartOffpageConnector': return poly([[0, 0], [w, 0], [w, h * 0.8], [w / 2, h], [0, h * 0.8]]);
      case 'flowChartPunchedCard': return poly([[w * 0.2, 0], [w, 0], [w, h], [0, h], [0, h * 0.2]]);
      case 'flowChartDelay': return `M0 0 H${f(w / 2)} A${f(w / 2)} ${f(h / 2)} 0 0 1 ${f(w / 2)} ${f(h)} H0 Z`;
      case 'flowChartDisplay': return `M0 ${f(h / 2)} L${f(w / 6)} 0 H${f(w * 5 / 6)} A${f(w / 6)} ${f(h / 2)} 0 0 1 ${f(w * 5 / 6)} ${f(h)} H${f(w / 6)} Z`;
      case 'flowChartOnlineStorage': return `M${f(w / 6)} 0 H${f(w)} A${f(w / 6)} ${f(h / 2)} 0 0 0 ${f(w)} ${f(h)} H${f(w / 6)} A${f(w / 6)} ${f(h / 2)} 0 0 1 ${f(w / 6)} 0 Z`;
      case 'flowChartOr': case 'flowChartSummingJunction':
        return `${ellipseD(w / 2, h / 2, w / 2, h / 2)} M${f(w / 2)} 0 V${f(h)} M0 ${f(h / 2)} H${f(w)}`;
      case 'wedgeEllipseCallout': {
        const tx = w / 2 + w * a('adj1', -20833);
        const ty = h / 2 + h * a('adj2', 62500);
        return `${ellipseD(w / 2, h / 2, w / 2, h / 2)} ${poly([[w * 0.4, h * 0.9], [tx, ty], [w * 0.6, h * 0.92]])}`;
      }
      case 'leftBracket': return `M${f(w)} 0 Q0 0 0 ${f(h * 0.1)} V${f(h * 0.9)} Q0 ${f(h)} ${f(w)} ${f(h)}`;
      case 'rightBracket': return `M0 0 Q${f(w)} 0 ${f(w)} ${f(h * 0.1)} V${f(h * 0.9)} Q${f(w)} ${f(h)} 0 ${f(h)}`;
      case 'leftBrace': return `M${f(w)} 0 Q${f(w / 2)} 0 ${f(w / 2)} ${f(h * 0.1)} V${f(h * 0.4)} Q${f(w / 2)} ${f(h / 2)} 0 ${f(h / 2)} Q${f(w / 2)} ${f(h / 2)} ${f(w / 2)} ${f(h * 0.6)} V${f(h * 0.9)} Q${f(w / 2)} ${f(h)} ${f(w)} ${f(h)}`;
      case 'rightBrace': return `M0 0 Q${f(w / 2)} 0 ${f(w / 2)} ${f(h * 0.1)} V${f(h * 0.4)} Q${f(w / 2)} ${f(h / 2)} ${f(w)} ${f(h / 2)} Q${f(w / 2)} ${f(h / 2)} ${f(w / 2)} ${f(h * 0.6)} V${f(h * 0.9)} Q${f(w / 2)} ${f(h)} 0 ${f(h)}`;
      case 'bracketPair': return `M${f(ss * 0.15)} 0 Q0 0 0 ${f(ss * 0.15)} V${f(h - ss * 0.15)} Q0 ${f(h)} ${f(ss * 0.15)} ${f(h)} M${f(w - ss * 0.15)} 0 Q${f(w)} 0 ${f(w)} ${f(ss * 0.15)} V${f(h - ss * 0.15)} Q${f(w)} ${f(h)} ${f(w - ss * 0.15)} ${f(h)}`;
      case 'bentConnector4': return `M0 0 L${f(w * a('adj1', 50000))} 0 L${f(w * a('adj1', 50000))} ${f(h * a('adj2', 50000))} L${f(w)} ${f(h * a('adj2', 50000))} L${f(w)} ${f(h)}`;
      case 'curvedConnector2': return `M0 0 Q${f(w)} 0 ${f(w)} ${f(h)}`;
      case 'smileyFace':
        return `${ellipseD(w / 2, h / 2, w / 2, h / 2)} ${ellipseD(w * 0.35, h * 0.38, w * 0.05, h * 0.06)} ${ellipseD(w * 0.65, h * 0.38, w * 0.05, h * 0.06)} M${f(w * 0.28)} ${f(h * 0.65)} Q${f(w / 2)} ${f(h * 0.85)} ${f(w * 0.72)} ${f(h * 0.65)}`;
      case 'lightningBolt': return poly([[w * 0.39, 0], [w * 0.62, h * 0.32], [w * 0.52, h * 0.37], [w * 0.8, h * 0.62], [w * 0.7, h * 0.67], [w, h], [w * 0.45, h * 0.72], [w * 0.57, h * 0.66], [w * 0.2, h * 0.43], [w * 0.33, h * 0.37], [0, h * 0.14]]);
      case 'ribbon2': case 'ribbon': return poly([[0, h * 0.2], [w * 0.15, h * 0.2], [w * 0.15, 0], [w * 0.85, 0], [w * 0.85, h * 0.2], [w, h * 0.2], [w * 0.9, h * 0.55], [w, h * 0.9], [w * 0.85, h * 0.9], [w * 0.85, h * 0.75], [w * 0.15, h * 0.75], [w * 0.15, h * 0.9], [0, h * 0.9], [w * 0.1, h * 0.55]]);
      case 'foldedCorner': {
        const d = ss * a('adj', 16667);
        return `${poly([[0, 0], [w, 0], [w, h - d], [w - d, h], [0, h]])} M${f(w - d)} ${f(h)} L${f(w - d * 0.8)} ${f(h - d * 0.8)} L${f(w)} ${f(h - d)}`;
      }
      case 'round2SameRect': case 'snipRoundRect': {
        const r = ss * a('adj1', 16667);
        return `M${f(r)} 0 H${f(w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(h)} H0 V${f(r)} A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0 Z`;
      }
      case 'round1Rect': {
        const r = ss * a('adj', 16667);
        return `M0 0 H${f(w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(h)} H0 Z`;
      }
      case 'snip2SameRect': {
        const d = ss * a('adj1', 16667);
        return poly([[d, 0], [w - d, 0], [w, d], [w, h], [0, h], [0, d]]);
      }
      case 'diagStripe': {
        const d = ss * a('adj', 50000);
        return poly([[0, d], [d, 0], [w, 0], [0, h]]);
      }
      case 'halfFrame': {
        const d = ss * a('adj1', 33333);
        return poly([[0, 0], [w, 0], [w - d, d], [d, d], [d, h - d], [0, h]]);
      }
      case 'corner': {
        const dx = ss * a('adj2', 50000);
        const dy = ss * a('adj1', 50000);
        return poly([[0, 0], [dx, 0], [dx, h - dy], [w, h - dy], [w, h], [0, h]]);
      }
      default: return null;
    }
  }

  /** Serbest çizim komutları (0..1 aralığında) → SVG yolu (piksel) */
  function custom(paths, w, h) {
    return paths.map((p) => p.cmds.map((c) => {
      const [op, ...n] = c;
      const pt = n.map((v, i) => f(i % 2 ? v * h : v * w));
      return op === 'Z' ? 'Z' : `${op}${pt.join(' ')}`;
    }).join(' '));
  }

  /** OOXML arcTo → kübik Bézier parçaları (normalleştirilmemiş koordinatlarda) */
  function arcToCubics(px, py, wR, hR, stDeg, swDeg) {
    const rad = (d) => (d * Math.PI) / 180;
    const param = (deg) => Math.atan2(wR * Math.sin(rad(deg)), hR * Math.cos(rad(deg)));
    const t0 = param(stDeg);
    let t1 = param(stDeg + swDeg);
    if (swDeg > 0 && t1 <= t0) t1 += Math.PI * 2;
    if (swDeg < 0 && t1 >= t0) t1 -= Math.PI * 2;
    if (Math.abs(swDeg) >= 360) t1 = t0 + Math.sign(swDeg) * Math.PI * 2;
    const cx = px - wR * Math.cos(t0);
    const cy = py - hR * Math.sin(t0);
    const segs = Math.max(1, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 2)));
    const step = (t1 - t0) / segs;
    const out = [];
    for (let i = 0; i < segs; i++) {
      const a = t0 + i * step;
      const b = a + step;
      const k = (4 / 3) * Math.tan((b - a) / 4);
      const p0 = [cx + wR * Math.cos(a), cy + hR * Math.sin(a)];
      const p3 = [cx + wR * Math.cos(b), cy + hR * Math.sin(b)];
      out.push(['C', p0[0] - k * wR * Math.sin(a), p0[1] + k * hR * Math.cos(a), p3[0] + k * wR * Math.sin(b), p3[1] - k * hR * Math.cos(b), p3[0], p3[1]]);
    }
    return out;
  }

  const EVENODD = new Set(['donut', 'noSmoking', 'frame']);
  return { preset, custom, arcToCubics, isOpen: (g) => OPEN.has(g), evenOdd: (g) => EVENODD.has(g) };
})();
