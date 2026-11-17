// 文字の形：フォントの輪郭（glyphs.json）を折れ線にする／キャンバスに描いた文字から点を拾う

export async function loadGlyphs(url) { return (await (await fetch(url)).json()).glyphs; }

// 1文字の輪郭 → 閉じた折れ線の配列（em 単位、y は上が正）
export function contoursOf(glyph, steps = 10) {
  const out = [];
  let cur = null, px = 0, py = 0;
  for (const c of glyph.outline) {
    const op = typeof c === 'string' ? c : c[0];
    if (op === 'M') { cur = [[c[1], c[2]]]; out.push(cur); [px, py] = [c[1], c[2]]; }
    else if (op === 'L') { cur.push([c[1], c[2]]); [px, py] = [c[1], c[2]]; }
    else if (op === 'Q' || op === 'C') {
      const p = c.slice(1);
      const ctrl = op === 'Q' ? [[px, py], [p[0], p[1]], [p[2], p[3]]] : [[px, py], [p[0], p[1]], [p[2], p[3]], [p[4], p[5]]];
      for (let i = 1; i <= steps; i++) cur.push(bezier(ctrl, i / steps));
      [px, py] = ctrl[ctrl.length - 1];
    }
  }
  return out.map(poly => {
    const last = poly[poly.length - 1];
    if (Math.hypot(last[0] - poly[0][0], last[1] - poly[0][1]) < 1e-6) poly.pop();
    return poly;
  });
}
function bezier(p, t) {
  while (p.length > 1) p = p.slice(1).map((q, i) => [p[i][0] + (q[0] - p[i][0]) * t, p[i][1] + (q[1] - p[i][1]) * t]);
  return p[0];
}

// 言葉を並べて、画面のピクセル座標（y は下が正）の輪郭にする。文字ごとの輪郭の配列を返す
export function layoutWord(text, glyphs, size, cx, cy, gap = 0.02) {
  const chars = [...text];
  const width = chars.reduce((s, ch) => s + (glyphs[ch].adv + gap) * size, -gap * size);
  let x = cx - width / 2;
  return chars.map(ch => {
    const g = glyphs[ch];
    const cs = contoursOf(g).map(poly => poly.map(([u, v]) => [x + u * size, cy - (v - 0.38) * size]));
    x += (g.adv + gap) * size;
    return { ch, contours: cs };
  });
}

// 面積の符号（向き）
export const signedArea = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
export function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// 輪郭を「部品」に分ける：外側の輪郭ひとつに、その中の穴をまとめる（画をばらすのに使う）
export function piecesOf(contours) {
  const outer = [], holes = [];
  const sign = Math.sign(signedArea(contours.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a))));
  for (const c of contours) (Math.sign(signedArea(c)) === sign ? outer : holes).push(c);
  const pieces = outer.map(o => ({ contours: [o] }));
  for (const h of holes) { const p = pieces.find(p => inside(h[0], p.contours[0])); (p || pieces[0]).contours.push(h); }
  for (const p of pieces) {
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of p.contours[0]) { sx += x; sy += y; n++; }
    p.cx = sx / n; p.cy = sy / n;
  }
  return pieces;
}

// キャンバスに文字を描いて、塗られた所から点を拾う（粒子にする用）
export function samplePoints(text, font, step, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(text, W / 2, H / 2);
  const d = g.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  return pts;
}
